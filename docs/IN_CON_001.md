# IN-CON-001 Indiana contractor publication

Indiana's [Business Owner's Guide](https://www.in.gov/core/business_guide.html) states: "The only construction contractors licensed by the State of Indiana are plumbers." General, electrical and HVAC contractor licensing is local (LOCAL_CONTRACTOR_LICENSING = EXISTS / OUT_OF_SCOPE). `/indiana` publishes the statewide Plumbing Commission layer and explains that boundary; it is not a contractor census.

## Plumbing credential classes

Active-license class totals come from PLA's public [Indiana Active Licenses](https://www.in.gov/pla/data/indiana-active-licenses-map) Tableau view, observed 2026-09-29 (the view shows no as-of date). The publisher disables summary-data export, so the displayed Plumbing Commission rows were read from the public view for both its Indiana and Out of State tabs; each tab's class rows sum exactly to its profession total (7,652 and 669).

| License type | Grain | Indiana | Out of state |
|---|---|---:|---:|
| Plumbing Corporation | business | 500 | 69 |
| Journeyman Plumber | person | 3,628 | 434 |
| Plumbing Apprentice | person | 3,508 | 164 |
| Plumbing Apprenticeship Program | program | 16 | 2 |
| Plumbing Contractor | person | NOT_ACQUIRED | NOT_ACQUIRED |
| Temporary Plumbing Contractor | person | NOT_ACQUIRED | NOT_ACQUIRED |

Plumbing Contractor and Temporary Plumbing Contractor are PLA license types in Search & Verify but do not appear in the Active Licenses view, so their counts are NOT_ACQUIRED, not zero. Licensee rows are NOT_ACQUIRED: Search & Verify is per-record behind reCAPTCHA, and [bulk license files](https://www.in.gov/pla/license/download-license-files) are a paid download ($150 + $10 per additional 1,000 records) that was not authorized.

## Discipline

`scripts/build_indiana_snapshot.py` freezes the PLA [Discipline Search](https://www.in.gov/ai/appfiles/pla-litigation/) results for Board = Plumbing Commission, 2022-01-01 through 2026-09-29. The form caps results at 100 rows, so the harvest ran by quarter (19 windows, none capped): 159 documents citing 76 distinct license numbers. The categories are 71 findings of fact and order, 16 probation-on-application actions, 17 administrative (charging) complaints and 55 procedural filings. The search prints no class, so class comes from the license prefix (PC, JP, PA, CO). The builder checks that CO rows carry corporate names and other rows carry person names.

The repository is public. Person-grain rows keep only date, document type, class and a SHA-256 of the license number; names, person license numbers and document IDs stay in the gitignored `data/raw/indiana/private/`. Ask and `/indiana?license=` match a user-supplied labeled license by hash. Plumbing Corporation rows keep their public license number and PLA document ID. Profile attachments: 0; name-only adverse joins: 0.

## Other layers

- IDOA Public Works Certification Board prequalification (state contracts over $150,000) is a bidding status, not a license. Its Certified Contractors Lookup list service returned HTTP 500 during retrieval, and IDOA calls the list a reference. The capability is KNOWN; rows are NOT_ACQUIRED.
- PLA complaint intake is KNOWN. Provider-level complaint rows and outcomes are NOT_ACQUIRED (public records request only).
- New canonical companies, graph writes and claim eligibility changes: 0. No county, city or local licensing work was done.
