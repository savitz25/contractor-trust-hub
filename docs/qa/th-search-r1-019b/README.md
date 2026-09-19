# TH-SEARCH-R1-019B — Contractor name-candidate operation (integration handoff)

Status: `READY_FOR_ASTRA_REVIEW — CONTRACTOR_OPERATION` (review-1 correction pass). Draft PR only. Not merged, not deployed.

> **Read `REVIEW-1.md` first.** It is the disposition of the CHANGES_REQUESTED review on `3a22d7b` and supersedes this file
> wherever they differ. Sections 4, 6, 7 and 8 below were rewritten for the corrected runtime.

**The Ask parent adapter is NOT activated by this change.** `contractorNameAdapter` in Ask
(`lib/network/name-candidates/adapters.ts`) stays `enabled: false`. Nothing in Ask was edited.

Base: `7b3458990a81817b1ca41993056925935c67aa84` (Contractor `main`).

## 1. What this is

A bounded, source-backed callable operation that lets a consumer supply **only a name** and get
relevant public ContractorTrustHub profiles back as candidates — no trade, credential number or
jurisdiction required to start browsing.

| | |
|---|---|
| Endpoint | `GET`/`POST` `/api/specialist-execution/name-candidates/v1` |
| Contract | `contractor-name-candidates-v1`, `contractVersion` `1.0.0`, own `schemaFingerprint` |
| Capability document | `GET` with no parameters |
| Engine | `lib/contractors/name-search-core.ts` — the same predicate, rank and normalization native Verify uses |

### Why a separate endpoint instead of a field on v2

Ask pins Contractor's v2 `contractVersion` **and** `schemaFingerprint` fail-closed
(`lib/guided-research/specialists.ts`: a mismatch returns `BACKEND_UNAVAILABLE` for every cohort and
identifier dispatch). v2's fingerprint hashes its request field list, so adding `identityName` there
would take down every existing caller until Ask re-pinned. The name operation is therefore a separately
versioned opt-in. `lib/specialist-execution/contractor-v2.ts` and `app/api/specialist-execution/v2/route.ts`
are byte-identical to base; the pinned values are recorded in `v2-contract-pins.json` and asserted by the gate
(they equal the value Ask currently pins: `4c220137…0f79b5`). This contract's own fingerprint is `f1a99879…2bc1f3`.

## 2. Request

```json
{ "operation": "name_candidates", "name": "Stilwell Solar", "jurisdiction": "FL", "page": 1, "limit": 10 }
```

| Field | Rule |
|---|---|
| `operation` | Required, exactly `name_candidates`. The mode is explicit; never inferred from free text. |
| `name` | Required. 2–120 chars after whitespace collapse, no control chars or `<`/`>`, at least one letter or digit. Validated before normalization and **never truncated**. |
| `jurisdiction` | Optional. Two-letter code or a configured state name. Credential-issuing jurisdiction, not company address. |
| `page` / `limit` | Optional integers. `limit` 1–25 (default 10). `(page-1)*limit` must be `< 200`. |
| `contract` | Optional; if present must be `contractor-name-candidates-v1`. |
| anything else | `400 INVALID_QUERY` / `unsupported_field` (no `trade`, `identifier`, `credentialStatus`, `state`…). |

A name that contains digits or a city stays a name. This operation never enters the license-key branch
(native Verify would treat `ACE 2000` as a license key; the gate proves this operation does not).

## 3. Scope

* **Name only:** one statement across every jurisdiction native Verify name search serves —
  currently `FL, TX, NJ, OR, WA, CA, AZ, LA, MS, KY, CO` (from `getLiveStates()` + `licenseSourcesFor()`;
  NJ follows the existing pilot flag). `scope.searched[]` lists each with `state: "COMPLETED"`.
  `scope.meaning` says this is **not nationwide coverage**.
* **Configured but not name-searchable** (`VA, NY, IL, WI`) are listed under `scope.notSearchableByName` and are
  not searched. A state page is not name coverage. State-intelligence-only states (OH, PA, NC…) have no
  Verify source and are not searchable either.
* **Explicit jurisdiction** is applied exactly. An unsupported one returns `422 UNSUPPORTED_SCOPE` with
  `scope.searched: []` — the constraint is kept, nothing is substituted, nothing is searched.
* The per-jurisdiction predicate is native Verify's own: `source_system ∈ state sources AND (home_state = code OR license.state = code)`.
* No credential-status filter. v2's `active_current` cohort default does not apply here; expired, inactive and
  unknown-status public profiles are discoverable. Status is reported, never used for eligibility.
* Publication gate = v2's existing gate: `is_thin_profile = FALSE` **and** a non-empty `slug`.
  **Declared difference from native Verify:** native can list a non-thin profile with no slug; without a public
  destination it is not a candidate here. No publication policy was changed.

## 4. Matching (shared engine)

Rendered by `buildNameMatchSql` for both native Verify name search and this operation; applied **before** any row limit.

A record matches when **one** actual source name field (`display_name`, `legal_name`, `dba_name`, `licensee_name_raw`,
`dba_name_raw`) contains **every** meaningful word of the supplied name:

* Both sides are normalized identically: ASCII upper-case, apostrophes removed (`O'BRIEN` = `OBRIEN`), every other
  non-alphanumeric run is a word break.
* Legal-suffix words and the connector `AND` are dropped from the **supplied** name only (`name.optionalWordsDropped`), so
  the customer never types LLC/Inc and "Brown and Root" finds `BROWN & ROOT`. Dotted forms (`L.L.C.`) are suffixes, not initials.
* Initials and every later word stay required (`name.requiredWords` lists all of them). Nothing is cut to "the first four".
* A word of 3+ characters may **begin** a source word (`stilw` → `STILWELL`); a shorter word must **equal** one. A letter
  inside a word never satisfies an initial.
* Words must co-occur in one field. A business-name word plus a word from another field is not a source name.
* No aliases are invented; only stored DBA fields are aliases. Exact-credential operations are untouched.

`match` per candidate is derived from the row's own returned values by the same rules (`deriveNameMatchEvidence`):
`field`, `value`, `method`, `matchedWords` (supplied word → source word) and an explanation naming exactly those words.

| Method | Meaning |
|---|---|
| `EXACT_SOURCE_NAME` | the field is exactly the supplied text |
| `NORMALIZED_NAME` | equal after case / punctuation / apostrophe / legal-suffix normalization |
| `DOCUMENTED_ALIAS` | either equality above, on a stored DBA field |
| `PREFIX_OR_TOKEN` | the field contains every required word, each beginning or equal to one of its words |

None is an identity finding; a single row is still `COMPLETED_WITH_CANDIDATES`. If a returned row has no derivable
evidence the whole response is `SOURCE_FAILURE` / `invalid_response`. The `name` echo alone is not proof.

Ordering (neutral, never provider quality): 0 display name equals the name (optional suffix) · 1 another name field
equals it · 2 display name starts with it · 3 another field starts with it · 4 contains every word; then
`LOWER(display_name)`, then `slug`. The representative credential row is the one with the strongest name relation, then
active/current, then most recent. Grain: one card per public profile; several sources are credential-grain, so cards ≠
distinct companies (`STILWELL SOLAR, LLC` is three FL profiles: CVC57212, FRO12195, CPC1460219). Dedup on `stableKey` only.

## 5. Response

```jsonc
{
  "contract": "contractor-name-candidates-v1", "contractVersion": "1.0.0", "schemaFingerprint": "…", "hub": "contractor",
  "operation": "name_candidates",
  "resultState": "COMPLETED_WITH_CANDIDATES",
  "name": { "supplied": "Stilwell Solar", "normalized": "STILWELL SOLAR", "requiredWords": ["STILWELL","SOLAR"],
            "optionalWordsDropped": [], "indexFragments": ["TILWEL","SOLAR"], "predicate": "…", "predicateApplied": true },
  "scope": { "mode": "all_name_searchable_jurisdictions", "requestedJurisdiction": null,
             "searched": [{ "code": "FL", "label": "Florida", "sources": ["fl_dbpr"], "state": "COMPLETED" }, …],
             "notSearchableByName": [{ "code": "VA", … }], "meaning": "… This is not nationwide coverage." },
  "grain": "…",
  "candidates": [{
    "stableKey": "contractor:profile:fro12195-stilwell-solar-llc",
    "sourceGrain": "ContractorTrustHub public profile with a representative state credential row",
    "displayName": "STILWELL SOLAR, LLC", "entityType": null,
    "match": { "field": "display_name", "value": "STILWELL SOLAR, LLC", "method": "NORMALIZED_NAME",
               "matchedWords": [{ "supplied": "STILWELL", "source": "STILWELL" }, { "supplied": "SOLAR", "source": "SOLAR" }], "explanation": "…" },
    "identifiers": [{ "label": "ContractorTrustHub credential key", "value": "FRO12195", "meaning": "…" }, …],
    "credential": { "number": "0012195", "class": "…", "occupationCode": "FRO", "status": "current",
                    "sourceNativeStatus": "…", "statusMeaning": "… Not a live board check, not regulatory approval …" },
    "credentialJurisdiction": { "code": "FL", "label": "Florida", "sourceSystem": "fl_dbpr", "sourceLabel": "…" },
    "recordedLocation": { "city": "…", "county": "…", "state": "FL", "meaning": "Recorded address … not service territory …" },
    "source": { "system": "fl_dbpr", "clock": { "value": "…Z", "label": "ContractorTrustHub last-verified time … not an official board effective date." } },
    "publicationState": "PUBLIC_PROFILE",
    "action": { "type": "PROFILE", "href": "https://www.contractortrusthub.com/contractors/fro12195-stilwell-solar-llc", "label": "…" },
    "destinations": [ … ]
  }],
  "pagination": { "page": 1, "limit": 10, "returned": 3, "hasMore": false, "nextPage": null,
                  "sourceCap": 200, "truncated": false, "total": null, "totalMeaning": "…" },
  "continuation": null, "ordering": "…", "limitations": ["…"], "timing": { "queryMs": 271, "queries": 1 }
}
```

`action.href` is built from the stored `slug` via the existing `absoluteUrl('/contractors/<slug>')` helper — never
from the user's text. Unknown status/clock stay `null`. No email, phone, street address, claim or account data is
selected or returned.

### Result states → HTTP → suggested Ask `HubOutcomeState`

| `resultState` | HTTP | Ask mapping |
|---|---|---|
| `COMPLETED_WITH_CANDIDATES` | 200 | `COMPLETED_WITH_CANDIDATES` |
| `COMPLETED_NO_CANDIDATES` | 200 | `COMPLETED_NO_CANDIDATES` (a genuine, predicate-applied miss) |
| `PARTIAL_TRUNCATED` | 200 | `PARTIAL_TRUNCATED` |
| `UNSUPPORTED_SCOPE` | 422 | `UNSUPPORTED_OPERATION` / out of scope — never a miss |
| `INVALID_QUERY` | 400 | request bug — never a miss |
| `SOURCE_FAILURE` (`failureKind` `timeout` → 504, else 503) | 503/504 | `TECHNICAL_FAILURE` — never a miss |

`name.predicateApplied` is `true` only when the statement ran; it is `false` for unsupported scope and failures.
There is no policy-restricted state in v1: held/thin profiles are simply not candidates (see Deferred).

## 6. Pagination

* `limit + 1` probe row ⇒ `hasMore` is proven, never guessed. No count query, so `total` is always `null`.
* `hasMore: true` ⇒ `continuation.type: "NEXT_PAGE"` with a ready-to-send `request` preserving name and jurisdiction.
* Cap: 200 rows per name+scope, enforced for every limit — the last window is clamped to the rows remaining under the cap
  (page 9 × 24 returns 8 rows; page 10 is `invalid_page`).
* At the cap with more rows: `resultState: "PARTIAL_TRUNCATED"`, `hasMore: false`, `pagination.truncated: true`, and
  `continuation.type: "REFINE_SEARCH"` with `reachesRowsBeyondCap: false`. Its links open native Verify for the same name;
  Verify shows its own first page and does **not** continue past row 200. It is a refinement action, not a cursor.
* On failure `continuation.type` is `RETRY_OR_VERIFY`.

## 7. Engine repair (the one native-path change)

On unchanged base **and in production**, native Verify name search times out (`red-before-base-7b34589.json`; production
`/verify?state=fl&q=stilwell+solar` answered "search took too long" after ~10 s): the old predicate's `OR` across two tables
and its concatenated-blob `ILIKE` cannot use the trigram indexes that exist on all five name columns.

Per field the rule is `indexRule(raw column) AND wordRule(normalized column)`. The index rule is "the raw column contains
every index fragment" — all fragments on the **same** column, so one index scan intersects them on the rarest trigram.
The prefilter applies that same per-field rule to each table, so it is a superset of the predicate by construction and
discards non-matching index candidates at the heap scan, before any join. No schema, index, timeout, pooling or
infrastructure change. Index fragments: the word itself under six letters; the piece the customer marked with an
apostrophe; otherwise the interior of a 6+ letter word (survives a source apostrophe after the first or before the last
letter). Initials never drive an index. With no indexable word the rule is "raw column contains the supplied text".
`searchContractors` also gained an optional `db` argument (tests only).

Holdout history on the unchanged frozen sample (every run kept): run 1 29/60 · run 2 48/60 · run 3 57/60 · run 4 59/60 · run 5 59/60 ·
**run 6 (final runtime) 59/60**, 0 misses in every run. See `REVIEW-1.md` for the remaining failure.

## 8. Measured cost (single observations; not percentiles)

One statement per request, no enrichment, no count query, no retry on timeout, 6 s statement budget (Ask's per-hub
reference is ~7 s). `live-controls.review1.json`, `query-plan-cold-vs-warm.review1.json`, `query-plans.json`.

* Distinctive names: 0.3–1.7 s (Stilwell 0.30 s warm / 1.26 s first; Worsham 0.30–1.35 s; Whaley's 0.33–1.67 s).
* **Unresolved:** names whose index fragments are all common words. Identical statement, identical plan (index scans only,
  3 rows reach the joins): 14.8–18.9 s cold, 0.23 s warm. `R & T GENERAL CONSTRUCTION` unscoped returned 504 twice;
  scoped to `MS` 0.6 s. `Allied` unscoped 504 then 4.5 s; scoped `FL` 0.34 s. Reported as `SOURCE_FAILURE`, never a miss.

## 9. Ask-side activation work still required (NOT done here)

1. In Ask `lib/network/name-candidates/adapters.ts`: implement `contractorNameAdapter.search(name, page)` →
   `POST {CANONICAL_ORIGINS.contractor}/api/specialist-execution/name-candidates/v1` with
   `{ operation: "name_candidates", name, page, limit: HUB_PAGE_SIZE }`; set `enabled: true`; drop `CONTRACTOR_NAME_DEPENDENCY`.
2. Pin `contract === "contractor-name-candidates-v1"`, `contractVersion`, and this contract's `schemaFingerprint`
   (independent of the v2 pin, which does not move).
3. Set `nameFilterApplied = (name.predicateApplied === true && name.supplied === <sent name>)`; otherwise
   `failureKind: "name_filter_not_proven"`.
4. Map each candidate: `stableKey` → `contractor:profile:<slug>` (already `hub:namespace:key` shaped),
   `matchedName = match.value`, `matchedField = match.field`, `matchMethod = match.method`,
   `hubMatchExplanation = match.explanation`, `identifiers`, `recordedLocation` + `locationMeaning`,
   `sourceAsOf = source.clock.value`, `sourceDateLabel = source.clock.label`, `publicationState`, `action`.
5. `hasMore`/`page` from `pagination`; `truncatedWithoutCursor = pagination.truncated` (the cap action is `REFINE_SEARCH`,
   a refinement, not a cursor); offer `continuation.scoped[]` as a research action; `hubReportedTotal = null`.
6. `searchedScope` from `scope.searched[].code` + `scope.meaning`; `matchBreadth` from `name.predicate`.
7. Ask fixtures/tests, deadline accounting (one call per page), then a separately reviewed Ask release.

## 10. Known blockers vs deferred

**Blockers for this PR:** none known.

**Deferred (deliberately not in scope):**
* **Cold-cache latency for common-word names (see §8 and `REVIEW-1.md`).** The plan is index-only-driven and minimal; the cost is page residency. Smallest dependency, needing explicit authorization: keep the five name trigram indexes resident (`pg_prewarm`/larger cache), or a normalized-name column with a `text_pattern_ops` index.
* **Pre-existing, unrelated:** the legacy v2 exact-identifier and cohort operations return 503 in production today (`preexisting-v2-production-health.json`; `runCohortRows` `COUNT(*)` times out). Not touched here; repair was explicitly excluded from this assignment.
* No lint is configured in this repository (no ESLint config, no `lint` script), so none was run.
* Normal-zoom browser evidence is an open gap (`browser/native-flows.review1.json`).
* `POLICY_RESTRICTED` detection (telling "only held/thin records match" apart from a true miss) would need a second query per miss.
* The native per-jurisdiction rule `(home_state = code OR license.state = code)` can omit an out-of-state-addressed
  credential holder for some sources. Inherited unchanged so both surfaces agree; changing it is a native-search decision.
* Per-scope partial failure: scopes run in one statement, so failure is all-or-nothing (`state: "FAILED"` for all). No bounded per-scope composition is used.
* Three pre-existing gate failures on unchanged `main` (`check:con-search-001`, `check:th-search-001a`, `check:ath-cap-pilot-001`) — reproduced identically on base; untouched.

## 11. Evidence in this directory

| File | Content |
|---|---|
| `red-before-base-7b34589.json` | unchanged base: v2 rejects any name field; no name route; native name search times out |
| `v2-contract-pins.json` | v2 version + fingerprints captured from base; asserted unchanged |
| `holdout-frozen.json` / `holdout-results.run{1,2,3}-*.json` | frozen 20-record diagnostic holdout (2 per scope for 10 scopes; CO produced no eligible pick) and every run, with the reason for each rerun |
| `preexisting-v2-production-health.json` | legacy v2 and native search timing out in production before this change |
| `REVIEW-1.md` | disposition of the review on `3a22d7b`; supersedes this file where they differ |
| `mutation-report.json` | 13 mutations and the tests that detected them |
| `query-plan-cold-vs-warm.review1.json`, `query-plans.json` | bounded query-plan evidence |
| `live-controls.review1.json`, `holdout-results.run4-*.json`, `holdout-results.run5-*.json`, `holdout-results.run6-*.json` | review-1 runtime: HTTP controls and holdout runs |
| `timings.json` | measured request costs |
| `live-controls.json` | Stilwell / Worsham / third-company live verification through the HTTP endpoint |
| `browser/` | native positive / ambiguous / miss flows at 1280 and 390 CSS px, opened profile, every candidate link checked |
