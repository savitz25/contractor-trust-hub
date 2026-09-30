# TH-ENRICH-CON-2026-09-30-IDR1 — Contractor holder resolution

Read-only production inspection and branch-local source analysis. **No production load, schema change, business minting, or publication denominator change.** The earlier 80,802 figure is a credential-key inventory and is not a business count.

The six source-specific `*-reconciliation.csv` files classify each local source row. `classification-codebook.json` expands the row-level authority and reason codes; `classification-counts.json` gives machine-readable totals. `person-credential-hold.csv` is a separate queue for later product-model work. Source hashes were checked against the frozen B1 manifest. NYC DOB classification uses all **103,236 raw rows**, including the two omitted from B1's parsed stage for missing license type. The NJ local PDF row count is explicitly an exception to the Evidence baseline.

## Holder and exact bridge decision

| Source | SOURCE_ROWS | CURRENT_CREDENTIALS | EXACT_EXISTING_BUSINESS_BRIDGES | AUTHORITATIVE_NEW_BUSINESS_CANDIDATES | PERSON_ROWS | CREDENTIAL_ONLY | AMBIGUOUS | EVIDENCE_ONLY | HELD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| FL asbestos board 59 | 1,157 | 303 `C/A` | 0 | **228 `ZA`** | 258 | 0 | 0 | 671 | 0 |
| NYC DOB, all license types | 103,236 | **9,752 active GC** | 0 | 0 | 55,056 | **9,752 active GC** | 15 | 0 | 38,413 |
| NY DOL mold | 2,510 | 1,761 Active | 0 | 0 | 0 | 2,510 | 0 | 0 | 0 |
| NY DOL elevator | 302 | 212 Active | 0 | 0 | 0 | 302 | 0 | 0 | 0 |
| FL electrical board 08 | 20,103 | **16,614 contractor `C/A`** | 0 | 0 | 17,976 | 0 | 40 | 2,087 | 0 |
| NJ DFS fire permits | **541 Evidence baseline** | Unknown | 0 | 0 | 0 | 0 | 0 | 0 | **542 local PDF lines held** |

The NJ table row uses the certified **541** permit baseline; the 542 local raw PDF lines are a reconciliation queue, not a proposed inventory. Other row-category totals reconcile to their source rows. `PERSON_ROWS`, `CREDENTIAL_ONLY`, `AMBIGUOUS`, `EVIDENCE_ONLY`, and `HELD` are exclusive row dispositions in the CSVs. `CURRENT_CREDENTIALS` is a source-status metric, not a business denominator.

On **2026-09-30**, read-only Contractor production inspection found no licenses in `fl_dbpr` boards 08/59/07/04 or source systems `nyc_dob`, `ny_dol`, `nj_dfs`; no `entities` for `nyc_dob`, `ny_dol`, or `nj_dfs`; and no `fl_dbpr` entity or license key beginning `ZA`. Thus **zero source-native exact bridges** are present. The files expose no FEI/EIN or other legal registration number that could support a cross-source canonical bridge. Similar names and DBA strings were deliberately ignored. The owned board-06 CILB rows remain separate from board 08.

### 1. Florida asbestos

The [DBPR codebook](https://www2.myfloridalicense.com/sto/documents/readme.pdf) defines occupation `ZA` as **Asbestos Business**, `CJC` as Asbestos Contractor, and `FO` as Financial Responsible Officer. All **228** `ZA` rows have distinct board-59 native license IDs and distinct displayed business names. Their business-license ID is a source-native business identity suitable for **candidate** certification; it is not an exact Sunbiz or existing TrustHub entity bridge, and no canonical business was created. All 228 have primary status `C` (Current); **56** also say secondary `A` (Active), while **172** have a blank secondary status. The latter are *not* called active. The 258 individual asbestos credentials go to person hold; the 671 officer/course/provider rows remain evidence only. No officer is a business candidate.

### 2. NYC DOB General Contractor

The [DOB dataset](https://data.cityofnewyork.us/Housing-Development/DOB-License-Info/t8hj-ruu2/data) describes license serial number as the row key and license number as a tradesperson number. Every one of the **9,752 active GC** records has a person first/last name *and* a business-name field. Neither field proves whether the legal holder is a corporation, partnership, or sole proprietor; the extract supplies no EIN, legal registration ID, or reusable business holder ID. The [DOB GC registration guidance](https://www.nyc.gov/site/buildings/industry/changes-to-general-contractor-registration.page) distinguishes a business-name change from changing the company/EIN, reinforcing that the display name cannot be a canonical key. Therefore **0 confirmed business entities, 0 confirmed sole-proprietor classifications, 0 exact bridges, 0 new canonical business candidates, and 9,752 business-associated credential-only rows** are established. This does not mean the 9,752 registrants lack businesses. Across all DOB types, 55,056 clearly individual-profession rows are on person hold; 38,413 other/out-of-scope rows are held; 15 malformed or colliding rows are ambiguous. Fire Suppression Contractor and other professional types never enter the GC count. Eleven identical GC business-name strings recur across multiple active licenses; these are not exact entity matches.

### 3–4. NY mold and elevator

[NYS DOL mold licensing](https://data.ny.gov/resource/ikqx-ispy.csv) and [elevator licensing](https://dol.ny.gov/elevator-licensing-information) issue these contractor licenses to businesses. The extracts retain license type, native license number, business name, address, and status, but no reusable business/entity registration ID. **Mold:** 1,761 Active, 749 Expired, 2,510 credential-only. **Elevator:** 212 Active, 90 Expired, 302 credential-only. Exact identical business-name strings occur under multiple licenses (352 mold names and 51 elevator names); they are not used to merge rows or mint businesses. No expired record is silently promoted to current.

### 5. Florida electrical

[DBPR's ECLB guidance](https://www2.myfloridalicense.com/electrical-contractors/electrical-contractors-business-information/) states the board licenses **individual contractors** who may qualify a business entity; the business name appears on the individual's license. The board-08 file has **17,976** contractor-class person credentials, of which **16,614** are `C/A`. Of those current contractor rows, **16,607** carry DBA/business-name text and **7** do not. The extract does not provide a separate qualified-business ID or an exact legal-entity registration key. Thus all 17,976 remain person credentials and business qualification remains an unbridged relationship; **0** businesses are minted. Board 08 remains separate from owned board 06. Forty repeated education-source rows across 20 duplicated native keys are ambiguous; 2,087 other course/provider rows are evidence only.

### 6. New Jersey fire protection

The ticket's Evidence baseline is **541 permits**, and current status has not been independently established. Re-fetching the [official NJ DFS PDF](https://www.nj.gov/dca/dfs/pdf/Fire%20Protection%20Equipment%20Contractor%20-%20Permitted%20Business.pdf) produced the same SHA-256 as the frozen B1 file (`0ed7e0d89a08f46ce5af3950551b518d8074dfba305ca0d88bce097393e684c7`). That PDF **prints “Fire Protection Contractor Business Permits: 542”** and contains 542 distinct primary permit lines. One line, `P01619`, cites replacement `P00485`; the parser treats the citation as a reference, not a second row. No Evidence-provided key list identifies which local line should be excluded to obtain 541. Therefore all 542 local lines are held, with **541 retained solely as the Evidence baseline**; no permit is called an active business or proposed for production. Resolving this requires the exact Evidence-certified 541 permit key set or a documented exclusion rule.

## Person-credential hold and totals

`PERSON_CREDENTIAL_HOLD=87,874`: NYC DOB person-profession 55,056; FL electrical 17,976; FL home inspector 8,026; FL mold 6,558; FL asbestos 258. Seven additional DOB person-type rows with missing/colliding keys or malformed status are in `AMBIGUOUS`, not the person hold. This file is a later product-model input, not a person-profile proposal.

```text
EXACT_EXISTING_BUSINESS_BRIDGES = 0
AUTHORITATIVE_NEW_BUSINESS_CANDIDATES = 228 source-native FL ZA candidates
PERSON_CREDENTIAL_HOLD = 87874
AMBIGUOUS = 55 row classifications, plus one unresolved NJ source-count discrepancy
PROPOSED_PRODUCTION_ROWS = 0
PRODUCTION_MUTATIONS = NO
```

The NJ discrepancy and absent reusable holder IDs for NYC GC/NY DOL prevent full identity certification. The 228 ZA candidates may be reviewed independently; none is a production instruction. Verification: `python -m unittest scripts/test_th_enrich_con_idr1.py -v` passed **5/5**.

**CONTRACTOR ENRICHMENT = BLOCKED — NJ 541-key evidence set missing and business-holder IDs absent for NYC GC/NY DOL extracts.**
