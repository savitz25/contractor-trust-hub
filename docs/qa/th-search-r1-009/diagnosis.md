# TH-SEARCH-R1-009 diagnosis

Model: GPT-6 Astra / High, USER-CONFIRMED. Baseline origin/main: `11fd0b6fd8f6a1fe5e40e48a34f6a578b67334f4`. Isolated work/base trees; dirty original checkout and all other branches untouched. No overlapping visible assignment or open PR at intake.

The legacy /ask ontology recognizes FL from the misspelled county query and executes statewide. Its separate spelling suggestion does not constrain execution. /ask redirects non-FL discovery into /search, whose narrower city parser drops Austin/Dallas before capability validation. Capability links reconstruct English questions and pagination previously discarded choices/filters.

The repair keeps one geography requirement through the existing planners. Both routes share request validation and canonical route selection. County correction is a validated explicit action; broadening retains the original place and records USER_APPROVED_RELAXATION. Source predicates precede counts/order/pagination. No new geocoder or data writes.

## Independent source/capability matrix

| Source | Grain | Supported selected operation | Local capability | Source clock |
|---|---|---|---|---|
| FL DBPR licenses + existing public identities | credential / distinct public identity | existing trade/status/evidence research | recorded county code and exact recorded city; no service area | licenses.updated_at; stored update |
| NJ DCA | source-native credential, PLB = Master Plumber | existing specialty cohorts | recorded county; existing authoritative Summit municipality mapping | licenses.updated_at |
| TX TDLR TAC | A/C Contractor credential | narrowly enabled existing public TAC state cohort | 0 populated city values in independently inspected cohort; city execution unavailable | stored update; status expiration-derived |
| TX intelligence / Austin permits | state snapshot / local permit records | existing separate intelligence surfaces | not a substitute for city HVAC credentials | separate artifact clocks/fingerprints |
| NY public-work / IL roofing | existing accepted state snapshots | preserved dedicated interpretation | no new local execution | existing snapshot clocks |

See source-oracle.json for bounded read observations. The 20,323 TAC rows establish acquired published state records, not city coverage. 964 CCC + 49 RC = 1,013 Broward records in this read window. These values are not hardcoded in production or deterministic fixtures.

## Before evidence

baseline-browser.json and before-*.png capture original settled UI; red-before.log contains all three failing reproduction assertions on unchanged source. Baseline typecheck/build pass. Baseline Ask gate has a stale expected network total; baseline discovery UI gate expects an obsolete homepage heading. These are not new failures and are left intact.

## Safety and limits

No DB writes, schema/publication changes, new analytics, new services, or other repository edits. Vercel production secret pull returned a DATABASE_URL placeholder; local source-positive browser testing must use authorized preview/production rather than claim a live local DB. Local unavailable states can still be tested. Rollback must preserve no-silent-broadening behavior; use a reviewed corrective revert, never restore the known unsafe fallback without containment.
