# BROAD_GENERIC_SEARCH_HEADROOM_FOLLOWUP

Recorded 2026-09-21, TH-SEARCH-R1-019B-P2M, as the accepted (not fixed) known limitation
carried into PR #86's merge, per the Founder decision from TH-SEARCH-R1-019B-P2L.

## Problem

A bare/generic name term against `/verify` — proven example: **`Construction` in `FL`** —
produces approximately **51,764 real contractor-side prefilter candidates** (contractor-side
alone; the licenses-side `UNION` branch adds more). The shared name-search prefilter
(`lib/contractors/name-search-core.ts`'s `buildNameMatchSql`, `access: "all"`) is a `UNION` of a
`contractors` branch and a `licenses` branch feeding a dedup step (`Unique`/`HashAggregate`) that
must fully materialize the entire candidate universe from both branches before any row can be
emitted to the outer `LIMIT`. For a term this common in the largest covered state, that
materialization alone exceeds the statement timeout, producing a `SOURCE_FAILURE` ("search took
too long") in the UI.

## Proof this is pre-existing and orthogonal to P2J (TH-SEARCH-R1-019B-P2L)

Controlled, interleaved, read-only A/B test, same machine/DB/config/Node version, two isolated
worktrees:

- **Baseline** `f00ba0bc4f5c16a97916c45c3a396cbaa9b22cf8` (pre-P2J, plain `JOIN` join-back):
  **5/5** `Construction`/FL observations → `SOURCE_FAILURE` (`canceling statement due to
  statement timeout`).
- **Candidate** `307ded406dc21a311a41e41a7f162a6676027c27` (P2J, `LATERAL` join-back): **5/5**
  `Construction`/FL observations → identical `SOURCE_FAILURE`, statistically indistinguishable
  timing (8499–9139ms across both SHAs combined).
- `EXPLAIN (ANALYZE, BUFFERS)` on both shows an **identical upstream plan structure** (`Gather →
  Parallel Append → Parallel Bitmap Heap Scan on contractors + Parallel Index Scan on licenses →
  Unique`, ~52,173 candidate rows gathered before any row can emit). The join-back itself is cheap
  on both (plain JOIN: ~0.11ms×26 loops; LATERAL: ~4.6ms×26 loops) — negligible against the total.

**Conclusion: the LATERAL join-back rewrite (P2J) is not the source of this failure and does not
worsen it.** The cost is entirely in the shared prefilter's `UNION`+dedup step, present
identically before and after P2J.

Full A/B methodology and raw observations: see the TH-SEARCH-R1-019B-P2L session report (not a
committed file; reproducible via the same interleaved-probe method against isolated worktrees at
the two SHAs above).

## Disposition

- **Classification: `PRE_EXISTING_ORTHOGONAL`.** Confirmed by direct controlled evidence, not
  inference.
- **Not fixed in P2J, P2K, P2L, or P2M.** No query redesign, materialized-CTE fallback, timeout
  inflation, or index change was attempted for this limitation in any of those tickets, per each
  ticket's explicit scope boundary.
- **Not a blocker for PR #86 / this release.** P2J is a net-positive, confirmed fix for the
  actual in-scope regression (see `docs/qa/th-search-r1-019b/P2K-BROWSER-QA.md` for the Allied/
  R&T/Whaleys/Worsham/Cook A/B evidence — baseline fails these reliably, P2J-candidate succeeds
  reliably). Construction/FL ties baseline-vs-candidate on failure; it does not regress under the
  merged candidate relative to what was already true beforehand.

## Future problem statement (not designed or chosen here)

Possible directions for a **future, separately-scoped** ticket — none selected, none implemented:

- Minimum-specificity gating for extremely generic `/verify` name-search terms (e.g. require a
  second distinguishing word, or a length/frequency floor, before running the full prefilter).
- A bounded-candidate strategy for the prefilter (e.g. an early `LIMIT` inside the `UNION`
  branches themselves, accepting partial/first-N semantics for pathologically broad terms).
- Discovery-mode routing: recognize a bare generic term as a discovery-style query (browse by
  trade/count) rather than a specific-identity name search, similar to the existing
  `isDiscoveryQuery` classifier already used on `/search`.
- An alternate broad-prefilter execution strategy that does not require full materialization
  before the outer `LIMIT` can apply.

Solution selection and implementation are explicitly out of scope until a future ticket picks
this up.
