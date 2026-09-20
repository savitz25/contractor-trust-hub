# TH-SEARCH-R1-019B-P2E — Production index transition packet

**PROPOSED. NOTHING IN THIS PACKET HAS BEEN EXECUTED.** No stage may run until these exact bytes are
independently reviewed and the owner authorizes that specific stage.

| Artifact | sha256 |
|---|---|
| `docs/qa/th-search-r1-019b/PROPOSED-namewords-v2-indexes.sql` | `4aefa3644d622c43616113c60d55ff206a926b071875e87cd1f7ed413c7e644e` |
| `scripts/th_search_r1_019b_p2e_build_v2.mjs` | `454e77dc6505bb10b2f556aa3aa49c09df26d433f3abf0316f6dd1b8b4397325` |
| `scripts/th_search_r1_019b_p2e_retire_old.mjs` | `cbeec45be7718f71ab13109dc62afab9654a72da024e035a0b4266d74f8d64cf` |

Reviewed runtime candidate: branch `th-search-r1-019b-p2d-access-path`, commit
`c6d3435eefa2bfbb71890c2fbbf8a02581e28b9b` (remote == local). PR #86 head stays `9bcf524…` until Stage F.

## 1. Why the order is build → verify → retire → rename → prove → advance

The candidate leaves the strong tier's predicate on the **bare** normalized expression. The five old Phase-2
GIN indexes are on that same bare expression, so while they exist the planner may still pick them for the
strong tier — exactly the confirmed regression. Deploying the candidate first would therefore not isolate
the strong tier. The old GINs must be gone **before** the candidate is judged. PR #86 is unreleased and
current `main` contains no SQL on the normalized expression (§4), so the old GINs serve no released code.

| Stage | What | Script | Authorization |
|---|---|---|---|
| A | Build five `*_namewords_v2_idx` GINs on `(normalized \|\| '')`, one at a time, `CONCURRENTLY`, no `IF NOT EXISTS` | `p2e_build_v2.mjs --execute-build-v2` | owner, Stage A |
| B | Verify each: valid/ready/live, gin, `gin_trgm_ops`, exact wrapped expression, exact predicate, size | same run (per index, before the next starts) + independent read-only catalog check | — |
| C | Retire the five old bare-expression `*_namewords_idx` (`DROP INDEX CONCURRENTLY`, one at a time, not atomic) | `p2e_retire_old.mjs --execute-retire-old --owner-authorized-stage-c-and-d` | **separate** owner authorization |
| D | Only after all five canonical names are free: `ALTER INDEX … RENAME TO` canonical | same run as C | same as C |
| E | Final shape live, PR #86 **not** deployed: run candidate `c6d3435` locally against Production data; §5 gate | read-only | owner |
| F | Only if E is green: advance PR #86 to the reviewed candidate, begin release review | — | owner |

Temporary footprint during A–C: old GINs (~288 MB) + new GINs (expected similar) coexist. Confirm disk
headroom before Stage A.

**Stopping points.** A failed `CONCURRENTLY` build leaves an INVALID v2 index; the build wrapper never
removes anything and refuses to run again while that name exists. Stage C/D is not atomic; if it stops
part-way, rerunning refuses by design (precondition D fails). In both cases the receipt records exactly
what completed and the next step is a separately reviewed decision, never an automatic retry. At every
stopping point all five Phase-1 B-trees and all already-verified replacements remain present and valid.

**Rollback.** Before Stage C: nothing to roll back functionally (v2 indexes are unused by any released code;
dropping them would be its own reviewed step). After Stage C: the old bare GINs can be rebuilt from
`PROPOSED-normalized-name-indexes.sql` (sha256 `247d60cd…`), but there is no reason to — they are the
mechanism of the regression and no released code can use them.

## 2. Final expected Production inventory (exactly ten)

B-tree, `text_pattern_ops`, **bare** normalized expression, `WHERE <field> IS NOT NULL` (untouched throughout):
1. `contractors_display_name_nameorder_idx`
2. `contractors_legal_name_nameorder_idx`
3. `contractors_dba_name_nameorder_idx`
4. `licenses_licensee_name_raw_nameorder_idx`
5. `licenses_dba_name_raw_nameorder_idx`

GIN, `gin_trgm_ops`, **wrapped** expression `(normalized || '')`, `WHERE <field> IS NOT NULL`:
6. `contractors_display_name_namewords_idx`
7. `contractors_legal_name_namewords_idx`
8. `contractors_dba_name_namewords_idx`
9. `licenses_licensee_name_raw_namewords_idx`
10. `licenses_dba_name_raw_namewords_idx`

No `*_namewords_v2_idx` remains. No GIN on the bare normalized expression remains. These are exactly the ten
names `NORMALIZED_NAME_INDEXES` generates in the candidate. The retire wrapper asserts this inventory,
including expressions, before reporting success. Pre-existing raw-column `*_trgm_idx` indexes are out of
scope and untouched.

## 3. Local rehearsal (disposable in-memory Postgres; no real database reachable)

`npx tsx --test scripts/test_th_search_r1_019b_p2e_rehearsal.ts` — 9/9. Drives the wrappers' real `run()`
from Production's current shape: DDL file == what the code renders; pinned deparsed expressions == what
Postgres reports; retire refuses before build; build sends exactly 5 creates; build refuses a second run
(existing name stops it); retire refuses on wrong-expression replacement, INVALID replacement, and
wrong-shape old index — sending zero non-read statements each time; retire sends exactly 5 drops then 5
renames, never naming a `nameorder` index; Phase-1 indexes keep the same oids and definitions; final
inventory equals the code's ten names; retire refuses a second run; candidate queries run on the final shape.

The pinned bare expression was additionally compared, offline, with Production's own `pg_get_indexdef`
output captured during Phase-1 verification (PG 17.6): exact match for all five fields.

## 4. Current-Production safety smoke plan (current deployed `main`, before and after Stage C/D)

Static evidence: `origin/main` (`7b34589…`) has no SQL on the normalized expression (`git grep regexp_replace
origin/main -- lib app` finds only an unrelated JSON-name expression in `entity-lineage.ts`); its name search
is `LOWER(COALESCE(col,'')) LIKE ANY(...)`. PostgreSQL matches expression indexes syntactically, so released
code cannot use any of the ten indexes. This is evidence, not the acceptance test. The acceptance test:

0. Record the deployed commit of Production (must be confirmed, not assumed equal to `origin/main`).
1. **Usage precheck (read-only, before Stage C):** snapshot `pg_stat_user_indexes.idx_scan` for the five old
   `*_namewords_idx`; snapshot again after ≥24 h of normal traffic with **no** PR-86 testing in between.
   Any increase means something released (or another consumer of this database) uses them → STOP, do not
   authorize Stage C.
2. **Smoke matrix — run once immediately before Stage C and once immediately after Stage D**, same cases,
   sequential, ≥5 s apart, against the public Production site; record HTTP status, elapsed, and a stable
   content marker for each:

| # | Path (current main) | Marker |
|---|---|---|
| 1 | `/verify?q=<business name>` — Verify name search (e.g. "Stilwell Solar", "Allied") | 200, result list, expected profile present |
| 2 | `/verify?q=<exact license number>` — exact identifier search | 200, exact record first |
| 3 | `/search?q=<business name>` — general entry; on main it redirects into `/verify` (or `/ask`) | same redirect target as before, then 200 |
| 4 | `/florida` and one `/florida/[segment]` and one `/florida/[segment]/[facet]` | 200, non-empty |
| 5 | `/ohio` (live on main) | 200 |
| 6 | `/contractors/<real slug>` and `/contractors/<real slug>/summary` | 200, name + credential rendered |
| 7 | `GET /api/specialist-execution/v2` (capability document) | 200, fingerprint unchanged |
| 8 | `POST /api/specialist-execution/v2` legacy exact-credential request | **same** status/body class as before — its known unrelated 503 defect is recorded, not fixed; pass = unchanged |

   Not in this matrix, deliberately: `/api/specialist-execution/name-candidates/v1` (does not exist on main)
   and `/api/network-metrics` (`force-static` from a build-time manifest; never queries the database, so it
   cannot detect an index change).
3. **Acceptance:** planner choices may change; no case may move from working to failing, no new 5xx, no
   elapsed regression beyond ordinary run-to-run variation on a case that does not touch these indexes.
   Any new functional regression → stop before Stage E and review (old GINs are rebuildable).

## 5. Final pre-release performance gate (Stage E — after final shape, before PR #86 advances)

Exact candidate `c6d3435`, fresh `next start` runtime from a clean worktree (PID/SHA/start/port recorded),
nothing else running against the worktree, no mutation/gate run concurrently.

1. **Catalog:** the ten-index inventory of §2, all valid/ready/live, expressions exact.
2. **Plain `EXPLAIN` (never `ANALYZE`)** for strong + token tier of: Allied, Stilwell Solar, stilw,
   R & T GENERAL CONSTRUCTION, INC. Criterion is what **serves the real match condition** (an index scan
   line with an attached `Index Cond`), not whether a name appears:
   - strong: `*_nameorder_idx` serves it; `*_namewords_idx` must NOT;
   - token: `*_namewords_idx` serves it; no sequential scan of `contractors`/`licenses`.
   Any failure → STOP; do not run the timed pack.
3. **Named pack**, two isolated runs, sequential, ≥5 s apart, 60 s quiet between runs:
   Stilwell Solar · STILWELL SOLAR, LLC · Worsham Construction · Whaley's Air Conditioning ·
   R & T GENERAL CONSTRUCTION, INC. · Allied · stilw · Stilwell Solar @ FL · Stilwell Solar @ TX.
4. **Only if the pack is healthy:** the unchanged frozen 60-variant holdout, exactly once.

Reference points (no statistical target is set): Phase 1 only — 51/60 FOUND_PAGE_1, 9/60 SOURCE_ERROR;
Phase 1 + old bare GINs — isolated pack 8/9 then 9/9 SOURCE_FAILURE (the contaminated 7/60 holdout is not
cited as clean evidence).

Acceptance: no broad ~6 s timeout collapse; expected identities retrieved; strong and token tiers report
completion truthfully; a miss is reported only after full completion (TX honest miss = completed, zero
candidates, not an error); a failure is never converted to a miss. One run is never called p95.

## 6. Known open points for reviewers

- Whether any consumer other than this repo's released code queries this database on the normalized
  expression is answered empirically by §4 step 1, not assumed.
- `DROP INDEX CONCURRENTLY` waits for conflicting transactions; the wrapper sets no `lock_timeout` (no
  setting changes). A long wait is safe but should be run when no long transaction is open; the owner can
  check `pg_stat_activity` first.
- Positive proof that the wrapped GIN serves the token tier at Production scale can only exist after
  Stage A; it is an explicit Stage E criterion.
