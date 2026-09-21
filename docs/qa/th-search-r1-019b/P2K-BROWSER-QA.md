# TH-SEARCH-R1-019B-P2K — Browser QA (mandatory gate, real interactive Chrome)

Captured 2026-09-21 against reconciled PR #86 head `179bbebd1950e0d682ed437f13d240ee41bd4340`,
served by a dedicated `next dev` instance started in this exact worktree on `localhost:3777` (not
a shared/unrelated dev server) so the browser exercised the reconciled code, not a stale build.

The real UI path for this ticket's fix is `/verify?q=<name>&state=<slug>`
(`app/verify/page.tsx` → `searchContractors` in `lib/contractors/queries.ts` → the shared
`buildNameMatchSql`/`fromSql` in `lib/contractors/name-search-core.ts`, the exact function P2J
rewrote). The `/api/specialist-execution/name-candidates/v1` route uses the same shared core but
has no UI caller in this app; `/verify` is the real, user-facing surface for this fix.

One flow (WHALEY'S AIR CONDITIONING INC) was driven by real clicking/typing through the search
box to confirm the interactive path end-to-end; the rest were driven by direct navigation to the
same URL the form itself produces (`router.push`-based GET), which exercises the identical
server-rendered code path.

## Results

| Flow | Query | State | Outcome | Evidence |
| --- | --- | --- | --- | --- |
| Exact name + apostrophe | `WHALEY'S AIR CONDITIONING INC` (typed via search box) | FL | **PASS** | Single result, CAC1813195, Bonita Springs/Lee/FL — correct identity, no console error |
| Strong-normalized (lowercase + punctuation) | `landmark homes, inc.` | MS | **PASS** | Single result, LANDMARK HOMES, INC., Jackson/MS |
| Partial/token (dropped `&`, dropped `LLC`) | `Brown Root Industrial` | LA | **PASS** | Correctly resolved via token tier to BROWN & ROOT INDUSTRIAL SERVICES, LLC |
| Punctuation variant (`&` spelled as "and") | `R and T General Construction` | MS | **PASS** | Correctly resolved to R & T GENERAL CONSTRUCTION, INC |
| Ampersand (literal `&`) | `R & T General Construction` | MS | **PASS** | Same correct single result |
| Accented Unicode | `José Builders` | FL | **PASS** (also serves as a no-result case) | Clean "No matches" state, no crash, no console error |
| Numeric-leading | `7 Angels Const` | WA | **PASS** | Single result, 7 ANGELS CONST LLC |
| No-result | `Zzzznonexistentcompanyxyz999` | FL | **PASS** | Clean "No matches" state, fast, no error |
| Ambiguous/multi-candidate (narrow) | `Cook` | KY | **PASS on 3 of 4 attempts** — see finding below | 1st attempt: `SOURCE_FAILURE` (statement timeout); 3 immediate retries: clean single-result success each time |
| Ambiguous/multi-candidate (broad, generic single word) | `Construction` | FL | **FAIL — reproduces 2/2** | `SOURCE_FAILURE`: "Search is temporarily unavailable... search took too long" |

No console errors or exceptions were observed on any flow, including the two failures — the
server-side timeout is caught and rendered as a friendly error state, not a client crash.

## The `Construction`/FL failure — root cause and scope

Server log (`[db] query kind=query_timeout msg=canceling statement due to statement timeout`)
confirms this is a real Postgres `statement_timeout` cancellation, not an application bug or
crash.

A read-only diagnostic count using the exact contractor-side predicate `name-search-core.ts`
itself builds (`(' '||upper(regexp_replace(display_name,'[^A-Za-z0-9]+',' ','g'))||' ') LIKE
'% CONSTRUCTION %'`) found **51,764 real contractor-side matches for "CONSTRUCTION" in FL alone**
(contractor-side only; the licenses-side UNION branch adds more). This is a plain common English
word matched against the single largest state's contractor pool — a very different regime from
any of this ticket's named test cases (Allied's ~482 candidates is the largest in the official
pack).

A read-only `EXPLAIN (ANALYZE, BUFFERS)` of the query shape (using a close approximation of the
real predicate, 60s diagnostic timeout, read-only transaction) shows the LATERAL join-back itself
is **not** the bottleneck: with the outer `LIMIT` pushed down, the `Index Scan using
contractors_pkey` side only runs 26 times (~11ms each, ~291ms total) — cheap, exactly as P2J's
own design intends. The actual cost is entirely upstream, in the prefilter's own `UNION` +
`HashAggregate`, which cannot emit any row until it has consumed and deduplicated the *entire*
combined candidate set from both the `contractors` and `licenses` branches (tens to hundreds of
thousands of rows for a term this common) — a property of the UNION/dedup step, not of the
join-back shape. This mechanism is unaffected by whether the join-back is P2J's `LATERAL` or the
prior plain `JOIN`; both would have to wait on the same upstream materialization. On that basis
this reads as a **pre-existing, orthogonal scalability characteristic of broad, generic
single-word name searches against the largest state**, not a regression introduced by the P2J
reconciliation — but this was not independently verified by running the literal pre-P2J code, so
it is reported as reasoned-but-not-proven, not confirmed fact.

This was surfaced only because Section 3 of this ticket requires exercising an
"ambiguous/multiple-candidate" flow with real interactive browser access, which the previous
session could not do. It is a genuine finding, distinct from and more severe than the
already-documented Allied 6727ms `HEADROOM_WATCH` event:

- **Allied** (existing `HEADROOM_WATCH`): a specific, named, moderate-cardinality (~482
  candidates) case; one exploratory cold-cache-like event, not reproduced on either required gate
  run or on repeated EXPLAIN checks this session.
- **`Construction`/FL** (this finding): a generic, unnamed, extremely-broad-cardinality (~52k+
  candidates) case; reproduces 2 times out of 2 attempts.

Per the ticket's explicit instructions, no query redesign, materialized-CTE fallback, or other
code change was attempted in response to this finding — it is reported for Founder decision, not
acted on.

## `Cook`/KY single transient event

One `SOURCE_FAILURE` on the first attempt, not reproduced on 3 immediate retries (same query,
same state, same session). Consistent with the same cache/I-O-pressure variance pattern already
documented for Allied — recorded honestly, not escalated, since it did not reproduce under
controlled repetition.
