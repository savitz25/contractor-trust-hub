# ATH-METRICS-R2-02 ? Contractor reconciliation

Implementation and release record. Production certification is recorded after merge in the release receipt.

## Contract and ownership

Artifact: `data/home/contractor-network-metrics-v1.json`. Public endpoint: `/api/network-metrics`. `schemaVersion`: `contractor-network-metrics-v1`; `contractRevision`: `ATH-METRICS-R2-02`.

Generated: `2026-09-12T21:37:54.518Z`. Fingerprint: `22c4ccf3f53d78c37ad6f19f9303af2676c69bf1fe8c45d9fad3f06c6b3502cb`.

Accepted state snapshots and a read-only aggregate census feed one offline generator. The homepage consumes this generated contract. No canonical source dataset, identity association, database row, or AskTrustHub code was changed. No other specialist hub code was changed. The new API is an additive read-only specialist contract endpoint.

## Reproduce and validate

```sh
npm ci
npm run home:metrics
npm run check:metrics-r2
npm test
npm run build
```

`home:metrics` requires no secrets or database connection. It fails on missing files/counts, invalid counts or reconciliation failure. `check:metrics-r2` regenerates in memory using the committed generation clock and fails non-zero on byte drift; it never writes. CI runs that command on PRs and main. Generation time legitimately changes on an explicit regeneration; source/retrieval/snapshot clocks do not advance. Source fingerprints include canonical accepted-input hashes and relevant generator code. `acceptedSources[].sha256` hashes canonical JSON, not raw HTTP bytes; raw acquisition hashes remain inside accepted snapshots.

Refreshing the national census is a separate, explicitly invoked, read-only acquisition step: set `METRICS_ENV_FILE` to a local credential file, then run `node scripts/export_network_metric_census.mjs` (Move: `node --import tsx scripts/export_network_metric_census.mjs`). Review the aggregate census diff before regenerating. Neither generator runs source acquisitions at build time. Prompt 6 owns scheduling, source-triggered automation and age policy.

New state formats require an explicit grain adapter/registration in the generator; they never require pasting new totals into JSX. Registered accepted source updates flow through regeneration. Contractor also preserves accepted state/local snapshots in `acceptedStateDatasets`; Move exports its accepted state snapshots and per-capability unknowns. Automatic discovery is not permission to invent a new identity sum.

## Correctness and grains

The old Colorado overlay added all 17,910 EC/PC business credentials to the public credential total, but added only the 7,936 exact-Active credentials to the live status partition. It updated the broader graph separately. The defect was overlay arithmetic, not blank status values or an outdated source file. The new generator reads every grouped status from accepted inputs and classifies exactly once. Novel, missing, conditional and unsupported statuses remain `other`; they are not silently promoted to active or adverse.

| Previous / new | Universe | Partition | Remainder |
|---|---:|---:|---:|
| Previous accepted public cohort | 662,331 | 652,357 | 9,974 |
| Reconciled public cohort | 662,331 | 662,331 | 0 |

Omitted CO native statuses: Expired 9,508; Need Master Hire ? Cannot Practice 357; Revoked 50; Voluntary Surrender 27; Cancelled 22; Active ? With Conditions 6; Surrendered 2; Suspended 2. The new CO contribution is active 7,936, expired 9,508, revoked 50, suspended 2 and other 414. Every native value/class is retained in `statusReconciliation.groups`.

| New public bucket | Count |
|---|---:|
| active | 471,354 |
| current | 36,579 |
| inactive | 58,880 |
| expired | 75,385 |
| suspended | 9,824 |
| revoked | 64 |
| unlicensed | 257 |
| other | 9,988 |

Accepted research credential universe 1,284,124 = public Verify cohort 662,331 + explicit outside-cohort research credentials 621,793. Groups expose `included`, native/normalized status, credential class and bucket. The broader graph partition also reconciles independently.

The read-only database census contains 1,266,214 license rows and no `co_dora` rows. Adding the accepted local 17,910 EC/PC credentials gives 1,284,124 accepted research credential records. A future overlapping CO database contribution makes generation fail pending explicit ownership reconciliation. No synthetic per-source counts are used.

The 662,331 public credential count is not a business/company count: legacy trade credentials can include people. CO business EC/PC and person trade classes are explicitly separated; all six active person classes are exported independently (30,432 exact-active rows across these classes). Illinois QP IDs remain separate from its 4,675 active business IDs. VA/NY/IL snapshots and NYC permits, worksite identifiers, tax lots and ACRIS documents are supplemental contracts; they do not inflate the public Verify denominator.

`regulatory_discipline_action_rows` retains the accepted 75,664 observation-row scope: 69,674 database action rows plus 5,990 local Colorado credential-linked observations. It is not a count of bad contractors or uniquely affected credentials. The 139,586 indexed permit rows remain separate from local NYC permits and NJ construction-source rows.

`scripts/build_homepage_intel.mjs` and the Colorado overlay now delegate to the unified generator. The homepage?s state intelligence count is a route/evidence publication count, not specialist completion. Existing richer jurisdiction modules consume snapshots through the generated contract.

## Four-state inclusion

| State | Contractor/Move accepted treatment |
|---|---|
| CO | EC/PC business credentials and all native statuses; separate person classes and disciplinary observations. |
| VA | 53,840 Class A/B/C license numbers and 120 exact revocation observations; supplemental scope. |
| NY | 14,665 public-work certificates; 36 historical periods. NYC HIC IDs/BUIDs, complaints, inspections, charges, names, DOB/BIS permits/jobs/BBLs/BINs, PLUTO tax lots and ACRIS Master/legal/document classes remain separate. |
| IL | 33,891 roofing rows / 33,290 IDs; 4,891 active business rows / 4,675 IDs; 12,042 active QP IDs; 1,393 discipline rows / 836 IDs. |

## Exported metric inventory

Aliased homepage evidence rows are presentations of existing grains, not additive independent universes. There is deliberately no cross-grain network total.

| Field | Value | Grain | Official source clock |
|---|---:|---|---|
| `live_credential_records` | 662,331 | license_credential_record | unknown |
| `live_active_current_credential_records` | 507,933 | license_credential_record_active_current | unknown |
| `live_researched_states` | 11 | live_researched_state | unknown |
| `research_graph_license_records` | 1,284,124 | research_graph_license_record | unknown |
| `regulatory_discipline_action_rows` | 75,664 | discipline_action_row | unknown |
| `indexed_permit_source_records` | 139,586 | permit_source_record | unknown |
| `nj_construction_source_records` | 2,678,341 | municipal_permit_or_certificate_source_record | 2026-08-07 |
| `published_county_intelligence_pages` | 8 | published_county_intelligence_page | unknown |
| `nj_current_municipalities` | 564 | current_municipality | 2026-08-13 |
| `public_contact_observations` | 16,009 | public_contact_observation | unknown |
| `research_graph_contractor_identities` | 1,392,730 | research_graph_contractor_identity | unknown |
| `published_ca_city_local_intelligence_pages` | 2 | published_city_local_intelligence_page | unknown |
| `published_nyc_local_intelligence_pages` | 1 | published_city_local_intelligence_page | unknown |
| `ca_acquired_cslb_license_master_rows_truncated` | 75,572 | acquired_partial_license_master_row | 2026-09-02 |
| `evidence_live_credentials` | 662,331 | license_credential_record | unknown |
| `evidence_research_graph_licenses` | 1,284,124 | research_graph_license_record | unknown |
| `evidence_az_current` | 57,886 | ROC current-posting license row | 2026-09-02 |
| `evidence_va_class_abc` | 53,840 | DPOR contractor-business license number | 2026-09-08 |
| `evidence_ny_pw_registry` | 14,665 | NYSDOL public-work contractor registry certificate | 2026-09-11 |
| `evidence_nyc_dcwp_hic_active` | 13,385 | source-native Active NYC DCWP Home Improvement Contractor license number | 2026-08-20 |
| `evidence_il_roofing_active_business` | 4,675 | distinct IDFPR licensed roofing contractor license_number (ACTIVE, business=Y) | 2026-09-11 |
| `evidence_wa_registrations` | 160,923 | one row = one ContractorLicenseNumber | 2026-09-04 |
| `evidence_ca_license_master` | 75,572 | acquired partial License Master row | 2026-09-02 |
| `evidence_tx_business_credentials` | 38,915 | specialty business credential | 2026-09-03 |
| `evidence_regulatory_actions` | 75,664 | discipline_action_row | unknown |
| `evidence_fl_dbpr_discipline` | 6,457 | discipline_action_row | unknown |
| `evidence_fl_recovery_fund` | 1,679 | discipline_action_row | unknown |
| `evidence_fl_dbpr_unlicensed` | 11,691 | discipline_action_row | unknown |
| `evidence_fl_dfs_stop_work` | 48,254 | discipline_action_row | unknown |
| `evidence_nj_public_works_regulatory` | 1,898 | family-separated public-works regulatory source row | 2026-08-13 |
| `evidence_az_discipline` | 459 | ROC disciplinary action row | 2026-09-04 |
| `evidence_va_revocations` | 120 | revocation-release observation with exact license number | 2026-08-25 |
| `evidence_indexed_permits` | 139,586 | permit_source_record | unknown |
| `evidence_nj_construction` | 2,678,341 | permit-issued or certificate-issued source record | 2026-08-07 |
| `evidence_austin_permits` | 2,373,854 | one row = one issued permit (permit_number unique in source metadata) | 2026-09-04 |
| `evidence_sf_permits` | 1,294,909 | permit at an address | 2026-09-02 |
| `evidence_la_current_permits` | 409,619 | issued building permit | 2026-08-31 |
| `evidence_la_cofo` | 132,426 | certificate of occupancy | weekly / 2026-08-31 |
| `evidence_wa_bond_rows` | 176,920 | one row = one bond filing associated with a ContractorLicenseNumber | 2026-09-04 |
| `evidence_wa_bond_identities` | 82,635 | distinct ContractorLicenseNumber with bond evidence | 2026-09-04 |
| `evidence_wa_insurance_rows` | 77,005 | one row = one liability-insurance filing associated with a ContractorLicenseNumber | 2026-09-04 |
| `evidence_wa_insurance_identities` | 70,953 | distinct ContractorLicenseNumber with insurance evidence | 2026-09-04 |
| `evidence_wa_both_identities` | 70,622 | distinct ContractorLicenseNumber in both filing files | 2026-09-04 |
| `evidence_graph_contacts` | 16,009 | public_contact_observation | unknown |
| `evidence_wa_phones` | 160,819 | source-published business phone field | 2026-09-04 |
| `evidence_wa_principals` | 250,349 | principal relationship row | 2026-09-04 |
| `evidence_az_addresses` | 58,122 | business address on ROC license row | 2026-09-04 |
| `evidence_az_qualifiers` | 56,281 | name string on the license row; QP Exempt is a source-native sentinel, not a person identity | 2026-09-04 |
| `evidence_tx_vendors` | 3,337 | construction-related procurement vendor row | 2026-09-03 |
| `evidence_wa_public_works` | 347,082 | public-works project-detail row | 2026-09-04 |
| `evidence_state_pages` | 10 | published state intelligence route | unknown |
| `evidence_county_pages` | 8 | published_county_intelligence_page | 2026-08-13 |
| `evidence_ca_city_pages` | 2 | published_city_local_intelligence_page | 2026-09-02 |
| `evidence_nyc_local_page` | 1 | published_city_local_intelligence_page | 2026-08-20 |
| `evidence_austin_page` | 1 | published city intelligence route | 2026-09-04 |
| `evidence_CO_business_credentials_EC_active_exact` | 4,789 | business_credential | unknown |
| `evidence_CO_business_credentials_PC_active_exact` | 3,147 | business_credential | unknown |
| `evidence_CO_business_credentials_combined_active_exact_if_shown_value` | 7,936 | business_credential | unknown |
| `evidence_CO_discipline_contractor_relevant_rows` | 5,990 | disciplinary_observation | unknown |
| `evidence_CO_individual_trades_prefixes_ME_active_exact` | 7,441 | person_credential | unknown |
| `evidence_CO_individual_trades_prefixes_JW_active_exact` | 12,549 | person_credential | unknown |
| `evidence_CO_individual_trades_prefixes_RW_active_exact` | 2,031 | person_credential | unknown |
| `evidence_CO_individual_trades_prefixes_MP_active_exact` | 4,954 | person_credential | unknown |
| `evidence_CO_individual_trades_prefixes_JP_active_exact` | 2,911 | person_credential | unknown |
| `evidence_CO_individual_trades_prefixes_RP_active_exact` | 546 | person_credential | unknown |
| `evidence_NY_debarment_registry_field_has_been_debarred_yes` | 36 | historical_debarment_period | 2026-09-11 |
| `evidence_IL_roofing_source_rows` | 33,891 | roofing_source_row | 2026-09-11 |
| `evidence_IL_roofing_distinct_license_ids` | 33,290 | business_or_person_credential_id | 2026-09-11 |
| `evidence_IL_business_licenses_active_business_y_rows` | 4,891 | business_credential_source_row | 2026-09-11 |
| `evidence_IL_qualifying_parties_active_distinct_license_ids` | 12,042 | person_credential_id | 2026-09-11 |
| `evidence_IL_discipline_flag_rows` | 1,393 | disciplinary_observation | 2026-09-11 |
| `evidence_IL_discipline_flag_distinct_license_ids` | 836 | credential_id_with_evidence | 2026-09-11 |
| `evidence_new_york_city_licenses_distinct_license_ids` | 18,931 | license_id | 2026-08-20 |
| `evidence_new_york_city_licenses_distinct_business_unique_ids` | 18,684 | dcwp_buid | 2026-08-20 |
| `evidence_new_york_city_complaints_parsed_rows` | 3,341 | complaint_observation | 2026-09-02 |
| `evidence_new_york_city_inspections_parsed_rows` | 102 | inspection_observation | 2026-09-04 |
| `evidence_new_york_city_charges_parsed_rows` | 558 | charge_observation | 2026-09-02 |
| `evidence_new_york_city_wall_of_shame_name_count` | 19 | published_name | 2026-09-01 |
| `evidence_new_york_city_dob_dob_now_parsed_rows` | 337,613 | permit_observation | 2026-09-11 |
| `evidence_new_york_city_dob_dob_now_distinct_permit_ids` | 228,515 | dobnow_permit_id | 2026-09-11 |
| `evidence_new_york_city_dob_dob_now_distinct_job_filing_numbers` | 219,791 | job_filing_id | 2026-09-11 |
| `evidence_new_york_city_dob_dob_now_distinct_bbls` | 64,375 | bbl | 2026-09-11 |
| `evidence_new_york_city_dob_dob_now_distinct_bins` | 70,797 | bin | 2026-09-11 |
| `evidence_new_york_city_dob_legacy_distinct_permit_ids` | 18,858 | bis_permit_id | 2026-09-11 |
| `evidence_new_york_city_dob_legacy_distinct_job_ids` | 8,196 | bis_job_id | 2026-09-11 |
| `evidence_new_york_city_dob_pluto_universe_rows` | 858,284 | tax_lot | 2026-08-24 |
| `evidence_new_york_city_dob_pluto_matched_rows` | 66,525 | matched_bbl | 2026-08-24 |
| `evidence_new_york_city_acris_master_parsed_rows` | 581,566 | document_observation | 2026-09-08 |
| `evidence_new_york_city_acris_master_distinct_document_ids` | 580,444 | document_id | 2026-09-08 |
| `evidence_new_york_city_acris_legals_parsed_rows` | 829,724 | legal_row | 2026-09-08 |
| `evidence_new_york_city_acris_linking_distinct_bbls` | 258,026 | bbl | unknown |
| `evidence_new_york_city_acris_linking_documents_with_bbl` | 577,863 | document_id | unknown |
| `evidence_new_york_city_acris_master_display_group_counts_deed` | 139,675 | deed_type_observation | 2026-09-08 |
| `evidence_new_york_city_acris_master_display_group_counts_mortgage` | 90,438 | mortgage_type_observation | 2026-09-08 |
| `evidence_new_york_city_acris_linking_documents_with_gt1_bbl` | 41,578 | document_id | unknown |

## Ask handoff (Prompt 5)

Ask was not changed. It may reject the revised fingerprint/shape and continue serving its stale fallback until Prompt 5. Do not restore the old omissions to satisfy its verifier. Consumers must handle nullable values, preserve explicit grains, and use separate source clocks. `schemaVersion` keeps the existing v1 filename convention; `contractRevision` identifies this reconciliation.

Both contracts add `acceptedSources`, `acceptedStateDatasets`, `stateCapabilities` and per-metric `retrievedAt`/`snapshotAsOf`. Capability statuses distinguish acquisition/live evidence from search/request/unknown and never infer completion from a route. Contractor adds `statusReconciliation`, `licensingStatus.graph`, `homepageEvidence`, and `evidence_*` metric keys. Move adds `illinois`, `virginia.hhgAuthorityIdentities`, `virginia.propertyAuthorityIdentities`, `newYork.distinctCaseNumbers`, null roster fields, `homepageStateCards`, `consumerRules`, and optional per-metric `presentation`. See inventory above for exact public keys.

Ask must stop pinning the previous fingerprint and expecting a single sourceAsOf or non-null count everywhere; it must consume specialist grain/value-state/capability semantics. No state or federal count should be reinterpreted or recomputed by Ask.

## Validation and release

Focused tests: `npm run check:metrics-r2` passes, including rendered homepage-to-artifact comparisons, historical regression, state separation and null-vs-zero checks. Broader `npm test` passed for both hubs. Production builds and release identities are recorded in the release receipt. No required CI check is bypassed.

Source snapshots were read only. Read-only census extraction produced a new metrics input artifact, not a canonical source mutation. The existing numerical-equality guard tests remain legacy constraints; stronger structural/status/null checks are added here. Network-wide schedules and Ask reconciliation remain deliberately outside this prompt.


## Files changed

- `.github/workflows/contractor-network-metrics.yml`
- `app/api/network-metrics/route.ts`
- `components/home-intel/ContractorHomeIntelligence.tsx`
- `components/home/HomeEvidenceInventory.tsx`
- `components/home/HomeEvidenceLayers.tsx`
- `data/home/contractor-hub-intel-v2.json`
- `data/home/contractor-network-metrics-v1.json`
- `data/metrics/accepted-network-census-v1.json`
- `docs/metrics/ATH-METRICS-R2-02-IMPLEMENTATION.md`
- `lib/home-intel/build.ts`
- `lib/home-intel/evidence-inventory.ts`
- `lib/metrics/accepted-contract.ts`
- `lib/metrics/accepted-homepage-evidence.ts`
- `lib/metrics/compute-contractor-network-metrics.ts`
- `lib/metrics/contractor-network-metrics-v1.ts`
- `lib/metrics/credential-status.ts`
- `lib/metrics/project-intel-v2.ts`
- `package-lock.json`
- `package.json`
- `scripts/build_homepage_intel.mjs`
- `scripts/build_network_metrics_v1.mjs`
- `scripts/colorado/overlay_network_metrics.mjs`
- `scripts/export_network_metric_census.mjs`
- `scripts/network_expansion_metrics.mjs`
- `scripts/test_co_con_001.py`
- `scripts/test_metrics_homepage_r2.tsx`
- `scripts/test_metrics_r2.ts`
