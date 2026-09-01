# Ask specialist execution V2 — ContractorTrustHub

- Contract: `trusthub-specialist-execution-v2`
- Version: `2.1.0`
- Endpoint: `GET|POST /api/specialist-execution/v2`
- Consumer: AskTrustHub Guided Research

`GET` without parameters returns capabilities. `GET` with structured query parameters and `POST` with JSON execute the same server-authoritative path. The response publishes deterministic `schemaFingerprint` and `contractFingerprint` values; consumers must bind the values returned by the released endpoint.

## Request

```json
{
  "contract": "trusthub-specialist-execution-v2",
  "queryType": "cohort",
  "state": "NJ",
  "trade": "home_improvement",
  "geography": {
    "stateCode": "NJ",
    "intent": "RECORDED_CREDENTIAL_GEOGRAPHY"
  },
  "credentialStatus": "active_current",
  "page": 1,
  "limit": 24
}
```

Accepted fields are strict. Maximum limit is 50. Existing Florida legacy fields (`state`, `trade`, `county`, `city`, `credentialStatus`, `identifier`, `page`, `limit`) remain accepted.

## Response and HTTP states

All responses identify contract/version/fingerprints, state/trade/geography interpretation, result state, provenance, and limitations.

- HTTP 200: `SUPPORTED_RESULTS`, `ZERO_MATCHING_ROWS`, `EXACT_IDENTITY`
- HTTP 400: `INVALID_QUERY`
- HTTP 422: `CLARIFICATION_REQUIRED`, `INVALID_GEOGRAPHY`, `UNSUPPORTED_STATE_CAPABILITY`, `UNSUPPORTED_TRADE_CAPABILITY`, `PUBLICATION_RESTRICTED`
- HTTP 503: `BACKEND_UNAVAILABLE`
- HTTP 504: `TIMEOUT`

Capability/clarification responses contain `capabilityChoices[]` with stable ids, consumer labels, supported flags, optional follow-up requests, destinations, and limitations.

## State and class capability

The contract reuses `lib/states/config.ts` and one state capability matrix. Florida executes accepted DBPR/CILB construction classes. New Jersey executes `nj_dca` source classes:

| Consumer family | Source class | Meaning |
|---|---|---|
| Home improvement | HIC | Home Improvement Contractor registration; not General |
| Electrical | ELE | NJ DCA electrical credential class |
| Plumbing | PLB | Master Plumber |
| HVAC | HVAC | Master HVACR Contractor |
| Mechanical | HVAC | Bounded HVACR interpretation, not a universal mechanical class |
| Alarm | ALM | Alarm credential class |
| Telecom | TEL | Telecom credential class |
| Locksmith | LCK | Locksmith credential class |
| Hearth | HRT | Master Hearth Specialist |

New Jersey has no single statewide General contractor class in this source. A generic NJ contractor request returns clarification; HIC is never relabeled General. Florida electrical remains `unsupported_florida_electrical_source` because the accepted Florida source lacks that class.

## Geography

- Statewide NJ means NJ DCA credential jurisdiction. A credential holder's recorded address may be outside New Jersey.
- County filters accept only the 21 authoritative NJ counties and require recorded address state NJ.
- Summit is an authoritatively mapped city in Union County (NJ municipality code 2018).
- `Summit County, New Jersey` is invalid and offers the Summit/Union correction.
- Unmapped city or ZIP requests require explicit confirmation before statewide fallback.
- Recorded credential/address geography never means service territory or current availability.

## Rows, ordering, and publication

Rows contain public name, exact credential id/key, source-native class/status, recorded geography, source clock, publication state, why shown, and destinations. They omit internal ids and private contacts.

Ordering is normalized public name, credential identifier, then stable source record. It is not review, rating, discipline, claimed, paid, popularity, or recommendation ordering.

Publication is server-controlled: only exact credentials already related to existing public non-thin profiles with slugs are eligible. The endpoint does not create identities or profiles. Destination types are `PUBLIC_PROFILE`, `CONTRACTORTRUSTHUB_VERIFY`, `OFFICIAL_BOARD_VERIFICATION`, and `NO_PUBLIC_DESTINATION`.

## Examples

Generic New Jersey clarification:

```json
{"state":"NJ"}
```

HIC statewide cohort:

```json
{"state":"NJ","trade":"home_improvement","credentialStatus":"active_current","page":1,"limit":24}
```

Summit electrical recorded-geography cohort:

```json
{"state":"NJ","trade":"electrical","city":"Summit"}
```

Invalid Summit County:

```json
{"state":"NJ","trade":"home_improvement","county":"Summit County"}
```

Explicit statewide fallback after an unsupported local request:

```json
{"state":"NJ","trade":"home_improvement","city":"Unmapped City","confirmStatewide":true}
```

Service territory refusal:

```json
{"state":"NJ","trade":"plumbing","geography":{"stateCode":"NJ","intent":"SERVICE_TERRITORY"}}
```

Timeouts return no partial rows or invented totals. Official source status should always be reconfirmed with the identified board.
