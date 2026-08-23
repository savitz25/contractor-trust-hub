# CTH-FL-BASE-001 — Florida State Forensic Baseline

> Official production BEFORE snapshot. Measurement only; no remediation was performed.

## A — Database / audit metadata

- Git SHA: `10c58dde712923c5994533ae1e886c07b2c21a21`
- Branch: `cth-fl-base-001`
- Audit UTC timestamp: `2026-08-23T21:32:18.753169+00:00`
- PostgreSQL: `17.6`
- Transaction: `repeatable read`, read-only `on`
- Statement timeout: `2min`
- Environment: `PRODUCTION`
- Mutation performed: `NO`
- Reconciliation assertions: `PASS`

### Latest relevant ingest batches

| Source | Dataset | Extracted | Rows | Checksum prefix | Source file / URL |
|---|---|---|---|---|---|
| fl_dbpr | construction_licensees | 2026-08-10 22:49:58.584081+00:00 | — | cc3d637c1d3d | data/staging/fl_dbpr_full/licenses_normalized.csv |
| fl_dbpr | contractor_disc_lic | 2026-08-11 07:15:51.183624+00:00 | — | 323c25221bd2 | data/staging/fl_dbpr_full/discipline_normalized.csv |
| fl_dbpr | qualifying_businesses | 2026-08-11 02:27:55.066239+00:00 | — | 9eff844228bf | data/staging/fl_dbpr_full/qualifying_businesses_normalized.csv |
| fl_sunbiz | corporate_entities | 2026-08-12 05:02:45.518674+00:00 | — | name-filtere | data/raw/sunbiz/quarterly/cordata.zip#name-filtered |

## B — Florida contractor shell baseline

Florida-regulated means attached to at least one `licenses.source_system='fl_dbpr'` row. Counts are canonical database shells, not proven unique real-world companies.

| Metric | Count |
|---|---|
| Regulated Shells | 143516 |
| Non Thin Shells | 143516 |
| Thin Shells | 0 |
| Public Searchable Profiles | 143516 |
| Home State Fl | 127314 |
| Home State Not Fl | 16202 |
| Home State Unknown | 0 |
| One License Shells | 143516 |
| Multi License Shells | 0 |
| Max Licenses Per Shell | 1 |
| Contractors Without Any License | 126516 |

### Potential duplicate shell groups

| Signal | Groups |
|---|---|
| normalized legal name groups | 23592 |
| normalized display name groups | 22771 |
| shared sunbiz entity groups | 9506 |
| exact name address groups | 20730 |
| potential duplicate shell groups | 23592 |

These are candidate groups only; no fuzzy merge or identity remediation was performed.

## C — Florida license baseline

| Metric | Value |
|---|---|
| total | 143516 |
| distinct external keys | 143516 |
| attached | 143516 |
| unattached | 0 |
| duplicate external key rows | 0 |
| distinct numeric license numbers | 123780 |
| null numeric license numbers | 0 |
| with raw payload | 143516 |
| with ingest batch | 143516 |
| with last verified at | 143516 |
| oldest original licensure date | 1920-02-16 |
| newest original licensure date | 2026-08-09 |
| earliest expiration date | 2002-04-14 |
| latest expiration date | 9999-08-31 |

### Normalized status
| Status | Count |
|---|---|
| active | 104444 |
| current | 24217 |
| inactive | 14786 |
| other | 69 |

### Primary status
| Status | Count |
|---|---|
| C | 143042 |
| S | 256 |
| P | 218 |

### Secondary status
| Status | Count |
|---|---|
| A | 104444 |
| (null) | 24286 |
| I | 14786 |

## D — License class / trade distribution

| Code | Description | Total | Active | Inactive | Current | Other/unknown | Shells | Numeric cores |
|---|---|---|---|---|---|---|---|---|
| CGC | — | 38923 | 33056 | 5866 | 0 | 1 | 38923 | 38923 |
| CBC | — | 19722 | 17242 | 2479 | 0 | 1 | 19722 | 19722 |
| FRO | — | 19087 | 3 | 0 | 19018 | 66 | 19087 | 19087 |
| CAC | — | 12378 | 11125 | 1253 | 0 | 0 | 12378 | 12378 |
| CCC | — | 11275 | 10093 | 1182 | 0 | 0 | 11275 | 11275 |
| CFC | — | 9310 | 8440 | 870 | 0 | 0 | 9310 | 9310 |
| CRC | — | 8556 | 7283 | 1273 | 0 | 0 | 8556 | 8556 |
| CRS1 | — | 4895 | 0 | 0 | 4895 | 0 | 4895 | 4895 |
| CPC | — | 4621 | 4260 | 361 | 0 | 0 | 4621 | 4621 |
| SCC | — | 3845 | 3631 | 214 | 0 | 0 | 3845 | 3845 |
| CUC | — | 3004 | 2633 | 371 | 0 | 0 | 3004 | 3004 |
| CMC | — | 2776 | 2412 | 364 | 0 | 0 | 2776 | 2776 |
| RR | — | 672 | 588 | 84 | 0 | 0 | 672 | 672 |
| RF | — | 589 | 533 | 56 | 0 | 0 | 589 | 589 |
| RC | — | 519 | 466 | 52 | 1 | 0 | 519 | 519 |
| CVC | — | 513 | 437 | 76 | 0 | 0 | 513 | 513 |
| RP | — | 479 | 453 | 26 | 0 | 0 | 479 | 479 |
| RB | — | 427 | 385 | 42 | 0 | 0 | 427 | 427 |
| RG | — | 423 | 379 | 43 | 0 | 1 | 423 | 423 |
| PCC | — | 376 | 290 | 86 | 0 | 0 | 376 | 376 |
| RA | — | 325 | 285 | 40 | 0 | 0 | 325 | 325 |
| PVDR | — | 303 | 0 | 0 | 303 | 0 | 303 | 303 |
| RX | — | 216 | 207 | 9 | 0 | 0 | 216 | 216 |
| CSC | — | 97 | 78 | 19 | 0 | 0 | 97 | 97 |
| RM | — | 83 | 71 | 12 | 0 | 0 | 83 | 83 |
| RU | — | 65 | 57 | 8 | 0 | 0 | 65 | 65 |
| RQ | — | 28 | 28 | 0 | 0 | 0 | 28 | 28 |
| RS | — | 9 | 9 | 0 | 0 | 0 | 9 | 9 |

## E — Qualifying business baseline

| Metric | Count |
|---|---|
| dbpr entity rows | 126666 |
| qualifying business entities | 126666 |
| relationships | 126486 |
| contractors covered | 126486 |
| entities linked | 126486 |
| orphan entities | 180 |
| contractors multiple entities | 0 |
| entities multiple contractors | 0 |

**QUALIFYING AGENT/PERSON MODEL: NOT IMPLEMENTED.** These are qualifying-business entities and relationships, not individual qualifying agents.

## F — Sunbiz / entity baseline

| Metric | Value |
|---|---|
| total entities | 6360919 |
| contractors with link | 74259 |
| contractors without link | 69257 |
| high confidence public safe links | 74259 |
| below public threshold links | 0 |
| contractors multiple sunbiz | 0 |
| entities shared by contractors | 9506 |
| exact duplicate relationships | 0 |
| coverage percent | 51.74 |

### Match methods
| Method | Count |
|---|---|
| exact_name_address | 42969 |
| exact_name_zip5 | 21894 |
| exact_name_city | 9396 |

### Actual entity statuses
| Status | Count |
|---|---|
| inactive | 4288358 |
| active | 2072561 |

Sunbiz linkage is inferred using deterministic multi-field rules. It is not a shared official DBPR/Sunbiz identifier.

## G — Contact baseline

### Canonical fields — Florida-regulated shells
| Metric | Count |
|---|---|
| phone | 0 |
| website | 0 |
| phone and website | 0 |
| neither | 143516 |

### Canonical fields — public/searchable profiles
| Metric | Count |
|---|---|
| phone | 0 |
| website | 0 |
| phone and website | 0 |
| neither | 143516 |

### Source observations from `licenses.raw_payload` / `fl_dbpr`
| Kind | Shells | Distinct observations | Rows | Conflicting shells |
|---|---|---|---|---|
| email | 0 | 0 | 0 | 0 |
| phone | 0 | 0 | 0 | 0 |
| website | 0 | 0 | 0 | 0 |

Source observations are not canonical contacts and were not promoted.

## H — Address coverage

| Field | Shells |
|---|---|
| dbpr license address | 140935 |
| city | 140928 |
| state | 143516 |
| zip | 140920 |
| county | 138081 |
| sunbiz principal address | 74258 |

DBPR mailing and Sunbiz principal addresses serve different purposes; differences are not automatically errors.

## I — Regulatory evidence baseline

| Dataset | Total | External keys | Complaints | License ID | Contractor ID | Both | Neither | Contractors | Licenses | Earliest | Latest |
|---|---|---|---|---|---|---|---|---|---|---|---|
| contractor_disc_lic | 1541 | 1541 | 760 | 987 | 0 | 0 | 554 | 0 | 245 | 2024-07-01 | 2026-07-07 |

A complaint is not treated as wrongdoing. Status, disposition, discipline, and final orders remain distinct source concepts.

## J — Adverse-evidence linkage forensic audit

### J1 — Numeric license-core collisions
| Metric | Count |
|---|---|
| collision cores | 16088 |
| licenses inside | 35824 |
| shell exposures | 35824 |
| distinct contractor shells exposed | 35824 |

### J2 — Collision-exposed discipline
| Metric | Count |
|---|---|
| total | 194 |
| with license id | 194 |
| with contractor id | 0 |
| with any link | 194 |
| with neither | 0 |
| currently linked | 0 |
| currently unlinked | 194 |
| unique contractor ids | 0 |
| unique license ids | 56 |
| unique complaints | 67 |

### J3 — Contractor/license consistency
| Class | Count |
|---|---|
| consistent | 0 |
| mismatch | 0 |
| license null contractor | 0 |
| discipline null contractor | 987 |

### J4 — License-type/occupation comparison
| Class | Count |
|---|---|
| missing | 0 |
| agreement | 0 |
| disagreement | 0 |
| not comparable | 987 |

### J5 — Conservative wrong-company assessment
| Class | Count |
|---|---|
| proven consistent | 0 |
| ambiguous collision exposed | 194 |
| suspect identifier type conflict | 0 |
| unresolved | 1541 |
| proven wrong | 0 |

Collision exposure alone is not classified as a wrong-company link. No records were repaired.

## K — Current publication exposure

| Metric | Count |
|---|---|
| discipline with contractor id | 0 |
| discipline with license id | 987 |
| collision exposed with contractor id | 0 |
| suspect reachable by profile logic | 0 |

There is no explicit publication state. Current application logic can reach discipline whenever `contractor_id` is populated.

## L — Missing state layers

| Layer | Status |
|---|---|
| Workers' compensation observations | NOT IMPLEMENTED / 0 STRUCTURED RECORDS |
| Exemptions | NOT IMPLEMENTED / 0 STRUCTURED RECORDS |
| Construction Policy Tracking | NOT IMPLEMENTED / 0 STRUCTURED RECORDS |
| Stop-work orders / workers' comp enforcement | NOT IMPLEMENTED / 0 STRUCTURED RECORDS |
| Qualifier-person relationships | NOT IMPLEMENTED / 0 STRUCTURED RECORDS |
| Contact observations | NOT IMPLEMENTED / 0 STRUCTURED RECORDS |
| Explicit review state | NOT IMPLEMENTED / 0 STRUCTURED RECORDS |
| Explicit publication state | NOT IMPLEMENTED / 0 STRUCTURED RECORDS |

This means ContractorTrustHub does not currently structure these layers; it does not imply Florida has no source data.

## M — Provenance baseline

### Licenses
| Metric | Count |
|---|---|
| total | 143516 |
| with ingest batch | 143516 |
| with last verified at | 143516 |
| with raw payload | 143516 |

### Sunbiz Entities
| Metric | Count |
|---|---|
| total | 6360919 |
| with ingest batch | 6360919 |
| with last verified at | 6360919 |
| with raw payload | 6360919 |

### Discipline
| Metric | Count |
|---|---|
| total | 1541 |
| with ingest batch | 1541 |
| with last verified at | 1541 |
| with raw payload | 1541 |
| missing source dataset | 0 |

## N — Public vs internal matrix

| Evidence type | Total | Linked | Publicly reachable | Unlinked/held by structure | Ambiguous/safety review |
|---|---|---|---|---|---|
| Florida licenses | 143516 | 143516 | 143516 | 0 | 0 |
| DBPR qualifying-business relationships | 126486 | 126486 | 0 | 126486 | 0 |
| Sunbiz links | 74259 | 74259 | 74259 | 0 | 0 |
| Canonical phone | 0 | 0 | 0 | 0 | 0 |
| Canonical website | 0 | 0 | 0 | 0 | 0 |
| Source email observations | 0 | 0 | 0 | 0 | 0 |
| Licensed discipline | 1541 | 0 | 0 | 1541 | 0 |
| ULA | 0 | 0 | 0 | 0 | 0 |
| Recovery Fund | 0 | 0 | 0 | 0 | 0 |
| Workers comp | 0 | 0 | 0 | 0 | 0 |
| Exemptions | 0 | 0 | 0 | 0 | 0 |
| Stop-work/compliance | 0 | 0 | 0 | 0 | 0 |

Rules: non-thin FL DBPR license profiles are searchable; Sunbiz requires confidence ≥ 0.90; linked discipline is profile-reachable; source contact observations and qualifying-business shells are not treated as public canonical evidence.

## O — Data reconciliation tests

| Assertion | Left | Right | Result |
|---|---|---|---|
| FL licenses = attached + unattached | 143516 | 143516 | PASS |
| regulated shells = one-license + multi-license | 143516 | 143516 | PASS |
| regulated shells = non-thin + thin | 143516 | 143516 | PASS |
| discipline datasets reconcile | 1541 | 1541 | PASS |
| discipline contractor linkage reconciles | 1541 | 1541 | PASS |
| Sunbiz coverage reconciles | 143516 | 143516 | PASS |
| canonical contact groups reconcile | 143516 | 143516 | PASS |
| external keys unique | 143516 | 143516 | PASS |
| mutation count | False | False | PASS |

## P — Manual forensic sample

| Stratum | Bounded sample |
|---|---|
| active_straightforward | {"display_name": "BENTZ AIR CONDITIONING", "license_external_key": "CAC008033", "occupation_code": "CAC", "slug": "cac008033-bentz-air-conditioning", "status_normalized": "active"} |
| inactive | {"display_name": "L C I BUILDING SYSTEMS", "license_external_key": "CAC008025", "occupation_code": "CAC", "slug": "cac008025-l-c-i-building-systems", "status_normalized": "inactive"} |
| multi_license_shell | Not available |
| with_sunbiz | Not available |
| without_identified_discipline | Not available |
| with_discipline | Not available |
| unattached_discipline | {"complaint_number": "2024071092", "discipline_external_key": "000416868cad37969c47fba3e72db2a1", "license_number_raw": "1533136", "source_dataset": "contractor_disc_lic"} |
| qualifying_business_shell | {"display_name": "GAPAL CONSTRUCTION INC.", "entity_external_key": "QB-ENTITY:0000641fdcddd1ad", "slug": "qb-entity-0000641fdcddd1ad-gapal-construction-inc", "status": "current"} |

Samples validate aggregate interpretation only and were not modified.

## Q — Official BEFORE/AFTER KPI table

| KPI | BEFORE — CTH-FL-BASE-001 | AFTER — Final FL State Audit | Net Gain |
|---|---|---|---|
| Florida-regulated canonical contractor shells | 143516 | TBD | TBD |
| Public/searchable Florida profiles | 143516 | TBD | TBD |
| Florida DBPR licenses | 143516 | TBD | TBD |
| Active licenses | 104444 | TBD | TBD |
| Inactive licenses | 14786 | TBD | TBD |
| Profiles with canonical phone | 0 | TBD | TBD |
| Profiles with canonical website | 0 | TBD | TBD |
| Profiles with regulator-source email observation | 0 | TBD | TBD |
| Profiles with Sunbiz entity | 74259 | TBD | TBD |
| Qualifying-business relationships | 126486 | TBD | TBD |
| Licensed DBPR regulatory matters | 1541 | TBD | TBD |
| Unlicensed activity records | 0 | TBD | TBD |
| Recovery Fund records | 0 | TBD | TBD |
| Workers' comp observations | 0 | TBD | TBD |
| Exemptions | 0 | TBD | TBD |
| Stop-work/compliance actions | 0 | TBD | TBD |
| Numeric license-core collision groups | 16088 | TBD | TBD |
| Discipline rows collision-exposed | 194 | TBD | TBD |
| Suspected wrong-company links | 0 | TBD | TBD |
| Proven wrong-company links | 0 | TBD | TBD |
| Unattached discipline records | 1541 | TBD | TBD |

## Interpretation safeguards

- Canonical contractor shells are not asserted to be unique real-world companies.
- No disciplinary action identified in covered data is not described as a clean record.
- No workers' compensation observation is currently structured in ContractorTrustHub; this is not an uninsured finding.
- Inactive status is not misconduct.
- Recovery Fund or complaint records are not treated as wrongdoing without supported disposition evidence.
