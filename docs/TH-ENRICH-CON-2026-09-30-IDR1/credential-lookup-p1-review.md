# Contractor credential lookup P1 — Founder visual review

Local-only branch prototype. Preview URL while the Next development server is running: `http://127.0.0.1:3456/credential-lookup-preview`. The route returns 404 outside development and carries `noindex, nofollow` metadata. It is not linked from normal navigation and is not a production publication.

## What to review

The separate credential search accepts native number, holder text, jurisdiction, and credential type. Selecting a result displays regulator, jurisdiction, number, type, sourced holder text, raw-status-derived label, source date, official source link, hash, and `Business identity linkage: Not established`. NYC GC also shows the separately sourced person registrant text. The detail panel never links to `/contractors/[slug]`.

The six fixtures are generated from pinned local stage files: one NYC active GC; NY mold Active and Expired; NY elevator Active; FL ZA Current/Active; NJ permit evidence with current status unverified. They demonstrate the 9,752 / 2,510 / 302 / 228 / 542 certified inventory classes without loading or publishing those totals as businesses. NJ is only a fixture, not a `licenses` row. Person-hold sources are absent.

The existing `licenses.contractor_id` is nullable. Existing business search joins `licenses` to `contractors`, so unattached credentials cannot enter canonical results. This prototype does not query production, write `licenses`, create `contractors`, or change `lib/contractors/queries.ts`. `CANONICAL_BUSINESS_COUNT_CHANGE = 0`; `CANONICAL_SEARCH_RESULTS_CHANGE = 0`.

## Visual evidence and checks

- [Desktop screenshot](credential-lookup-desktop.png) at 1440 × 900.
- [Mobile screenshot](credential-lookup-mobile.png) at 390 × 844.
- [Mobile expired-result screenshot](credential-lookup-mobile-result.png) after searching `01714`.
- Browser navigation and accessibility-tree snapshot passed. Searching `01714` returned one expired mold result; selecting New Jersey returned only the NJ permit fixture with current status unverified. The mobile document had no horizontal overflow. Keyboard Tab from the search input reached the jurisdiction select. Browser page errors: none observed.
- `npm run typecheck` passed.
- `python -m unittest discover -s scripts -p 'test_contractor_lookup_fixture.py' -v` passed 4/4 checks: certified classes/statuses, null business attachment, person exclusion, local-only route, unchanged canonical query boundary, fixture reproducibility.

## Publication gate still required

The preview is six fixtures, not a bulk credential index. A future publication plan must independently preflight live ownership, source hashes and status drift, exact license keys, and a separate search index/result type. The NJ permit evidence needs its own truthful row store or source evidence surface. No production load, deployment, schema migration, business minting, person profile, fuzzy bridge, or Trust Score change is included here.

```text
NYC_GC_PREVIEWED = YES (one representative fixture; certified class 9,752)
NY_MOLD_PREVIEWED = YES (Active and Expired fixtures; certified class 2,510)
NY_ELEVATOR_PREVIEWED = YES (one Active fixture; certified class 302)
FL_ZA_PREVIEWED = YES (one source-native business-license fixture; certified class 228)
NJ_PERMIT_PREVIEWED = YES (one permit-evidence fixture; certified class 542)
CANONICAL_BUSINESS_COUNT_CHANGE = 0
CANONICAL_BUSINESS_ROWS_CREATED = 0
PERSON_ROWS_PUBLISHED = 0
SCHEMA_CHANGE = NO
PRODUCTION_MUTATIONS = NO
```
