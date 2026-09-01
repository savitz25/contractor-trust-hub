# Ask specialist execution V2 — ContractorTrustHub

Contract: `trusthub-specialist-execution-v2`. This server-side API executes structured Florida contractor research; it does not reinterpret natural language, rank contractors, or expand publication.

## Endpoint

- `GET /api/specialist-execution/v2` returns capability metadata.
- `POST /api/specialist-execution/v2` accepts JSON and returns bounded public rows.

Request fields: `trade`, `state` (`FL`), `county`, `city`, `credentialStatus`, `identifier`, `page`, and `limit` (maximum 50). Unknown fields fail closed. A request requires `trade` or an exact credential `identifier`.

Executable Florida trades in the current source are general, building, roofing, HVAC, plumbing, residential, pool/spa, mechanical, solar, underground utility, and specialty structures. Each maps to explicit DBPR occupation codes; no name inference is used. Electrical is part of the network taxonomy but is **not executable for Florida**: the accepted Florida CILB construction extract does not contain Florida electrical credentials. Codes used by Texas/New Jersey/Wisconsin cannot be relabeled as Florida evidence.

## Response

The response contains `contract`, `hub`, `queryInterpretation`, `resultType`, `rows`, `total`, `pagination`, `availableRefinements`, `provenance`, and `limitations`. Rows expose only public profile identity, credential number/key, exact trade class, source-native status, recorded geography, source clock, a carefully bounded regulatory-history indicator, and canonical profile destination.

## Geography

Florida and configured counties use indexed DBPR credential/address geography. This is **not service territory** or proof of local authorization. Boca Raton can be deterministically mapped to Palm Beach County, but the required electrical+Boca execution remains blocked until an accepted Florida electrical source exists. The contract fails closed rather than returning an invented cohort.

## Publication and provenance

Queries require `fl_dbpr`, an existing non-thin public profile, a non-empty canonical slug, and an exact license-to-contractor relationship. The endpoint creates no identities or profiles. Source clock is `licenses.updated_at`; consumers should confirm current status with Florida DBPR.

## Errors and timeout behavior

Malformed or invalid inputs return 400. A valid request for a known but unavailable source capability returns HTTP 422 with `status=unsupported_capability`, a stable `errorCode`, requested trade, resolved geography, supported alternatives, provenance, and limitation. Database or execution failure returns 503 `execution_unavailable`; zero matching supported rows remain a successful 200 with `total=0`. No partial or invented rows/counts are returned.

## Golden requests

```json
{"trade":"roofing","state":"FL","county":"broward"}
{"trade":"electrical","state":"FL","city":"Boca Raton"}
{"trade":"plumbing","state":"FL","county":"palm-beach"}
{"trade":"hvac","state":"FL"}
{"identifier":"CCC1332036","state":"FL"}
```

The electrical+Boca request returns HTTP 422 with `status=unsupported_capability` and `errorCode=unsupported_florida_electrical_source`; the other examples execute against the accepted Florida construction source.

“Best roofer” is not an execution input. Ask must remove/refuse ranking intent and send only supported structured fields.

## Deep destinations

Each row returns `https://www.contractortrusthub.com/contractors/{slug}`. No unverified section anchors are advertised.
