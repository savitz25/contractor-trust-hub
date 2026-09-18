# TH-SEARCH-R1-019B — Contractor name-candidate operation (integration handoff)

Status: `READY_FOR_ASTRA_REVIEW — CONTRACTOR_OPERATION`. Draft PR only. Not merged, not deployed.

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
(they equal the value Ask currently pins: `4c220137…0f79b5`).

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

Predicate (rendered by `nameMatchPredicateSql`, used by both native Verify and this operation), applied **before** any row limit.
A record matches when **one** of `display_name, legal_name, dba_name, licensee_name_raw, dba_name_raw`:

1. contains the supplied name, **or**
2. contains it after punctuation + legal-suffix normalization (`prepareNameSearch`), **or**
3. contains **every** one of the first four significant words.

> **Reviewer decision point — word rule is per name field.** On base, rule 3 tested the five fields *concatenated*, so
> one word could come from the business name and another from a different field (in FL, `legal_name` is often the
> qualifying individual). That form cannot use any index and is why native search times out (§7). Rule 3 now requires
> the words to co-occur in a single name field. `Perez Gulf` no longer matches a profile whose display name is
> `GULF COAST` and whose licensee is `PEREZ, MARIA`; `Perez Maria` and `Gulf Coast` each still do. Native Verify and this
> operation share the rule (gate tests 8 and 13). Since native name search returns nothing at all on base, no working
> behavior is lost, but it is a deliberate semantic choice and is called out here rather than buried.

Generic-word overlap alone admits nothing (rule 3 is AND, within one field). No aliases are invented; only stored DBA fields count as aliases.
Words 5+ of a long name are not required (`name.ignoredWords` discloses them).

`match.method` per candidate, derived from the row's own returned values (`deriveNameMatchEvidence`):

| Method | Meaning |
|---|---|
| `EXACT_SOURCE_NAME` | a name field equals the supplied text exactly |
| `NORMALIZED_NAME` | equal after case / punctuation / legal-suffix normalization |
| `DOCUMENTED_ALIAS` | the equality above held on a stored DBA field |
| `PREFIX_OR_TOKEN` | the field starts with the name at a word boundary, or contains every required word |
| `NAME_CONTAINS` | field contains the supplied name |

These map 1:1 onto Ask's `MatchMethod` values of the same names. None is an identity finding. A single
returned row is still `COMPLETED_WITH_CANDIDATES`; this contract has no `EXACT_IDENTITY` state.

**Row-level proof the predicate ran:** every candidate must have evidence derivable from its own returned
name fields. If a row has none, the whole response is `SOURCE_FAILURE` / `invalid_response` — it is never shown.
The `name` echo alone is not treated as proof.

Ordering: neutral string-relation rank → `LOWER(display_name)` → `slug`. Never provider quality.
Grain: one card per public profile with one representative credential row (active/current first, then most
recently updated — same as native). Several sources are credential-grain, so cards ≠ distinct companies
(e.g. `STILWELL SOLAR, LLC` is three FL profiles: CVC57212, FRO12195, CPC1460219). Dedup is on `stableKey` only.

## 5. Response

```jsonc
{
  "contract": "contractor-name-candidates-v1", "contractVersion": "1.0.0", "schemaFingerprint": "…", "hub": "contractor",
  "operation": "name_candidates",
  "resultState": "COMPLETED_WITH_CANDIDATES",
  "name": { "supplied": "Stilwell Solar", "normalized": "Stilwell Solar", "requiredWords": ["Stilwell","Solar"],
            "ignoredWords": [], "indexedWords": ["Stilwell","Solar"], "predicate": "…", "predicateApplied": true },
  "scope": { "mode": "all_name_searchable_jurisdictions", "requestedJurisdiction": null,
             "searched": [{ "code": "FL", "label": "Florida", "sources": ["fl_dbpr"], "state": "COMPLETED" }, …],
             "notSearchableByName": [{ "code": "VA", … }], "meaning": "… This is not nationwide coverage." },
  "grain": "…",
  "candidates": [{
    "stableKey": "contractor:profile:fro12195-stilwell-solar-llc",
    "sourceGrain": "ContractorTrustHub public profile with a representative state credential row",
    "displayName": "STILWELL SOLAR, LLC", "entityType": null,
    "match": { "field": "display_name", "value": "STILWELL SOLAR, LLC", "method": "NORMALIZED_NAME", "explanation": "…" },
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
* `hasMore: true` ⇒ `continuation.type: "NEXT_PAGE"` with a ready-to-send `request` that preserves name and jurisdiction.
* Cap: 200 rows per name+scope. When more exist at the cap: `resultState: "PARTIAL_TRUNCATED"`, `hasMore: false`,
  `pagination.truncated: true`, and `continuation.type: "VERIFY"` with one working native Verify URL per searched
  jurisdiction (`/verify?state=xx&q=<name>`). `hasMore` is never advertised without a usable next page.
* Ask's `HUB_PAGE_SIZE = 10` × `MAX_PAGE = 20` = 200 fits the cap exactly.

## 7. Engine repair found during the audit (the one native-path change)

On unchanged base **and in production**, native Verify name search times out
(`red-before-base-7b34589.json`; production `/verify?state=fl&q=stilwell+solar` answered "search took too long"
after ~10 s). Trigram indexes exist on all five name columns, but the predicate's `OR` across two tables plus the
concatenated-blob `ILIKE` prevents Postgres from using them, so it scans ~1.3 M rows until the 8 s statement timeout.

Repair (`namePrefilteredContractorsFromSql`): candidate contractor ids are collected first from the per-column
trigram indexes — *some name field contains every indexable required word* — then the full predicate is applied.
Because every row the predicate admits has one field containing every required word, the prefilter is an exact
superset: it changes which rows are scanned, never which match (gate: "index prefilter … never widens the match set").
Keeping all words on the same column lets one index scan intersect them on the rarest trigram before any heap
recheck. No schema, index, timeout, pooling or infrastructure change. Words under three characters cannot drive a
trigram index and are left out of the prefilter (still required by the predicate); if no word qualifies the query is
the legacy unfiltered scan and `limitations` says so.

How the design was reached (all three holdout runs are kept):

| Prefilter | Holdout (60 variants) | Note |
|---|---|---|
| base (none) | native search never completes | 8 s statement timeout |
| run 1 — single "anchor" word | 29 found / 31 timeouts / 0 misses | any row containing the word needs a heap recheck; even rare words timed out cold |
| run 2 — all words, `OR` across a table's columns | 48 found / 12 timeouts / 0 misses | one full index scan per word per column |
| **run 3 — all words on one column (final)** | **57 found / 3 timeouts / 0 misses**, median 341 ms | the 3 timeouts are one record, `R & T GENERAL CONSTRUCTION` |

`searchContractors` also gained an optional third `db` argument (tests only; production callers unchanged).

## 8. Measured cost (small read-only sample; not a p95)

See `timings.json` and `live-controls.json` (HTTP endpoint on the optimized local build; ~250 ms of each figure is this
machine's round trip to the database). One statement per request, no enrichment, no count query, no retry on timeout.
Statement budget 6 s (under Ask's ~7 s per-hub reference).

* Typical: 0.3–1.5 s (`Stilwell Solar` 0.29 s warm, `Worsham Construction` 0.37–0.89 s, `Whaley's Air Conditioning` 1.4 s).
* Cold index pages: the first `Stilwell Solar` of the session took 5.4 s; the identical repeat took 0.29 s. The database's
  cold-read speed dominates; that is infrastructure, not changed here.
* **Slow paths:** a very common single word (`Allied` 6.1 s — completed, at the edge of the budget) and names made only of
  generic words (`General Construction` → 504 `SOURCE_FAILURE`). These are reported as failures with a working Verify
  continuation, never as misses.

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
5. `hasMore`/`page` from `pagination`; `truncatedWithoutCursor = false` (a VERIFY continuation is always supplied
   when truncated); `continuation` from `continuation.scoped[0]` or a chooser; `hubReportedTotal = null`.
6. `searchedScope` from `scope.searched[].code` + `scope.meaning`; `matchBreadth` from `name.predicate`.
7. Ask fixtures/tests, deadline accounting (one call per page), then a separately reviewed Ask release.

## 10. Known blockers vs deferred

**Blockers for this PR:** none known.

**Deferred (deliberately not in scope):**
* Common-word / generic-only-name latency (see §8). A durable fix is a normalized-name column with an ordered index, or more database memory — schema/infrastructure changes that need their own approval.
* **Pre-existing, unrelated:** the legacy v2 exact-identifier and cohort operations return 503 in production today (`preexisting-v2-production-health.json`; `runCohortRows` `COUNT(*)` times out). Not touched here; repair was explicitly excluded from this assignment.
* No lint is configured in this repository (no ESLint config, no `lint` script), so none was run.
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
| `mutation-report.json` | mutations and the tests that detected them |
| `timings.json` | measured request costs |
| `live-controls.json` | Stilwell / Worsham / third-company live verification through the HTTP endpoint |
| `browser/` | native positive / ambiguous / miss flows at 1280 and 390 CSS px, opened profile, every candidate link checked |
