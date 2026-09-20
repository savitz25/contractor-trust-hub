# TH-SEARCH-R1-019B-P2F — Stage-A timeout recovery packet

**PROPOSED. NOTHING IN THIS PACKET HAS BEEN EXECUTED.** Stage A+B only. No Stage C/D (no old-index
retirement, no rename) is in scope. The reviewed P2E packet commit `f7820cd847be587b3e7552d73efbc6324cffd07a`
and its three files are unchanged; this packet is additive and stacked on it.

| Artifact | sha256 |
|---|---|
| `scripts/th_search_r1_019b_p2f_cleanup_invalid_v2.mjs` | `c6693fb3a0a74840f8f6c706eb10f4752d290756eafa15ca60ac1dd336ad434d` |
| `scripts/th_search_r1_019b_p2f_build_v2.mjs` | `9a3806266177143681b578f0924aed52b079aed7ee1bef6b601be1c18a75edc6` |
| `docs/qa/th-search-r1-019b/PROPOSED-namewords-v2-indexes.sql` (unchanged, reused, pinned by the build wrapper) | `4aefa3644d622c43616113c60d55ff206a926b071875e87cd1f7ed413c7e644e` |

## 1. What happened (observations only)

- The reviewed P2E build wrapper was run once by the owner. Receipt: started `2026-09-20T00:45:59.580Z`;
  prechecks passed; `CREATE` for target 1/5 `contractors_display_name_namewords_v2_idx` started
  `00:46:00.867Z`; stopped `00:48:01.688Z` (~120.8 s) with `canceling statement due to statement timeout`.
  No later target was attempted. The wrapper removed nothing and wrote its receipt — fail-closed as designed.
- Coordinator-reported Production state afterwards: that one index exists, GIN, 70,983,680 bytes,
  `indisvalid=false`, ready/live true, exact wrapped expression and predicate; the other four v2 names
  absent; no index build running, no lock waiter, no >60 s query, no vacuum; session `statement_timeout = 2min`
  with no persistent role/database setting explaining it.
- **Not established, and not claimed anywhere in this packet:** why this build exceeded 2 minutes when the
  old Phase-2 builds (roughly 27–96 s each) did not. No cache, load or footprint explanation is asserted.

Evidence record (verbatim receipt + clearly-labelled coordinator-reported state, credential-free):
`docs/qa/th-search-r1-019b/p2f-failed-stage-a-evidence.json`.

## 2. Recovery sequence (each step separately authorized; neither is run by the preparing session)

| Step | Script | What it may send |
|---|---|---|
| 1 | `p2f_cleanup_invalid_v2.mjs --execute-cleanup-invalid-v2 --owner-authorized-p2f-cleanup` | fixed catalog reads + exactly `DROP INDEX CONCURRENTLY public.contractors_display_name_namewords_v2_idx` |
| 2 | `p2f_build_v2.mjs --execute-build-v2-recovery` | fixed catalog reads + exactly `SET statement_timeout = '10min'` + the five reviewed `CREATE INDEX CONCURRENTLY` lines |

Step 1 refuses unless Production is exactly the failed shape: the first v2 index present, an index in
`public` on `contractors`, GIN/`gin_trgm_ops`, exact wrapped expression, exact predicate, **`indisvalid =
false`**; the other four v2 names held by nothing; all five old canonical GINs and all five Phase-1 B-trees
exact and valid/ready/live; no index build active; and the relations whose names contain `nameorder` or
`namewords` are exactly those eleven. It then sends the one `DROP` (no `IF EXISTS`, no `CASCADE`), proves
all five v2 names are free, and proves the ten existing indexes are the same objects (oid), with the same
definitions and validity flags, as before. It never retries. If the `DROP` itself is cancelled by the
connection's timeout (it waits for conflicting transactions), the index is still present and still not
valid, the receipt records that, and a further run is a fresh, separately decided act.

Step 2 refuses — sending nothing but reads, not even the `SET` — unless the relevant relations are exactly
the ten existing indexes (so the failed index must already be gone), all ten are exact, no build is
active, `pg_trgm` is installed and the DDL sha256 matches. Only then: `SET`, read back (must be exactly
`10min`), and build one index at a time with the same per-index verification as P2E, re-proving the timeout
and the name's absence before each build. It stops on the first error, records (read-only) what a failed
build left behind, **never drops or repairs anything**, and writes a receipt even when stopped.

## 3. Why `SET statement_timeout = '10min'`

- Observed session ceiling on the managed connection: **2 min**. The first replacement build exceeded it.
- Comparable old Phase-2 builds took roughly **27–96 s** each.
- 10 minutes is a **bounded operational ceiling with substantial headroom**. It is not a claim that a build
  should take 10 minutes, and it is not unlimited: `statement_timeout = 0` is never used, so a stuck build
  is still cancelled.
- It is a plain session `SET` on the script's own connection: not `SET LOCAL` (no transaction may wrap
  `CREATE INDEX CONCURRENTLY`), not `ALTER ROLE` / `ALTER DATABASE` / `ALTER SYSTEM`, no `set_config`. It
  ends when the script closes its connection. It requires the Session pooler (the wrapper refuses 6543).
- No other setting is touched: `lock_timeout`, `work_mem`, `maintenance_work_mem`, `shared_buffers`, planner
  `enable_*` — none appear in anything the wrapper can send (self-check `otherSettingsNamed = 0`).
- Independent witness in the receipt: a fingerprint of `pg_db_role_setting` before the `SET` and after the
  last build; any difference stops the run with an explicit message.

## 4. Offline rehearsal (disposable in-memory Postgres; no real database reachable)

`npx tsx --test scripts/test_th_search_r1_019b_p2f_rehearsal.ts` — 9 tests covering the 13 required points:
cleanup refuses when the first v2 is absent (1), valid (2), when another v2 or an unexpected relevant
relation exists (3), when any Phase-1/old-Phase-2 reference is wrong, invalid or missing (4); sends exactly
one `DROP` on the exact failed state (5) leaving all five v2 names absent and the ten untouched (6); build
refuses while the failed index remains, sending not even the `SET` (7); timeout becomes and reads back
exactly `10min`, and a session that does not read back `10min` stops before any create (8); exactly five
creates after one `SET` (9); no persistent-setting command, other setting or unbounded timeout in anything
either wrapper can send (10); build stops on the first simulated failure, attempts nothing later (11) and
never drops what the failed build left — and then both wrappers refuse that different shape (12); success
yields 5 Phase-1 B-trees + 5 old canonical GINs + 5 v2 GINs (13).

## 5. 24-hour usage observation — preserved

The coordinator's `idx_scan` baseline (~2026-09-20 00:38 UTC) on the five old canonical GINs is 125 / 117 /
31 / 77 / 15. Neither recovery wrapper runs any query against `contractors` or `licenses` data: they send
catalog reads (`pg_class`, `pg_index`, `pg_namespace`, `pg_am`, `pg_opclass`, `pg_extension`,
`pg_stat_progress_create_index`, `pg_db_role_setting`), one `DROP` of a v2 index, one `SET`, and five
`CREATE INDEX` on new v2 names — none of which scans an old canonical GIN. No named pack, holdout or PR #86
candidate endpoint test is part of this packet or of the eventual recovery, and none was run while
preparing it.

## 6. After a successful Step 2

State is exactly the end of P2E Stage A+B: 15 objects. Stage C/D remains governed by the reviewed P2E
retire wrapper (`cbeec45b…`) and its own separate authorization, unchanged.
