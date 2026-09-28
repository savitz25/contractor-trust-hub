# MI-CON-001 — Michigan BCC evidence

## Acquisition

- Starting main: `bba1daa3653b73d5faae2806e11a0c1ee6d02809`.
- Official BCC disciplinary reports FY22–FY26: acquired and parsed with `scripts/acquire_michigan_discipline.py`. The JSON records the exact PDF URL, source page, orders-served period, retrieval clock, printed license number, report profession, effective date and action labels. The extractor requires all four evidence fields and omits incomplete rows. The source PDF is authoritative over the extraction.
- Extracted Residential Builder report events: FY22 28, FY23 52, FY24 60, FY25 49, FY26 YTD 3; 192 in total. FY26 PDF currently runs through February 28, 2026. These are report rows, not license counts or unique businesses.
- BCC statewide license rosters: **NOT_ACQUIRED**. BCC says list requests must go through LARA FOIA. No clean public roster export was found in this blitz. Individual Residential Builder, Residential Building Company, individual and company M&A, salesperson, branch office, electrical, plumbing, mechanical and boiler counts are therefore unknown.
- M&A trade qualifications: 13 possible crafts documented by BCC; individual license endorsements **NOT_ACQUIRED** and no endorsement counts are reported.
- BCC Accela: verification capability only. No automated list acquisition or protected-system scraping.
- Other LARA reports and data sets: statewide legislative reports found, but no immediately usable row-level contractor roster. **NOT_ACQUIRED** for this product scope.

## Grain and graph

The BCC disciplinary PDF prints “Residential Builder” without a dependable person/company license subtype field. All extracted rows have `licenseGrain: unresolved`. A company-form name is merely a printed-name hint, not proof of company license grain. Person names and all contact and residence information are absent from the shipped JSON. There are no canonical company creations, profile matches, license attachments, or enforcement attachments. Name-only joins: **0**. No claim eligibility change.

## Source links

- [BCC list requests](https://www.michigan.gov/lara/bureau-list/bcc/list-requests)
- [BCC disciplinary report index](https://www.michigan.gov/lara/bureau-list/bcc/sections/enforcement-section/reports/disciplinary-action-reports)
- [BCC residential builders](https://www.michigan.gov/lara/bureau-list/bcc/sections/licensing-section/residential-builders)
- [BCC skilled-trade licensing](https://www.michigan.gov/lara/bureau-list/bcc/sections/licensing-section)
- [BCC M&A crafts](https://www.michigan.gov/lara/bureau-list/bcc/sections/licensing-section/residential-builders/lic-info/maintenance-alteration-contractor-license-information)
- [BCC Accela](https://aca-prod.accela.com/lara/)

No local permits or county/city pages are included.
