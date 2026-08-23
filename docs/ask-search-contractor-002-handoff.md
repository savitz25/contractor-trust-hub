# ASK-SEARCH-CONTRACTOR-002 — Ask handoff consumer

**Status:** Implemented on ContractorTrustHub. Not wired into Ask production. Not deployed.

Receives structured AskTrustHub Universal Search handoffs and preloads the
**existing** Florida county/trade browse. Consumers do not retype the search.

```
AskTrustHub (structured non-PII params)
        ↓
/from-ask  (noindex receiver)
        ↓
/florida/{county}/{trade}   existing browse
        ↓
/contractors/{slug}         existing Trust Report
        ↓
← Back to preloaded county/trade results
```

## Existing architecture reused

| Surface | Route |
|---|---|
| Florida hub | `/florida` |
| County | `/florida/{county}` |
| Trade statewide | `/florida/{trade}` |
| County + trade | `/florida/{county}/{trade}` |
| City + trade | `/florida/{county}/{city}/{trade}` |
| Profile | `/contractors/{slug}` |
| Verify | `/verify` |

Ask handoff **View More** uses `/florida/{county}/{trade}` (not a parallel results engine).

Browse already filters `is_thin_profile = FALSE` and occupation codes on the trade page (CAC for HVAC, CGC for general contractors).

## Allowlist

`src`, `journey`, `state`, `county`, `intent`, `entity`, `category`, `city`, `zip`, `sid`

`src` must be `ask`. Raw `query`/`q` is not consumed. Forbidden: email, phone, name, next, redirect, documents, payment, etc.

## Florida READY categories

`roofing` → `/florida/{county}/roofers` (CCC/RR)
`plumbing` → `.../plumbing` (CFC)
`hvac` → `.../air-conditioning` (CAC only, not CMC)
`pool` → `.../pool-spa` (CPC)
`general_contractor` → `.../general-contractors` (CGC only, not CBC/CRC)

Unsupported (fail closed, no auto-widen): electrical, solar, painting, flooring, remodeling, home inspector.

## Geography

Physical license address only. No service graph.

City → county uses a **curated** map (Miami→Miami-Dade, Tampa→Hillsborough, Orlando→Orange, Jacksonville→Duval, …). Unknown cities fail closed — no geocoding.

Landing is county browse. Copy says contractors **in {County} County**, not “serves {city}”. A Miami-Dade listing is not labeled an exact Miami contractor unless the published city is Miami.

License state is not exact local geography.

## New Jersey — SOFT

No county browse. No roofing occupation.

- `roofers Monmouth County NJ` → unsupported empty
- `plumbers Bergen County NJ` → existing `/verify?state=nj` with honest SOFT copy

## Persistence

Allowlisted query params on the browse URL + `sessionStorage` key `cth:ask-search-handoff` (serialized allowlist only). Profile canonical path stays `/contractors/{slug}` without search params in metadata.

## SEO

`/from-ask` is `noindex` and disallowed in `robots.txt`. Ask query params on Florida browse set `noIndex` while the canonical remains the clean county/trade path.

## Analytics

Best-effort `ask_search_handoff` via existing gtag/dataLayer. Allowlisted fields only. No PII. No Ask runtime fetch.
