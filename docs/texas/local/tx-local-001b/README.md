# TX-CON-LOCAL-001B — San Antonio/Bexar + Houston/Harris harvest

No public local routes. `KEEP_DATA_ONLY`.

Builder 3 owns `austin-travis` and `fort-worth-tarrant`. Do not touch those paths.

## Guardrails

- LOCAL REGISTRATION ≠ STATE LICENSE
- GENERAL CONTRACTOR WITHOUT TDLR ≠ UNLICENSED
- TDLR TRADE LICENSE ≠ GENERAL CONTRACTOR LICENSE
- REGISTRATION INSURANCE REQUIREMENT ≠ PROOF OF CURRENT INSURANCE
- PERMIT ≠ QUALITY
- APPRAISAL VALUE ≠ SALE PRICE
- HCAD PROPERTY ≠ HOUSTON CITY
- CITY OF HOUSTON ≠ HARRIS COUNTY
- MISSING ≠ ZERO
- NO TRUST SCORE / NO RANKING

## San Antonio (City, not Bexar County)

Contractor registration is P0 and **OPEN_SEARCH_ONLY**.

- Official rule: all City- and State-licensed contractors must register with Development Services before permits issue.
- Contractor Connect search: https://www.sa.gov/Directory/Departments/DSD/Contractor/Find-a-Contractor
- Open Data SA has no contractor-registration table.
- Bond/insurance is a **program rule** (GL required for some categories). Not record-level in the permit CSV. Do not publish insured/bonded flags.

Permits (acquired):

| File | Rows | As of |
| --- | --- | --- |
| PERMITS ISSUED (current) | 139,124 | 2026-08-30 |
| PERMITS ISSUED 2020-2024 | 368,297 | 2024-12-31 |
| APPLICATIONS SUBMITTED | 52,621 | 2026-08-30 |

Schema has `PERMIT #`, type, work type, project address, coords, dates, valuation, **PRIMARY CONTACT (name)**. No local registration ID, TDLR, TSBPE, or parcel.

Identity: 18,482 distinct PRIMARY CONTACT names are **UNSAFE** for adverse attach. Exact local/state ID joins: **0**. `Res New Building Permit` 6,543 is a work-type signal, not a Texas licensed GC census.

## Bexar CAD

**PARK.** Electronic products exist via request/FTP/CD; no immediately downloadable free current bulk URL. Do not wait on PRA. Permit file has no parcel, so permit→property join coverage is 0.

## Houston (City, not Harris County)

Building-permit bulk: **SOURCE_NOT_ACQUIRED / SEARCH_ONLY**.

- Open Data Houston publishes a monthly/yearly **summary**, not permit rows.
- iPermits / Houston Permitting Center is interactive/login.
- `PDD/Permits_Viewer_Verify_Areas` is address-assignment polygons, not permit rows.
- Do not scrape.

Contractor registration: Houston does **not** license general contractors. Trades register with the City after TDLR/TSBPE. No public roster/API. **OPEN_SEARCH_ONLY / FORM.**

## HCAD (Harris County appraisal — P0)

Acquired 2026 CAMA zips from https://download.hcad.org/data/CAMA/2026/

| File | Scale |
| --- | --- |
| real_acct.txt | 1,628,241 accounts; situs 1,628,241; tot_appr_val 1,610,550; yr_impr 1,388,577 |
| A1 residential | 1,157,740 |
| F1 commercial | 68,818 |
| Houston situs | 961,833 (still HCAD, not City permits) |
| building_res | 1,300,821 rows / 1,269,710 accounts; date_erected complete |
| building_other | 159,120 rows / 68,857 accounts |
| t_business_acct | 203,185 personal-property business accounts |

Do not publish owner dossiers. Do not infer sales.

## Publication

KEEP_DATA_ONLY. No `/texas/san-antonio`, `/texas/bexar`, `/texas/houston`, `/texas/harris`.
