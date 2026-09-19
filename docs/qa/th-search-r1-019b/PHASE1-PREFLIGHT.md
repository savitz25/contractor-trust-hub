# TH-SEARCH-R1-019B — Phase 1 index preflight receipt

**Result: BLOCKED before execution.** Read-only preflight ran; two of its required inputs are dashboard-only and are not
established. **No DDL was run on Production.** This document is not permission to run it and does not infer any from the
runbook that requested it — execution needs the owner's explicit go-ahead in chat *and* the missing fields below.

## 1. Identity and code hold
* Reviewed candidate: PR [#86](https://github.com/savitz25/contractor-trust-hub/pull/86), head `dfa0d70d7c0a691aafe54e6295135aa81b13cd09` — confirmed by `gh pr view`, matches local worktree HEAD. Draft, `mergeStateStatus: CLEAN`, not merged.
* Current `main`: `7b3458990a81817b1ca41993056925935c67aa84`, unchanged.
* Target database, confirmed by connecting with the app's own `DATABASE_URL` (Session pooler) and reading `current_database()`/`pg_stat_activity`, not by name alone: host `aws-0-ca-central-1.pooler.supabase.com:5432`, database `postgres`, role `postgres.jhjztnisugdsuliriajp` — matches the coordinator's stated Supabase project ref `jhjztnisugdsuliriajp`. `public.contractors` and `public.licenses` exist, owned by the connecting role; no row-level security. PostgreSQL 17.6, not in recovery.
* No PR, worktree or repo other than #86/`contractor-trust-hub` was touched. Lender, Ask and Senior were not opened. Ask's `contractorNameAdapter` stays `enabled: false`. Legacy v2 files remain byte-identical to base; no auth/customer table touched.
* PR body updated to the current state (see below); no release is claimed.

## 2. Read-only preflight — findings
Full output: `phase1-preflight.readonly.json` (single `BEGIN READ ONLY` transaction, 8 s statement timeout, rolled back; no credential printed).

**Established (measured):**
| Fact | Value |
|---|---|
| `shared_buffers` | 256 MiB |
| `effective_cache_size` | 768 MiB (planner hint, not measured free RAM) |
| `maintenance_work_mem` | 64 MiB · `max_parallel_maintenance_workers` 1 (index builds are single-threaded, temp-spill-prone above 64 MiB) |
| `pg_database_size` | 10,857,294,995 B ≈ 10.11 GiB (**used size, not free disk** — the runbook's own caution) |
| `contractors` table+indexes / `licenses` table+indexes | 778.9 MiB / 1824.0 MiB (heap ≈ 244.9 / 1272.5 MiB) |
| Existing name indexes | all 25 catalogued, `indisvalid`/`indisready` = true, no partial-predicate surprises; no `nameorder`/`namewords` object exists yet anywhere in the database (checked by name, not assumed) |
| Extensions / opclasses | `pg_trgm 1.6` already installed (public schema); `text_pattern_ops` (btree) and `gin_trgm_ops` (gin) both present in `pg_catalog`/`public` — no extension or opclass work needed |
| `upper`/`btrim`/`regexp_replace` volatility | all `IMMUTABLE` — safe for an expression index |
| Locale | `en_US.UTF-8`, ICU provider, collation version `153.121` matches the actual on-disk version (no pending REINDEX-on-upgrade risk right now) |
| Live activity | 11 of 60 connections, 3 active, 0 idle-in-transaction, 0 waiting on a lock, no transaction older than a few seconds, no session running CREATE INDEX/REINDEX/VACUUM/COPY/bulk DML, no `pg_stat_progress_create_index`/`_vacuum` rows — **no visible ingest or maintenance in progress**, and nothing was paused or touched to get this reading |
| Replication | 0 replicas, 0 replication slots — `wal_level=logical` is provisioned but nothing is currently retaining WAL on our behalf |
| Table health | `contractors` 1,390,133 live / 16,518 dead rows (1.2%); `licenses` 1,266,260 live / 65,056 dead (5.1%); both autovacuumed within the last five weeks; no bloat crisis |
| Cumulative DB stats since last reset (2026-07-24) | cache hit ratio 93.28%; **287,697 temp files / ≈911 GiB cumulative temp spill** — independent evidence that this instance already does heavy on-disk sort/scan work, consistent with the cold-scan pathology this proposal targets |
| Reviewed DDL | `docs/qa/th-search-r1-019b/PROPOSED-normalized-name-indexes.sql` at this head, sha256 `247d60cd63edf940e27528bf29c47315d02ec25a4611ddf2ea8f08c7103cec08` (33 lines; generated 1:1 from `NORMALIZED_NAME_INDEXES` in `lib/contractors/name-search-core.ts`, the same constant the query builder reads — code and DDL cannot drift). Fully schema-qualified (`public` is first on `search_path` and is where `contractors`/`licenses` live; no ambiguity). Phase 1 allowlist confirmed as exactly the 5 `*_nameorder_idx` statements; Phase 2's 5 `*_namewords_idx` are in the same file but are **not** requested for execution here. |
| Partial-predicate implication | Each Phase 1 index predicate is `WHERE <col> IS NOT NULL`. The application's strong-tier query (`name-search-core.ts`, `tierRule`) emits `<col> IS NOT NULL AND <same normalized expr> LIKE …` for every column — the query's own WHERE clause contains the index predicate as a literal conjunct, so the planner can use each partial index without any additional proof obligation. Confirmed locally in test 19 (PGlite) with `enable_seqscan=off`: the planner selects these indexes for every column. |
| Query-role compatibility | The preflight connected with the same `DATABASE_URL` (Session pooler, role `postgres.<ref>`) the app itself uses per `docs/SUPABASE.md`; no separate application role exists to check for missing grants, and this role owns both tables. |
| CI / deploy safety | Nothing in `.github`, `vercel.json` or `package.json`'s `build`/`postinstall` reads `schema/migrations/*.sql` or `docs/qa/**`; migrations in this repo are only ever applied by a human running a script by hand (e.g. `scripts/apply_search_indexes.mjs`). This proposal is not wired to run automatically. |

**NOT established — dashboard-only, stop condition per the runbook's own instruction ("return the precise missing dashboard fields, not a guessed number"):**
1. **Provisioned disk size and current free space/%** for Supabase project `jhjztnisugdsuliriajp` — Project Settings → Database (or the Infrastructure/Usage tab). `pg_database_size` (10.11 GiB used) is not this number.
2. **Storage billing behavior** — whether auto-scaling storage is enabled, its threshold, and whether crossing it bills automatically — Settings → Billing → Usage, or Settings → Add-ons.
3. **PITR/backup status and retention window** — Settings → Database → Backups. (`archive_mode=on`, `archive_timeout=120s` and 65 WAL files ≈ 1.02 GiB retained locally were observed by SQL, but the *managed* backup/PITR policy is dashboard-only.)
4. **Plan tier and any configured spend cap/alert** — Settings → Billing.

I have no Supabase personal access token / management-API credential in this session and did not attempt to obtain one; only the same `DATABASE_URL` the app already uses was read, inside a read-only transaction.

**Numerical abort floor — cannot be finalized without #1/#2 above.** Formula proposed for the operator to complete:
`abort if (provisioned_disk_bytes − pg_database_size) < max(2 × largest_single_index_estimate, 10% × provisioned_disk_bytes)`.
Estimated inputs available now: largest single Phase-1 index ≈ 70 MiB (by analogy to the existing raw btree indexes on the
same columns, `contractors_display_name_idx` / `contractors_legal_name_idx` ≈ 67–70 MiB each); full Phase 1 (5 indexes) ≈
0.26 GiB; Phase 1+2 (10 indexes) ≈ 0.63 GiB — **estimates**, not measured on this schema, and not a spend authorization.

## 3. What was NOT done
No `CREATE INDEX`, no `ANALYZE`, no session/runtime/planner setting changed, no extension installed, no existing index
touched or dropped, no other builder's session or process affected, no prewarm, no larger instance, no paid branch or
snapshot. The read-only transaction was rolled back.

## 4. Next owner decision
1. Supply the two missing dashboard fields (§2) or delegate a named operator with dashboard access to read them.
2. Name the operator and a low-traffic execution window; confirm the Session-pooler (not Transaction-pooler `:6543`)
   connection is what they'll use, consistent with `docs/SUPABASE.md`'s own DDL guidance.
3. Give explicit approval, in chat, to run Phase 1 (5 indexes) once #1–#2 are in hand. This document does not constitute
   that approval and none is inferred from it.
4. Phase 2 (`*_namewords_idx`) and any release/merge decision remain separately gated after Phase 1 is measured — not
   requested here.
