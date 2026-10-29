# Disposable engine contract and safety limits

## Proposed database contract

- All publication metadata and shard rows live in `sitemap_private`, outside any PostgREST-exposed schema. `PUBLIC` receives no access. Roles are `NOLOGIN` capability roles: `cth_sitemap_reader` gets SELECT only; `cth_sitemap_publisher` gets SELECT, INSERT and guarded UPDATE but no DELETE; `cth_sitemap_sweeper` gets SELECT and guarded DELETE but no INSERT/UPDATE. The package uses no `SECURITY DEFINER` function.
- `extensions.pgcrypto` is created with `CREATE EXTENSION IF NOT EXISTS ... WITH SCHEMA extensions`. The harness refuses to drop the schema or extension. Digest access is granted only to reader and publisher roles.
- Session advisory lock `(20261029,1)` must be held by the exact backend doing protected mutations. Publisher and sweeper use the same lock. Transaction pooler mode is not supported by this contract.
- A generation starts `building`; shards can only be inserted while it is building. A deferred constraint checks the final row state at commit and rejects any generation still building, including one with stored payloads. Building, shards, sealing, prior-generation retirement and pointer CAS must therefore share one transaction.
- Sealing verifies shard count, total URLs/bytes, contiguous zero-based shard numbers, each row SHA-256 and the ordered SHA-256 manifest. Sealed payload/content fields are immutable; append/update is rejected. Only retention metadata may change, under the lock.
- The singleton pointer advances by exactly one epoch and must name a sealed active generation. Callers use a CAS predicate on both captured epoch and prior generation. Deferred cross-table checks reject a dangling pointer or an unpointed active sealed generation.
- Retired generations and shards cannot be deleted until strictly after eight days. Rollback reactivates a retained sealed generation and advances epoch; the displaced current generation becomes newly retained. Sweeping deletes children before metadata under the same session lock.
- The 400,000,000-byte guard sums logical lengths of stored compressed-payload bytea values. It does not promise that heap + indexes + TOAST remain under 400 MB. CI records physical relation and TOAST measurements separately.

## Publisher, rollback and sweeper ordering

1. Publisher pins one physical PostgreSQL session, sets `lock_timeout=5s`, `statement_timeout=180s`, `idle_in_transaction_session_timeout=60s`, and a 20-minute transaction/client deadline. It acquires session lock `(20261029,1)`, captures `(pointer_epoch,current_generation_id)`, then starts a `REPEATABLE READ READ ONLY` inventory transaction. The first snapshot SELECT rereads that pointer and must match the captured pair. Inventory is scanned in deterministic keyset order and written into bounded temporary shard files; no offset-based cross-request proof is used.
2. After inventory snapshot commit, the same pinned session begins one write transaction, creates the candidate, inserts every shard, checks hashes/counts/limits, seals it, marks the previous current generation retired, and performs a CAS on both captured epoch and prior pointer. Exactly one pointer row must change. Commit makes the entire generation visible atomically. A failure at any step rolls back the transaction before `pg_advisory_unlock`; if rollback/unlock cannot be confirmed, close the physical session so PostgreSQL releases the session lock.
3. A first publication starts with pointer `(NULL,0)`. The index route remains fail-closed (`503 no-store`) until a complete generation and epoch-1 pointer commit. First publication is validated before enabling the new reader. If it fails, retain the legacy route or fail closed; do not serve an empty successful index.
4. Rollback takes the same lock, validates the retained generation and checksums, reactivates it, retires the current generation, advances epoch with CAS, and commits. It never decrements epoch or deletes either generation. If no valid retained target exists, restore the previous reader/legacy route or return 503.
5. Sweeper takes the identical lock with `pg_try_advisory_lock`; busy means skip without touching rows. It deletes only sealed noncurrent generations strictly older than eight days, children first and metadata second, in one transaction. Failure rolls back before unlock. A pointer change and deletion can therefore not race.

## Serving/CDN cutover contract (not tested by this engine package)

- Stable `/sitemap.xml` is uncached/zero shared max-age and lists only versioned immutable child paths such as `/sitemap/g/{generation_uuid}/{shard_no}.xml`.
- A validated versioned shard may use `public, max-age=31536000, s-maxage=31536000, immutable`; its unique URL is never overwritten. Compatibility aliases are `no-store` and redirect only after a successful pointer lookup.
- Transient database/timeout/checksum/XML uncertainty is `503 no-store`; `404 no-store` requires a successful lookup proving that the requested generation/shard is absent. Unknown state never becomes an empty `200`.
- First cutover and every pointer rollback require a purge acknowledgement for `/sitemap.xml`, legacy aliases and their sitemap cache tags before declaring cutover complete. If purge fails, keep/restore the previous route; retry purge. Database commit and CDN purge are not one atomic transaction.
- Florida publication eligibility, canonical host `https://www.contractortrusthub.com`, existing filters and public URL-count policy must be checked against the real serializer in a separately reviewed application phase. Synthetic XML in this package proves only XML parser behavior and the canonical test fixture.

## CI-only coverage

`run_engine.py` produces individual D01-D19 results and sanitized logs. Its concurrent cases use separate psycopg connections, not a single serial transaction. Snapshot and XML fixtures are synthetic. The package deliberately marks route serving/cache behavior and CDN purge as unrun because a PostgreSQL service container cannot prove them.

| Case | Engine assertion in this package | Boundary still outside this run |
|---|---|---|
| D01 | First complete pointer publication at epoch 1 | Pre-publication HTTP 503 behavior |
| D02 | Atomic transaction rollback; committed building generation with payload rejected | — |
| D03 | Sealed shard update and append rejected | — |
| D04 | Same-backend lock plus least-privilege reader/publisher/sweeper roles and no SECURITY DEFINER | Supabase production role grants/RLS deployment |
| D05 | Wrong SHA and shard gap rejected | Runtime serving checksum response |
| D06 | Stale CAS updates zero rows; epoch jump rejected | — |
| D07 | Captured pointer verified on first repeatable-read snapshot query; concurrent source insert is invisible to that snapshot | Actual Contractor inventory query/order/filter proof |
| D08 | Two sessions observe old pointer before commit and new pointer after commit | CDN visibility |
| D09 | Retained row protected; rollback reactivates prior generation with epoch increase; cleanup after eight days | Production clock/retention operations |
| D10 | Competing publisher/sweeper sessions serialize; busy sweeper skips mutation | Full deployed sweeper process behavior |
| D11 | Current generation/shards cannot be deleted | — |
| D12 | XID-less read-only and failed write transactions rollback before unlock | Pooler/session termination behavior |
| D13 | PG17 timeout configuration and statement cancellation | Supabase session-pooler and TLS behavior |
| D14 | Exact 400,000,000-byte logical payload accepted; next byte rejected | Production storage budget |
| D15 | UNRUN | HTTP status/cache contract and application fail-closed response |
| D16 | Synthetic gzip XML parses; canonical host and uniqueness fixture checked | Real serializer, Florida gates, eligibility and URL counts |
| D17 | UNRUN | CDN cache headers and purge acknowledgement |
| D18 | Interrupted client session rolls back and releases lock | Process supervisor behavior outside DB session |
| D19 | Heap, index/TOAST-inclusive relation and TOAST size recorded separately | Sustained workload/egress measurement |

## Not covered / not implied

- Supabase roles/RLS, pooler pinning, TLS certificate validation, session semantics through a Supabase session pooler, database parameter settings, or any Supabase project identity.
- Application sitemap serializer, canonical publication inventory, Florida gates, HTTP status/cache headers, Vercel behavior, CDN purge, latency or Production behavior.
- The SQL is a proposed disposable test contract, not a migration authorization. No public routes or existing workflow are modified.
