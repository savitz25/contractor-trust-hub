# TH-SEARCH-R1-019B — review 2 (CHANGES_REQUESTED / HOLD RELEASE on `a1fa310`) — disposition

**Return state: `BLOCKED_PENDING_INDEX_APPROVAL`.** Same branch, same draft PR #86. Not merged, not deployed, no production
DDL, nothing purchased, no extension, no planner setting, no prewarm, no load test. Ask's Contractor adapter stays disabled;
Ask and Lender were not edited. Legacy v2 files are byte-identical to base `7b34589`; its pins are unchanged.

**This head must not be merged before the dependency below exists.** Its SQL is correct without the indexes but scans;
on production every name search would run out of time (shown honestly as "took too long", §4). The review-1 runtime is
preserved at `a1fa310` but implements semantics this review rejected.

## 1. Semantics are now defined independently of the access path — DONE

`lib/contractors/name-search-core.ts` states the candidate rule first and builds everything from it:

* apostrophes (`'` `` ` `` `‘` `’` `ʼ`) are **removed on both sides**, at any word length — the six-letter threshold is gone;
* ASCII punctuation/whitespace, NBSP, en/em dash and curly double quotes are **word breaks**;
* letters and digits of **any script are kept** (`JOSÉ` stays `JOSÉ`); case is folded by the database on both sides;
* legal-suffix words and `AND` are dropped from the supplied side only; initials and every later word stay required;
  a word of 3+ characters may begin a source word, a shorter one must equal one; words co-occur in one source field.

The predicate contains **no index condition and no condition on raw text**. The access path adds no parameter and is written
on the same normalized expression (test 15 asserts both structurally). No name-specific exception exists anywhere.

Reviewer counterexamples, all in the gate, both directions: `ONeil Plumbing` ⇄ `O'NEIL PLUMBING LLC`; `O'Neil Roofing` ⇄
`ONEIL ROOFING LLC`; `R T` / `R&T` / `r and t` ⇄ `R & T`, `R&T SERVICES`; `A B` ⇄ `A.B`; `Darcys Tile` ⇄ DBA `D'ARCY'S TILE`;
`Smith & Sons` ⇄ `SMITH AND SONS`; `José Builders` finds `JOSÉ BUILDERS`, `Jos Builders` finds both `JOS` and `JOSÉ`
(prefix rule), `Muller Sohne` does **not** find `MÜLLER & SÖHNE BAU` (no transliteration is claimed).
Separately noted: `O Neil Plumbing` (typed with a space) does not find `O'NEIL` — by the rule, `O` and `NEIL` are two words.

**Three checks that must agree (test 15, 38 names):** independent fixture expectations == the semantic predicate with **no**
access path (`buildSemanticNameMatchSql`, `FROM contractors c`) == the optimized query (both the single-statement access path
and tiered retrieval, same rows in the same order). A fourth SQL-free check: row evidence is derivable for every returned row.
Test 19 repeats the matrix with the proposed indexes physically present.

Behavior change to disclose: `%a%` is now the one-word name `A` (finds `A.B`), not an empty result; a name in a non-Latin
script is a valid name (it returns no candidates) instead of `invalid_name`.

## 2. Cold-search decision — two bounded alternatives

### A. Existing indexes — FAILS (measured, `alternative-a-existing-indexes.review2.json`)
The only raw-text condition the semantics imply is "the word's letters with optional apostrophes between them". Production
planner, statements planned but never executed: sequential scan of `contractors`, full-cost scans of the license trigram
indexes (96k + 77k cost units each), and for `R & T` a sequential scan of all 1.27 M license rows. Nothing selective can be
extracted; initials have no trigram at all. Independently of that, the five raw name trigram indexes are **368 MB against
256 MB of `shared_buffers`**, so they cannot stay resident — the review-1 cold/warm swing (14.8–18.9 s vs 0.23 s) is structural.

### B. Normalized-name expression indexes + tiered retrieval — the ONE proposed dependency
Tested locally only (in-memory PGlite fixtures and a 200k-row synthetic table; `index-design-local.review2.json`).

**Objects** (`PROPOSED-normalized-name-indexes.sql`, generated from the same constant the predicate uses; no new table,
column, function, extension or service; no copy of data):

| Phase | Index (×5: display, legal, DBA, credential licensee, credential DBA) | Serves |
|---|---|---|
| 1 | `btree (<normalized expr> text_pattern_ops) WHERE col IS NOT NULL` | strong tier: name equals / starts with the supplied name, initials included |
| 2 | `gin (<normalized expr> gin_trgm_ops) WHERE col IS NOT NULL` | every-word matches elsewhere in the name |

**Retrieval (implemented, tests 15/18/19):** strong tier first (rank 0–3). If it fills the page, the weak tier is **not run**.
Otherwise the token tier (rank 4) continues after it inside the *remaining* 6 s budget. If it cannot finish, strong candidates
are returned with `resultState: PARTIAL_TRUNCATED`, `completeness.wordMatchesElsewhereInName: NOT_COMPLETED`,
`continuation: RETRY_OR_VERIFY`. With nothing strong to show it stays `SOURCE_FAILURE` — never "no candidates". Pages walk
identically to one statement at limits 1/3/7 across the tier boundary. No timeout was changed.

**The two named blocking positives under B:** `R & T GENERAL CONSTRUCTION, INC` and unscoped one-word `Allied` are both
strong-tier reads (a range of an ordered index), needing no jurisdiction, prewarm, identifier or second request. Locally the
planner chose the proposed indexes for both, and for initials-only `R & T`, with no planner setting changed and no
sequential scan. **Whether they complete on a cold production cache is UNKNOWN until the indexes exist** (see risks).

**Footprint**
* Measured locally: normalized index ≈ raw index on the same column (btree 22.0 vs 21.6 B/row; GIN 62.1 vs 62.1 B/row).
* Estimated for production from the existing raw indexes' real sizes: phase 1 ≈ **0.26 GB** (≈68+70+64 MB for the three
  full columns, ≈27 MB each for the two DBA columns that are ~60% NULL); phase 2 ≈ **0.37 GB**. Total ≈ 0.63 GB on a 10.86 GB
  database (+6%). If the raw name trigram indexes are later retired (they serve only the old name query), net ≈ +0.26 GB.
* **Unknown:** provisioned/free disk, instance RAM — not visible through SQL; the owner must read them from the dashboard.
  `CREATE INDEX CONCURRENTLY` also needs temporary sort space roughly the size of the index being built.

**Maintenance / freshness:** ordinary expression indexes, maintained by Postgres inside the same write that changes the row.
No refresh job, no second clock, no staleness window; source freshness semantics are unchanged. Cost: ten more index entries
per inserted/renamed row (two regex passes per name). Ingestion write rate is unknown to me; bulk loads will be slower by an
unmeasured amount. `upper()` follows the database collation (`en_US.UTF-8`); an OS collation-version change would require a
REINDEX of these indexes like any other text index.

**Rollout (nonblocking):** one `CREATE INDEX CONCURRENTLY` at a time, off-peak, phase 1 first; verify `indisvalid`; `ANALYZE`;
plain `EXPLAIN` of the strong tier must name the new index; then re-run the frozen holdout once and the four browser flows;
only then consider merge. Phase 2 can wait: until it exists the token tier may time out and is *reported* as not completed.
**Rollback:** `DROP INDEX CONCURRENTLY`; code revert is independent (additive endpoint; native Verify returns to base behavior,
which timed out — rollback does not restore a working earlier search).

**Risks stated, not solved**
1. The strong-tier statement reads *every* row in the prefix range before ranking (it must, to pick the representative
   credential row). For `Allied` that is every name beginning with ALLIED plus one heap/credential fetch each. Cold, at the
   ~64 ms/read measured in review 1, that may still exceed 6 s. Phase 1 makes it a dense ordered range instead of 2,000
   scattered trigram candidates, but this is **an estimate until measured**.
2. 0.26–0.63 GB more index competes for the same 256 MB buffer pool. The ordered indexes' upper levels are small and hot;
   leaf ranges are contiguous. Not measured.

**Approval needed (none assumed):** owner authorization for production DDL (phase 1, optionally phase 2), confirmation of
disk headroom, a maintenance window choice, and who runs it. No prewarm schedule or larger instance is requested.

**Phase 1 preflight (2026-09-19):** read-only production preflight ran; see [PHASE1-PREFLIGHT.md](PHASE1-PREFLIGHT.md).
Everything checkable by SQL passed (opclasses/extension present, partial-predicate implication confirmed, no invalid
objects, no blocking activity). **Blocked before execution** on two dashboard-only fields Supabase does not expose to SQL:
provisioned disk headroom and storage-billing behavior. No DDL was run.

## 3. Measurement
No new production timing was taken: the final runtime depends on indexes that do not exist, so re-running the frozen
60-variant holdout would be 60 sequential scans of production tables and would measure nothing but the timeout. The holdout
is unchanged and frozen; runs 1–6 are kept. Review-1 figures restated in the requested form (run 6, review-1 runtime only):
end-to-end 59/60; completion-conditioned 59/59; `R & T GENERAL CONSTRUCTION, INC` original variant **failed** end-to-end (504),
its lowercase and suffix-removed variants passed only after the first attempt warmed the cache and are **not** counted as a
pass of the original. Per-variant rows are in `holdout-results.run6-…json`. No percentile is claimed anywhere.
The one re-run owed is after phase 1 exists.

## 4. Browser
Tooling gap closed: `scripts/th_search_r1_019b_browser.cjs` — fresh headless Chrome 153 context per run, explicit CSS viewport,
`deviceScaleFactor` 1 (`visualViewport.scale` 1, `devicePixelRatio` 1), real typed keys and a real keyboard **Enter**
(no iframe, no `requestSubmit()`), screenshots in `browser/`. Run on the final optimized build (`next build` + `next start`):

| Viewport | Typed | Result |
|---|---|---|
| 1280 | `R & T GENERAL CONSTRUCTION, INC` | submitted by Enter → `/verify?q=…`; **"took too long"**, query retained, no overflow |
| 390 | `Allied Roofing` | same: honest failure state, query retained, no overflow |
| 320 | (form only, no query) | no horizontal overflow |

So: the honest-failure flow is proven at normal zoom; **named positive → profile, ambiguous → separate cards and
pagination/refinement are NOT proven on this build** because it cannot complete a search without the indexes. The same script
runs those flows unchanged once phase 1 exists. Only two searches were sent, to avoid loading production.

## 5. Kept intact / gate
* R1-009 30/30, R1-010 39/39, con-cap-002 12/12, typecheck clean, optimized build succeeds. v2 files and pins unchanged
  (test 12). Public projection, exact-credential behavior, hard cap with non-divisor page sizes and `REFINE_SEARCH`
  (`reachesRowsBeyondCap:false`) unchanged (tests 9, 14).
* Gate: 19 groups, CI-wired as before. New: 15 (three-way), 18 (tiering, partial truth), 19 (local index design).
* Mutations **17/17 detected**, exact bytes restored. New: **M6 restores a raw-fragment gate → `ONeil Plumbing` loses
  `O'NEIL PLUMBING LLC`, 4 tests fail**; M12 source apostrophe becomes a break; M14 non-ASCII deleted; M15 unfinished tier
  reported complete; M16 weak scan run in front of a full strong page; M17 tier-boundary offset.
* Still separately recorded, not repaired: legacy v2 `runCohortRows` COUNT timeout; native Verify routes digit-shaped input
  (`ACE 2000`) to its license branch before name search.
* Native impact is real: native Verify name search uses the same core (single statement, every-word access path) and
  therefore has the same index dependency.
* Contract: response gained `completeness`; **schemaFingerprint is now
  `ac344bfdda58296b163f8ea6737a36b1e44c1af99b3e252e39cae4d08b822fc3`** (was `f1a99879…`). `name.indexFragments` was removed.
  Ask must map `PARTIAL_TRUNCATED` + `completeness.wordMatchesElsewhereInName = NOT_COMPLETED` as partial, never as a miss.
