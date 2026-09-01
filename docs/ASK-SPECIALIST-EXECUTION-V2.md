# Ask specialist execution V2 — ContractorTrustHub

Contract: `trusthub-specialist-execution-v2`. This server-side API executes structured Florida contractor research; it does not reinterpret natural language, rank contractors, or expand publication.

## Endpoint

- `GET /api/specialist-execution/v2` returns capability metadata.
- `POST /api/specialist-execution/v2` accepts JSON and returns bounded public rows.

Request fields: `trade`, `state` (`FL`), `county`, `city`, `credentialStatus`, `identifier`, `page`, and `limit` (maximum 50). Unknown fields fail closed. A request requires `trade` or an exact credential `identifier`.

Supported trades are the accepted source-native families: general, building, roofing, HVAC, plumbing, electrical, residential, pool/spa, mechanical, solar, underground utility, and specialty structures. Each maps to explicit DBPR occupation codes; no name inference is used.

## Response

The response contains `contract`, `hub`, `queryInterpretation`, `resultType`, `rows`, `total`, `pagination`, `availableRefinements`, `provenance`, and `limitations`. Rows expose only public profile identity, credential number/key, exact trade class, source-native status, recorded geography, source clock, a carefully bounded regulatory-history indicator, and canonical profile destination.

## Geography

Florida and configured counties use indexed DBPR credential/address geography. This is **not service territory** or proof of local authorization. Boca Raton is deterministically mapped to Palm Beach County for the pilot; results are described as Palm Beach County recorded-address credential research, never as contractors serving Boca Raton.

## Publication and provenance

Queries require `fl_dbpr`, an existing non-thin public profile, a non-empty canonical slug, and an exact license-to-contractor relationship. The endpoint creates no identities or profiles. Source clock is `licenses.updated_at`; consumers should confirm current status with Florida DBPR.

## Errors and timeout behavior

Invalid/unsupported inputs return 400 with a stable error code. Database or execution failure returns 503 `execution_unavailable`; no partial or invented rows/counts are returned. Ask should retain a deep research destination and state the limitation.

## Golden requests

```json
{"trade":"roofing","state":"FL","county":"broward"}
{"trade":"electrical","state":"FL","city":"Boca Raton"}
{"trade":"plumbing","state":"FL","county":"palm-beach"}
{"trade":"hvac","state":"FL"}
{"identifier":"CCC1332036","state":"FL"}
```

“Best roofer” is not an execution input. Ask must remove/refuse ranking intent and send only supported structured fields.

## Deep destinations

Each row returns `https://www.contractortrusthub.com/contractors/{slug}`. No unverified section anchors are advertised.
