# TH-SEARCH-R1-019B — review 1 (CHANGES_REQUESTED on `3a22d7b`) — disposition

Same branch, same draft PR #86. Not merged, not deployed. **Ask's Contractor adapter is still disabled; nothing in Ask
or Lender was edited.** Legacy v2 files remain byte-identical to base `7b34589` and its pins are unchanged.

The coordinator's review read the code and ran literal probes; it did not rerun the PGlite suite, production timings or
the browser checks. Everything below labelled "measured" was run by the builder in this pass.

## Finding 1 — match a source name, not a concatenated artificial name — ACCEPTED AS DECIDED, documented

The per-field rule stays. `GULF COAST` / `PEREZ, MARIA` is found by "Gulf Coast" and by "Perez Maria" (matched field
`legal_name`, whose label says it may be the qualifying individual, not the business); "Perez Gulf" is not a source name
and matches nothing.

**Behavior change for native Verify name search (stated plainly):**
* Removed: matching words spread across different name fields.
* Removed: matching a supplied word *inside* a source word. Words now match on word boundaries — a word of 3+ characters
  may begin a source word (`stilw` → `STILWELL`), an initial must equal one. `well solar` no longer finds `STILWELL SOLAR`.
* Added: apostrophe and `AND`/`&` equivalence, all words required (not only the first four), initials required.
* Unchanged and out of scope: native Verify still routes digit-shaped input such as `ACE 2000` to its license-key branch
  before name search (`looksLikeLicenseKey`). The callable operation never does. Not redesigned here.

The earlier report's sentence "no working behavior is lost" was wrong and is withdrawn: several baseline native queries
timed out, but that does not show every native path behaved identically. What the gate proves is narrower: for the same
declared scope, native name search and the operation return the same public identities (test 13), from one SQL builder.

## Finding 2 — prefilter false negatives — FIXED

Cause confirmed: all-initial names produced a fused fallback token (`R T`, `A B`) which was treated as indexable and
required verbatim in the raw column; `R & T` does not contain `R T`.

Fix (general, no literal names): terms are single words; initials are terms but never index fragments. The index rule is
now part of the predicate itself — per field, `indexRule(raw) AND wordRule(normalized)` — and the prefilter applies that
same per-field rule. It is a superset by construction, not by argument. When no word can drive an index, the index rule
is "raw field contains the supplied text" and the predicate requires that too.

Test 15 runs the **complete unprefiltered predicate** and the optimized query against the same in-memory Postgres for a
16-name matrix (initials, punctuation, fallback, alias field, credential-row field, long names, numeric-leading, a
Stilwell-style ordinary control, a cross-field negative) and asserts `optimized == complete == independent expectation`.
Red before: on `3a22d7b`, "R & T" and "A.B" return nothing (mutation M6 reproduces that defect and is detected).

## Finding 3 — meaningful terms and truthful evidence — FIXED

* Every word is required: initials (whole-word match only, never a letter inside a word) and words after the fourth.
  "R & T GENERAL CONSTRUCTION" no longer equals "General Construction"; "… Estate Alpha" no longer matches "… Estate Beta".
* `deriveNameMatchEvidence` uses the same rules as the SQL and returns `matchedWords` (supplied word → source word).
  Its explanation lists exactly the words that were matched. It returns `null` for both reviewer counterexamples.
* Apostrophes: `OBrien Sons Plumbing`, `o’brien and sons plumbing co`, `Obrien Sons` all find `O'BRIEN & SONS PLUMBING CO.`,
  labelled `NORMALIZED_NAME` (never `EXACT_SOURCE_NAME`). Live: "Whaleys Air Conditioning" finds `WHALEY'S AIR CONDITIONING INC`;
  "Brown and Root Industrial Services" finds `BROWN & ROOT …`.
  Exact limit, stated because the predicate enforces it: an apostrophe the customer did **not** type is bridged only for
  words of six or more letters and only after the first letter or before the last (`OBRIEN`, `MCDONALDS`). `ONeil` does not
  find `O'NEIL`; `O'Neil` and `O Neil` do. No DBA is invented, no identities merged, exact-credential rules untouched.
* `NAME_CONTAINS` was removed from this contract's match methods (nothing can produce it). New contract fingerprint below.

## Finding 4 — strong matches, performance, continuation

**Rank — FIXED.** Tiers: 0 display name equals the name (optional legal suffix), 1 another name field equals it,
2 display name starts with it, 3 another field starts with it, 4 contains every word. Test 17: exact `YARROW WORKS, INC.`
is first although 210 `YARROW WORKS nnn` siblings sort before it and would otherwise push it past the 200-row cap.
Representative credential row is chosen by name strength first, then active/current, then recency: an expired exact
source row is not displaced by an active row that merely contains the name (test 17; mutation M13).
Native (live): "Allied Roofing" now lists `ALLIED ROOFING INC` first.

**Pagination — FIXED.** The last window is clamped to the rows remaining under the cap: page 9 × 24 returns 8 rows, page 10
is `invalid_page`. For limits 7, 10, 20, 24, 25 exactly 200 distinct rows are reachable (test 9; mutation M11).
The cap action was inspected: native Verify shows its own first page and cannot continue past row 200. It is now
`type: "REFINE_SEARCH"`, `reachesRowsBeyondCap: false`, with text saying so. No cursor is advertised. `total` stays `null`.

**Holdout — unchanged frozen sample, original variants, all runs kept.**

| Run | Runtime | Found p.1 | Source timeout | Miss |
|---|---|---|---|---|
| 1–3 | pre-review (see README §7) | 29 / 48 / 57 | 31 / 12 / 3 | 0 |
| 4 | review-1, before the fragment rule was tightened | 59 | 1 | 0 |
| 5 | review-1, fragment rule tightened | 59 | 1 | 0 |
| **6** | **review-1 final runtime** (after run 5 the "starts with" rank tier became word-prefix aware; ranking only) | **59** | **1** | **0** |

Run 6: completed-query recall 59/59; end-to-end recall 59/60; median 317 ms; 4 of 60 over 3 s; 1 over 5 s. Runs 4 and 5 failed on the same single variant.
The failed variant is `R & T GENERAL CONSTRUCTION, INC` as displayed (first, cold hit, 6.3 s → 504). The same record was
then **found by name**: lowercase 4.6 s, suffix-removed 0.5 s. It is not dropped from the sample and is not called passing.

**HTTP, scoped vs unscoped (`live-controls.review1.json`; single observations, not percentiles).**
R&T unscoped: 504, 504. R&T scoped `MS`: 0.67 s and 0.56 s. `General Construction`: 504 (and no longer R&T-equivalent).
Stilwell Solar: 1.26 s first, 0.30 s scoped/repeats. Allied unscoped: 504 then 4.5 s; scoped `FL` 0.34 s.
A `stilw` timeout in that run exposed a 3-letter index fragment (`TIL`); the fragment rule was tightened afterwards and
runs 5 and 6 are on the tightened rule (`stilw` rechecked on the final runtime: 5 candidates, 4.5 s).

**Query plan (`query-plan-cold-vs-warm.review1.json`, `query-plans.json`).** Scoped and unscoped plans are identical:
bitmap index scans on all five name trigram indexes, no sequential scan, and — after moving the full per-field rule into
the prefilter — 2,093 of 2,096 index candidates are discarded at the heap scan, so **3 rows** reach the joins.
Same statement, minutes apart: **14.8–18.9 s cold, 0.23 s warm**. Pages searched 10–20 minutes earlier were already cold
again. `Allied` shows the same swing (9–11 s and one >30 s cold; 0.09–0.34 s warm).

**Conclusion, stated as a blocker rather than a pass:** with the existing indexes this is the minimum work for the
predicate. Remaining latency for common-word names on a cold cache is set by page residency in the database, which code
in this PR cannot change. No timeout was raised, no index or schema added, nothing purchased, publication not weakened.

Smallest dependency, for explicit authorization (none started):
1. keep the five name trigram indexes resident (`pg_prewarm` on a schedule, or a larger instance/cache) — no code change; or
2. a narrow normalized-name column with a `text_pattern_ops` index so equality/prefix tiers can be read in order with a
   `LIMIT` — a schema/index change.

## Finding 5 — enforcement and verification

* `check:th-search-r1-019b` is wired into `.github/workflows/contractor-network-metrics.yml` (PR + push to main). It uses
  in-memory PGlite fixtures only: no secrets, no network, no production source. Exact-head CI result is in the PR.
* Gate: 17 groups (the original 15, expectations corrected where they contradicted the candidate spec — notably the
  apostrophe case — plus 15 oracle matrix, 16 terms/evidence, 17 rank/representative row).
* Mutations 13/13 detected, exact bytes restored (`mutation-report.json`): the original five plus fused pseudo-word,
  initials dropped, first-four-words only, initial matches inside a word, no equality tier, unclamped last window,
  apostrophe not equivalent, representative row ignoring name strength. M13 initially survived; the fixture was too weak
  (the "unrelated" row did not match at all) and was strengthened.
* Regressions: R1-009 30/30, R1-010 39/39, con-cap-002 12/12, pa-rel-001 4/4, typecheck clean, optimized build succeeds.
  Unchanged baseline failures, reproduced on unmodified `main`: `check:con-search-001`, `check:th-search-001a`/`test:ask`
  (P2 snapshot count), `check:ath-cap-pilot-001`.
  Local-only, in data this diff does not touch: `test:nc-con-001` needs an untracked raw CSV; `test:oh-con-001` reports a
  CSV checksum mismatch. **Its cause was not investigated**; the earlier "Windows line endings" remark was a guess and is withdrawn.
* Browser: see `browser/native-flows.review1.json`. **Unresolved evidence gap:** the automation window lays pages out at
  4800 CSS px (~33% effective zoom), cannot be resized or re-zoomed by the tool, and keystrokes did not reach the input.
  Normal-zoom usability, a real keyboard Enter and screenshots are therefore not established. What was exercised: real form
  submission and a real link click inside frames fixed at 1280 / 390 / 320 CSS px — results, profile open, no overflow.

## Finding 6 — legacy v2 and Ask stay separate — UNCHANGED

This endpoint does not repair legacy v2. Reproduction (production, 2026-09-18): `GET /api/specialist-execution/v2?state=FL&identifier=CBC015082`
and `…?state=FL&trade=roofing&county=broward` → 503 `BACKEND_UNAVAILABLE` after ~10.4 s. Failing path:
`executeContractorSpecialistQuery` → `runCohortRows` → `SELECT COUNT(*) … FROM licenses l JOIN contractors c …` hits its
10 s statement timeout (server log on the local build shows the same statement cancelled). Not modified.

## Handoff values for the Ask owner (after review; nothing activated)

* Endpoint `GET|POST /api/specialist-execution/name-candidates/v1`, contract `contractor-name-candidates-v1`, version `1.0.0`.
* **schemaFingerprint `f1a998790cd8c31c6261a432172cd192e42d489b6f7a8b5cdaf346c14e2bc1f3`** (changed from the first candidate because
  `NAME_CONTAINS` left the method list). Legacy v2 pin `4c220137…0f79b5` is untouched.
* Mapping is README §9, with these updates: `name.requiredWords` now lists every enforced word; `match.matchedWords` is new;
  match methods are `EXACT_SOURCE_NAME | NORMALIZED_NAME | DOCUMENTED_ALIAS | PREFIX_OR_TOKEN`; at the cap,
  `continuation.type` is `REFINE_SEARCH` with `reachesRowsBeyondCap: false` — map it to a research/refine action, not a
  "more results" continuation (`truncatedWithoutCursor` should be **true**); on failure `continuation.type` is `RETRY_OR_VERIFY`.
* Ask should expect `504 SOURCE_FAILURE` for common-word names on a cold cache and must keep treating it as a technical
  failure, never a miss. Supplying `jurisdiction` when the planner has one does not change the plan, but a repeat within
  minutes is typically sub-second.

## Rollback

The operation is additive and opt-in: no consumer calls it, so reverting the PR (or the merge commit) removes it with no
consumer impact. The one shared-path change is native Verify name search. Reverting restores the previous native query,
which timed out in production on base — i.e. rollback returns native name search to "search took too long", not to a
working state. No data, schema, index, environment or platform setting is changed by this PR.
