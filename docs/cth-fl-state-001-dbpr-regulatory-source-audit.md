# CTH-FL-STATE-001 — Florida DBPR Regulatory Source Audit

Audit date: 2026-08-23 UTC

Repository baseline: `013ac9b87913ab99c3d7037849a8d2cdf73e064a`

Production access: PostgreSQL 17.6, `REPEATABLE READ READ ONLY`, 30-second statement timeout, rollback

Mutation performed: **NO**

## 1. Executive Summary

Florida DBPR/CILB publishes three authoritative, machine-readable regulatory families for construction: Licensed Contractor Discipline, ULA Contractor Discipline, and Recovery Fund Contractor Discipline. Each family currently has five fiscal-year CSVs, FY 2021–22 through FY 2025–26. All 15 URLs were downloaded successfully from DBPR and their layouts were inspected. The files contain 6,457 licensed rows, 11,691 ULA rows, and 1,679 Recovery Fund rows.

Production contains only the 1,541 rows in the FY 2024–25 licensed file. Its stored raw payload is an exact multiset match to the official file accessed for this audit. Production has no ULA or Recovery Fund rows and omits four other published licensed fiscal years.

The official `License Type` vocabulary provides the missing identity dimension. For the 194 collision-exposed production rows, type plus number disambiguates 157; 37 remain ambiguous because the expected credential is absent or not uniquely represented. Only 69 current collision links are type-consistent. There are 125 collision-exposed type conflicts, including 68 rows for which an exact official type-plus-number credential exists but the current `license_id` points elsewhere. Across all 987 linked rows, 491 current links conflict with the official type mapping. These links are not presently profile-reachable because `contractor_id` is null, but they require a bounded safety fix before new adverse data is loaded.

The regulatory CSVs contain respondent/address observations but no email, phone, website, named-contact, or title fields. ULA lacks a license-number field and must remain respondent/case evidence unless a regulator identifier or another deterministic anchor exists. Name-only attachment is prohibited. Recovery Fund rows represent fund claims with source dispositions such as `RF Claim Granted` or `RF Claim Closed`; they must not be described generically as contractor wrongdoing.

## 2. Current Baseline Context

CTH-FL-BASE-001 measured 143,516 Florida DBPR licenses and canonical contractor shells. Production regulatory evidence comprises `contractor_disc_lic` only: 1,541 rows, 987 with `license_id`, zero with `contractor_id`, and 554 with neither. There are 16,088 numeric-core collision groups and 194 regulatory rows exposed to those collisions. The current loader's numeric-core-only selection is unsuitable for adverse evidence.

## 3. Licensed Discipline Sources

Authority: Florida Department of Business and Professional Regulation, Construction Industry Licensing Board. The authoritative [Construction Industry Public Records page](https://www2.myfloridalicense.com/construction-industry/public-records/) links all five CSVs. The official [DBPR code dictionary](https://www2.myfloridalicense.com/about-us/understanding-dbpr-codes/) defines board `06`, occupation codes, class codes, and descriptions.

| Fiscal year | Rows | Entered-date coverage | Distinct complaints | Official file |
|---|---:|---|---:|---|
| 2021–22 | 1,109 | 2021-07-01–2022-06-30 | 620 | [CSV](https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_lic_2122.csv) |
| 2022–23 | 1,534 | 2022-07-01–2023-06-30 | 744 | [CSV](https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_lic_2223.csv) |
| 2023–24 | 1,878 | 2023-07-01–2024-06-29 | 846 | [CSV](https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_lic_2324.csv) |
| 2024–25 | 1,541 | 2024-07-01–2025-06-30 | 760 | [CSV](https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_lic_2425.csv) |
| 2025–26 | 395 | 2025-07-02–2026-05-19 | 190 | [CSV](https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_lic_2526.csv) |

The files are free bulk CSVs (LOW acquisition difficulty). DBPR does not state an update cadence on the landing page. HTTP metadata showed the sampled files were updated July 27, 2026, so consumers must treat them as revisable fiscal-year extracts and retain extraction time and checksum.

One row is not necessarily one complaint or final order. Complaint numbers repeat because rows carry separate violation/discipline details: 6,457 rows represent 3,160 fiscal-file complaint occurrences, with 3,297 additional rows sharing a complaint number. The row grain is therefore a respondent regulatory-detail line within a complaint extract. `Disposition` establishes the source status; values include `Final Order`, `Citation filed`, dismissal/closure states, and blanks. A complaint identifier alone is not discipline.

Official fields are: `License Type`, `License Nbr`, `Respondent Name`, three address lines, city, state, ZIP, county, `Complaint Nbr`, `Classification`, `Entered Date`, `Disposition`, `Disposition Date`, `Discipline Date - Description`, and `Violation Code`. The bulk files do not expose a final-order document identifier or URL. A complaint number can be used to search official indexed orders, but a document must be resolved and validated rather than generated by an unverified URL pattern.

## 4. Unlicensed Activity Sources

The same DBPR public-records page publishes five ULA CSVs:

| Fiscal year | Rows | Entered-date coverage | Distinct complaints | Official file |
|---|---:|---|---:|---|
| 2021–22 | 2,312 | 2021-07-01–2022-06-30 | 690 | [CSV](https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_ula_2122.csv) |
| 2022–23 | 2,631 | 2022-07-01–2023-06-30 | 759 | [CSV](https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_ula_2223.csv) |
| 2023–24 | 2,568 | 2023-07-01–2024-06-28 | 1,104 | [CSV](https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_ula_2324.csv) |
| 2024–25 | 2,338 | 2024-07-01–2025-06-30 | 1,173 | [CSV](https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_ula_2425.csv) |
| 2025–26 | 1,842 | 2025-07-01–2026-06-29 | 971 | [CSV](https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_ula_2526.csv) |

ULA uses the same detail-line grain but deliberately omits `License Nbr`. `License Type` describes the type of activity at issue, not a credential held by the respondent. Classifications include `Unlicensed Activity`, `Repeat Unlicensed`, and audit/investigation variants. Dispositions include `Final Order`, `Citation filed`, `Notice to Cease & Desist Issued`, insufficient-evidence, dismissal/closure, and blank states. The [official DBPR ULA page](https://www2.myfloridalicense.com/unlicensed-activity/) explains that administrative complaints may proceed to hearings and that final orders issued since January 1, 2011 are available through the official DOAH indexed-orders system.

Acquisition is FREE BULK DOWNLOAD / LOW. Automatic attachment to an existing contractor is not supported by these CSVs: complaint number identifies the matter, but respondent name and address do not prove canonical-company identity. Store ULA initially as independent respondent/case evidence; require an official cross-reference or a reviewed deterministic business identifier before contractor linkage.

## 5. Recovery Fund Sources

DBPR publishes five Recovery Fund CSVs:

| Fiscal year | Rows | Distinct claims | Entered-date coverage | Official file |
|---|---:|---:|---|---|
| 2021–22 | 548 | 275 | 2021-07-13–2022-06-29 | [CSV](https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_rf_2122.csv) |
| 2022–23 | 256 | 128 | 2022-07-06–2023-06-29 | [CSV](https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_rf_2223.csv) |
| 2023–24 | 216 | 108 | 2023-07-07–2024-06-26 | [CSV](https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_rf_2324.csv) |
| 2024–25 | 647 | 324 | 2024-07-09–2025-06-24 | [CSV](https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_rf_2425.csv) |
| 2025–26 | 12 | 6 | 2025-07-02–2025-07-15 | [CSV](https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_rf_2526.csv) |

The Recovery layout replaces `Complaint Nbr` with `Claim Nbr`; otherwise it carries the licensed fields, including license type/number and respondent/address. Rows repeat within claims, so the grain is a claim detail/discipline-description line, not one claim or payment. Source dispositions are `RF Claim Granted`, `RF Claim Closed`, and rare blanks.

The [official claim form](https://www2.myfloridalicense.com/pro/cilb/documents/recov_form.pdf) and [CILB Recovery Fund FAQ](https://www2.myfloridalicense.com/construction-industry/faqs/) establish separate stages: application, eligibility/completeness review, committee hearing, board final order, and payment subject to statutory and aggregate limits. A claim submission is not a finding of wrongdoing; a granted claim is a fund determination and must retain that precise label. The CSV contains no claimant name or award amount, which is desirable for consumer-privacy minimization. Complete payment/accounting history is not exposed by this bulk layout; a public-records request is likely if that distinct use case is approved.

Acquisition is FREE BULK DOWNLOAD / LOW for the published claim extracts; detailed historical payment records are PUBLIC RECORDS REQUEST LIKELY / MODERATE.

## 6. Historical Coverage Matrix

| Source | Earliest bulk | Latest bulk | Continuous? | Current file | Historical files | Machine readable |
|---|---|---|---|---|---|---|
| Licensed discipline | FY 2021–22 | FY 2025–26 | Yes, by entered date across five FY files | FY 2025–26 | Four prior FY CSVs | Yes, CSV |
| ULA | FY 2021–22 | FY 2025–26 | Yes, by entered date across five FY files | FY 2025–26 | Four prior FY CSVs | Yes, CSV |
| Recovery Fund | FY 2021–22 | FY 2025–26 | Yes, by entered date across five FY files | FY 2025–26 | Four prior FY CSVs | Yes, CSV |
| DBPR/CILB meeting materials | At least 2008 | Current | No normalized continuity | Current agendas/minutes | Archived agendas/minutes | PDFs/HTML |
| DOAH agency indexed final orders | 2011 | Current | Search coverage stated by DBPR | Search portal | Indexed orders | Lookup/PDF, not qualified bulk |

Disposition dates can occur years after the entered fiscal year; therefore files must be keyed by their published FY/entered-date population and re-fetched for late dispositions. No bulk CSVs earlier than FY 2021–22 were linked from the page. Older complaint/final-order evidence exists in official lookup and board archives, so “not found in published bulk years” must never be stated as “no discipline exists.” Historical pre-FY21/22 completeness requires a scoped DBPR public-records request or a separately qualified indexed-order acquisition.

## 7. Current 1,541-Row Source Reconciliation

Production batch metadata identifies `fl_dbpr / contractor_disc_lic`, extracted 2026-08-11, staged from `data/staging/fl_dbpr_full/discipline_normalized.csv`, checksum prefix `323c25221bd2`. The batch row-count field is null. The official FY 2024–25 file has exactly 1,541 rows; comparison of all 17 raw fields found 1,541/1,541 exact multiset overlap, with zero official-only and zero production-only rows.

The stored layer is therefore complete for the currently published FY 2024–25 licensed CSV as accessed on 2026-08-23, but incomplete for the DBPR bulk series: 4,916 additional licensed rows occur in the other four files, plus 11,691 ULA and 1,679 Recovery Fund rows. Raw row counts are not unique-case counts and should not be summed into a “disciplinary cases” KPI without case-level deduplication.

## 8. Identifier Inventory

| Family | Matter ID | Credential data | Respondent data | Safe automatic anchor |
|---|---|---|---|---|
| Licensed | `Complaint Nbr` | `License Type` + `License Nbr` | name/address | Exact constructed full credential, then exact `licenses.external_key` |
| ULA | `Complaint Nbr` | No license number; type is alleged activity | name/address | Matter ID only; no contractor auto-link from this extract |
| Recovery Fund | `Claim Nbr` | `License Type` + `License Nbr` | name/address | Exact constructed full credential, then exact `licenses.external_key` |

For board 06, DBPR's code dictionary maps the descriptive type to the credential prefix. The full external key is prefix plus the source license number, preserving the source number for audit. `source_system + source_dataset + fiscal year + matter identifier + stable row-detail digest` should identify source rows. Matter number alone is not row-unique because detail lines repeat.

## 9. License-Type Crosswalk

The machine-readable proposal is in `artifacts/cth-fl-state-001-license-type-crosswalk.json`. Twelve observed labels match the official DBPR dictionary directly: CAC, CBC, CGC, CMC, CFC, CPC, CRC, CCC, CVC, SCC, RP, and RR. `Construction Financial Officer` deterministically maps to FRO: DBPR's credential pages display that label with an FRO number, while the code dictionary describes FRO as `Financial Responsible Officer`.

Observed mapping totals: 12 `EXACT_OFFICIAL`, 1 `DETERMINISTIC`, 0 one-to-many, 0 ambiguous, 0 unknown. This is a mapping of the values observed in the FY 2024–25 production source, not a claim that future files cannot introduce new labels. Unknown values must fail closed.

## 10. 194 Collision-Exposed Row Analysis

All measurements were computed in one read-only production snapshot using the loader's numeric-core normalization and the official type crosswalk.

| Classification | Rows |
|---|---:|
| Collision-exposed | 194 |
| Safely disambiguated by type + number | 157 |
| Still ambiguous/not represented uniquely | 37 |
| Current link type-consistent | 69 |
| Current link conflicts with expected type | 125 |
| Exact expected external key exists but current link differs | 68 |

The 68 exact full-key conflicts are deterministic current-link concerns, not mere collision exposure: the official type-plus-number credential exists in `licenses`, but `discipline_actions.license_id` points to a different credential. They are not contractor/profile reachable today (`contractor_id` remains null), and no repair was made. The remaining type conflicts require the same safety hold; some expected credentials are absent from the current license extract.

## 11. 554 Fully-Unattached Row Analysis

All 554 contain a non-empty, parseable numeric license number and non-empty mapped license type. They represent 70 distinct numeric cores and 329 complaint numbers. None has any numeric-core candidate in the current `licenses` table, and none has an exact full-key candidate; safe match potential against the current license table is therefore **0**.

Cause classification: 554 `LICENSE_NOT_PRESENT_IN_CURRENT_LICENSE_TABLE`; zero missing credential; zero malformed/unparseable credential; zero missing type; zero profession-outside-crosswalk. DBPR states that its current licensee download excludes null/void, delinquent, and involuntarily inactive records, so historical/excluded status is a plausible cause, but it is not proven row-by-row. A historical credential source or official lookup must resolve these rows; respondent-name matching is prohibited.

## 12. Complaint / Disposition / Final Order Semantics

- **Complaint/case:** the regulator matter identifier. It may have multiple detail rows and is not proof of misconduct.
- **Allegation/classification:** the source's category of activity or processing lane. It must be retained separately from outcome.
- **Investigation:** a process stage; audit/investigation classifications are not final findings.
- **Disposition:** the source's outcome/status text. Blanks, dismissals, insufficient evidence, citations, and final orders must remain distinct.
- **Discipline/sanction:** only the official discipline-description/violation fields and disposition support a disciplinary characterization.
- **Final order:** supported when `Disposition = Final Order` or by a validated official order document. The CSV supplies no final-order URL or filing number.

DBPR states that ULA final orders since 2011 are available through DOAH's agency indexed orders. Resolution should search by complaint number as agency case number and validate respondent/profession; do not synthesize URLs or bulk-download thousands of PDFs in this phase.

## 13. Contact-Bearing Fields

Across all three CSV families:

| Observation | Availability |
|---|---:|
| Primary email | 0 fields |
| Second/subsequent email | 0 fields |
| Primary phone | 0 fields |
| Second/subsequent phone | 0 fields |
| Website | 0 fields |
| Named contact beyond respondent | 0 fields |
| Second/subsequent contact person | 0 fields |
| Role/title | 0 fields |
| Fax/extensions | 0 fields |
| Address | respondent name, three address lines, city, state, ZIP, county |

These are source address observations, not canonical business contacts. Recovery Fund application materials contain claimant contact/financial information, but it is unnecessary consumer PII and must not be acquired or published for contractor profiles.

## 14. Multiple Contact Observation Requirements

Future adapters must emit every qualified contact occurrence, not a single flattened value. They must preserve source record, person, role, ordinal, observed/extracted dates, confidence, match outcome, history, public eligibility, and raw provenance. A second or third email, phone, person, address, or location may not be discarded because a canonical value already exists. The present regulatory CSVs yield address observations only, but the contract must accommodate richer state and later local sources.

## 15. Proposed Contact Observation Architecture

Add one reusable `contact_observations` table rather than expanding canonical contractor columns:

`id, contractor_id nullable, entity_id nullable, contact_type, normalized_value, display_value, contact_person_name nullable, role_title nullable, source_system, source_dataset, source_record_key, source_field, source_date nullable, observed_at, valid_from nullable, valid_to nullable, is_current nullable, match_method, confidence, identity_state, publication_state, preferred_rank nullable, ingest_batch_id, raw_locator`.

Use a source-stable uniqueness key over source/dataset/record/field/value/person/role. Preserve alternatives and history. A separate reviewed preference can select a public canonical contact without deleting observations. Sensitive claimant contacts must be excluded at ingestion. This design is reusable across state, county, municipal, and Ask Trust Hub verticals, but is not implemented here.

## 16. Adverse-Evidence Matching Contract

- **EXACT:** regulator type mapped by a versioned official dictionary plus source license number constructs a full credential exactly equal to one `licenses.external_key`; or a direct official credential/external key is supplied. Exactly one license row must result.
- **DETERMINISTIC:** an official regulator identifier crosswalk, or exact license number + exact official type/board/class combination, selects one license and no conflicting identifier exists. Log the fields and mapping version.
- **REVIEW_REQUIRED:** official evidence is meaningful but identity has multiple candidates, a mapping is one-to-many/new, identifiers conflict, or only a strong business/entity combination exists. Never profile-reachable automatically.
- **UNRESOLVED:** no stable identifier, no current credential candidate, respondent-only ULA, missing/malformed values, or insufficient evidence.

`NUMERIC-CORE-ONLY AUTO LINK = PROHIBITED`. Name-only adverse matching is also prohibited. License linkage does not imply contractor linkage. Contractor linkage may be derived only after the exact/deterministic license is linked and its canonical relationship is verified; changing the license's contractor later invalidates the derived link and returns the event to review.

## 17. Publication Safety Contract

Use explicit identity and publication state, minimally: `INTERNAL`, `VERIFIED`, `REVIEW_REQUIRED`, `UNRESOLVED`, `PUBLIC_ELIGIBLE`, `WITHHELD`. Store match outcome separately from source disposition.

New rows enter `INTERNAL`. Automatic `PUBLIC_ELIGIBLE` requires an authoritative source, exact current credential, unique license-to-contractor relationship, recognized disposition semantics, complete provenance/checksum, freshness within the source-specific policy, and no conflicts. Deterministic-but-not-exact matches require review for adverse evidence. ULA respondent-only rows, collision exposure, unknown mappings, missing credentials, complaints without qualifying disposition, and retracted/corrected records remain withheld. Public queries must filter an explicit publication state, not infer safety from non-null `contractor_id`. Source corrections, retractions, credential/entity changes, or stale extracts withdraw eligibility and preserve an audit history.

## 18. Acquisition / Cost Matrix

| Source | Availability | Difficulty | Role |
|---|---|---|---|
| DBPR licensed FY CSVs | FREE BULK DOWNLOAD | LOW | Primary structured licensed evidence |
| DBPR ULA FY CSVs | FREE BULK DOWNLOAD | LOW | Primary structured ULA evidence |
| DBPR Recovery Fund FY CSVs | FREE BULK DOWNLOAD | LOW | Primary structured claim/fund evidence |
| DBPR license/type dictionary | FREE PUBLIC HTML | LOW | Authoritative identity vocabulary |
| DBPR public complaint lookup | FREE LOOKUP ONLY | MODERATE | Bounded validation/current status |
| DOAH agency indexed orders | FREE LOOKUP ONLY | MODERATE | Final-order validation; no bulk qualified here |
| CILB agendas/minutes/archive | FREE PUBLIC PDF/HTML | MODERATE | Supplementary final-action/recovery context |
| Pre-FY21/22 normalized history | PUBLIC RECORDS REQUEST LIKELY | MODERATE | Close bulk historical gap |
| Detailed Recovery Fund payments | PUBLIC RECORDS REQUEST LIKELY | MODERATE | Separate, privacy-reviewed use case |

No brittle portal scraper is recommended while sustainable CSVs and targeted records requests are available.

## 19. Cross-Hub Reusable Components

Reusable components are: versioned regulator/type dictionaries; full-credential constructors; generic source inventory and checksums; regulatory matter/detail/event separation; match outcomes (`EXACT`, `DETERMINISTIC`, `REVIEW_REQUIRED`, `UNRESOLVED`); explicit publication gates; correction/retraction history; and many-contact observations. The DBPR code dictionary also supports other Florida-regulated verticals, but ContractorTrustHub remains the first implementation target.

## 20. Recommended STATE-001 Follow-Up Sequence

1. **CTH-FL-SAFE-001 — adverse-evidence identity/publication safety implementation.** Disable numeric-core-only matching; add versioned type-plus-number resolution, explicit review/publication states, invariant tests, and a dry-run reconciliation report. Hold all 491 type-conflicting current links, prioritize the 68 exact full-key conflicts, and do not expose adverse evidence merely through `contractor_id`.
2. Reconcile current 1,541 rows in a non-mutating preview, then approve a bounded, auditable correction plan separately.
3. Extend the adapter for fiscal-year identity and source-specific complaint/claim grain, preserving late-updating files and checksums.
4. Load licensed FY history only after the gate passes; then ULA as independent respondent/matter records; then Recovery Fund with fund-specific semantics.
5. Request or qualify pre-FY21/22 history and final-order linkage separately. Do not mix archive discovery with production publication.

## QA Record

- All 15 proposed evidence files returned HTTP 200 from official Florida DBPR domains; layouts and bounded samples were inspected.
- FY/current distinctions and late disposition dates were validated.
- Production queries used explicit repeatable-read, read-only transactions, a 30-second statement timeout, and rollback.
- Official license-type mappings were checked against DBPR's code dictionary and DBPR credential pages.
- No complaint is represented as proof, no numeric-only or name-only linkage is proposed, and Recovery Fund stages remain distinct.
- Secret scan required before commit; raw source files remain under ignored `data/raw/`.
- Google/paid API calls: **0**. County/municipal work: **0**. Production mutations: **0**. Deployment: **0**.
