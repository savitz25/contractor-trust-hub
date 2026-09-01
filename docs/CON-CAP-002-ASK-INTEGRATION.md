# CON-CAP-002 Ask integration handoff

Endpoint: `https://www.contractortrusthub.com/api/specialist-execution/v2` after Production release. Contract family `trusthub-specialist-execution-v2`, version `2.1.0`. Bind the Production `schemaFingerprint` and `contractFingerprint`, not values copied from a draft.

## Requests Builder 2 can consume

1. Contractor in New Jersey

```json
{"contract":"trusthub-specialist-execution-v2","queryType":"cohort","state":"NJ"}
```

HTTP 422 `CLARIFICATION_REQUIRED`, `errorCode=new_jersey_credential_class_required`, with `capabilityChoices` for HIC, electrical, plumbing, HVAC/mechanical, alarm, telecom, locksmith, and hearth.

2. Home Improvement Contractor in New Jersey

```json
{"contract":"trusthub-specialist-execution-v2","queryType":"cohort","state":"NJ","trade":"home_improvement","credentialStatus":"active_current","page":1,"limit":24}
```

HTTP 200 `SUPPORTED_RESULTS`; bounded HIC rows. HIC is not General.

3. Electrician / plumber

```json
{"state":"NJ","trade":"electrical"}
{"state":"NJ","trade":"plumbing"}
```

HTTP 200 source-backed `ELE` or `PLB` rows.

4. General contractor in New Jersey

```json
{"state":"NJ","trade":"general"}
```

HTTP 422 `UNSUPPORTED_TRADE_CAPABILITY`, `errorCode=no_new_jersey_statewide_general_contractor_class`; choices remain class-specific.

5. Contractor in Summit, New Jersey

Generic request:

```json
{"state":"NJ","city":"Summit"}
```

Returns class clarification with geography interpreted as Summit City, Union County. After class selection:

```json
{"state":"NJ","trade":"home_improvement","city":"Summit"}
```

executes the exact recorded-city/Union-county intersection.

6. Summit County, New Jersey

```json
{"state":"NJ","trade":"home_improvement","county":"Summit County"}
```

HTTP 422 `INVALID_GEOGRAPHY`, with correction to Summit City in Union County. It is never executed as a county.

7. Statewide fallback

First request with an unmapped city returns HTTP 422 `CLARIFICATION_REQUIRED` and a follow-up request. Execute only after the user confirms:

```json
{"state":"NJ","trade":"home_improvement","city":"Unmapped City","confirmStatewide":true}
```

The supported response states that statewide broadening was explicitly confirmed.

8. Service territory

```json
{"state":"NJ","trade":"electrical","geography":{"stateCode":"NJ","intent":"SERVICE_TERRITORY"}}
```

HTTP 422 `UNSUPPORTED_TRADE_CAPABILITY`, `errorCode=unsupported_service_territory`. Offer statewide credential research or exact verification, never address rows as availability.

## Response integration

Render `resultState` before inspecting `rows`. Use `capabilityChoices` only for 422 clarification/capability responses. Rows are neutral and publication-safe. `recordedGeography` is address evidence, never service territory. `destination` is the canonical public profile; `destinations[]` also identifies Verify and official-board options. Timeouts/backend failures must not be rendered as zero results.
