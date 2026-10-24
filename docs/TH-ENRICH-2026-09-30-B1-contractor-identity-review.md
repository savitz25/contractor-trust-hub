# TH-ENRICH-B1 Contractor identity and publication review

Production changed: **NO**. The frozen B1 stage, hashes, retrieval receipts, source URLs, and duplicate-key audits remain in the original [source manifest](TH-ENRICH-2026-09-30-B1-source-manifest.json) and [QA](TH-ENRICH-2026-09-30-B1-qa.json). The [machine-readable class review](TH-ENRICH-2026-09-30-B1-identity-review.json) was generated from every staged source row.

The earlier **80,802** is exactly `17,976 + 6,558 + 486 + 8,026 + 44,402 + 2,510 + 302 + 542`. These are eight source-class filters on native credentials. They include inactive, person, mixed-holder, and business-linked credentials. Only **45,294** of those filtered keys meet the source-specific current test (`C/A` for DBPR, `ACTIVE` for NY); NJ's March PDF has no reliable September-current assertion. Neither figure counts canonical businesses.

| Source | Raw | Unique native | Earlier class filter | Current in filter | Person | Business / linked | Mixed or unknown | Evidence only | Held native | Proposed license rows |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| FL electrical board 08 | 20,103 | 20,083 | 17,976 | 16,614 | 0 | 0 | 17,976 | 2,107 | 20,083 | 0 |
| FL mold board 07 | 6,933 | 6,933 | 6,558 | 6,060 | 6,558 | 0 | 0 | 375 | 6,933 | 0 |
| FL asbestos board 59 | 1,157 | 1,157 | 486 | 303 | 258 | 228 | 0 | 671 | 1,157 | 0 |
| FL home inspector board 04 | 9,396 | 9,396 | 8,026 | 7,628 | 8,026 | 0 | 0 | 1,370 | 9,396 | 0 |
| NYC DOB | 103,236 | 103,228 | 44,402 | 12,716 | 55,063 | 43,398 linked | 4,767 | 0 | 103,228 | 0 |
| NY DOL mold | 2,510 | 2,510 | 2,510 | 1,761 | 0 | 2,510 | 0 | 0 | 2,510 | 0 |
| NY elevator | 302 | 302 | 302 | 212 | 0 | 302 | 0 | 0 | 302 | 0 |
| NJ fire permitted business | 542 | 542 | 542 | 0 verified now | 0 | 542 | 0 | 0 | 542 | 0 |

`Evidence only` here means Florida course/provider/officer rows excluded from a provider identity lens. NYC professional credentials are shown as person or mixed even when excluded from the earlier four-class filter. All **144,151** parsed native keys are held from publication; 26 excess duplicate rows and two NYC parse failures are separately documented. `PROPOSED_LICENSE_ROWS=0` means no production load is authorized by this identity-review packet. The 80,802 earlier projection of additional license rows is withdrawn as a release proposal.

## NYC DOB type census

The native key is `(license_type, license_number)` within NYC DOB. Two missing-type rows are parse failures. The source's `ACTIVE` value is used only as a license-status observation. The [NYC DOB license catalog](https://www.nyc.gov/site/buildings/industry/license-types.page) distinguishes agencies, firms, and individual professional credentials.

| NYC type | Unique native | ACTIVE | Holder treatment |
| --- | ---: | ---: | --- |
| General Contractor | 34,650 | 9,752 | Business-linked registration; legal entity unresolved |
| Electrical Firm | 5,544 | 1,108 | Business-linked |
| Special Inspection Agency | 3,204 | 1,392 | Business-linked |
| Fire Suppression Contractor | 1,133 | 464 | Person credential; was incorrectly in earlier business filter |
| Electrical Contractor | 5,104 | 996 | Person credential; do not equate with electrical firm |
| Master Plumber | 3,007 | 1,137 | Person credential |
| Superintendent of Construction | 11,078 | 4,385 | Person credential |
| Filing Representative | 7,861 | 2,368 | Person credential |
| Welder | 7,843 | 27 | Person credential |
| Journeyman | 4,993 | 1,739 | Person credential |
| Stationary / Portable Engineer | 4,646 | 1,376 | Person credential |
| Hoist Machine Operator | 3,756 | 361 | Person credential |
| Site Safety | 3,206 | 1,322 | Person credential |
| Rigger | 1,875 | 652 | Person credential |
| Oil Burner Installer | 413 | 104 | Person credential |
| Sign Hanger | 119 | 42 | Person credential |
| Tower Crane Rigger | 29 | 4 | Person credential |
| Elevator Agency / Inspector | 3,699 | 24 | Mixed class; split by regulator subtype before publication |
| Concrete Test Lab / Safety Manager | 1,068 | 516 | Mixed class; split by regulator subtype before publication |

The older NYC 44,402 filter selected four types when `business_name` was present. The four types have 44,531 native keys; 129 lack business names. The typed census retains all 44,531, including 1,133 person-level fire suppression credentials. The **9,752 ACTIVE GCs** are a city credential count, never the statewide NY contractor or canonical business count. NYC DOB remains separate from DCWP and NY DOL.

## Holder decision

Florida DBPR's [class definitions](https://www2.myfloridalicense.com/sto/documents/readme.pdf) separate `ZA` asbestos businesses from `AX` consultants and `CJC` individual contractors. `HI`, `MRSA`, and `MRSR` are person credentials. ECLB board 08 is held as mixed/unknown at legal-holder grain until a regulator-native qualifier-to-business relation is available; a DBA field is not an entity bridge. NY DOL mold/elevator and NJ DFS permit rows are business-grain credentials but still have no exact bridge to existing canonical contractors.

The current Contractor schema has `contractors` as the canonical business profile and `licenses.contractor_id` as its link. It has **no person-level canonical profile**. Thus FL home inspectors, mold assessors/remediators, asbestos consultants/contractors, and NYC professionals require a person credential/evidence view or a separately approved person-profile schema and publication design. None may be minted as a contractor business from name or address. NJ's PDF is dated March 19, 2026; 57 permit lapse dates precede September 30, so roster inclusion does not establish a current permit.

Founder identity/publication gate: choose person treatment, resolve regulator-specific business holder links, split mixed NYC classes, verify current source status, and approve exact source-specific license loads. The original stage is preserved without fuzzy consolidation or production mutation.
