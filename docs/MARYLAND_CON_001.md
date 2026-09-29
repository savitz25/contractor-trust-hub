# MD-CON-001: Maryland MHIC evidence

Starting `origin/main`: `7e25742f75b3b4c1cf79ae554a28cee1aa54447b`.

## Acquisition

- MHIC [active-license search](https://www.dllr.state.md.us/cgi-bin/ElectronicLicensing/OP_search/OP_search.cgi?calling_app=HIC%3A%3AHIC_qselect): KNOWN for contractor personal name, trade name, location, salesperson name and contractor number. No safe official statewide bulk export or structured roster was identified. Contractor and salesperson rosters, active rows, distinct numbers, statuses and expirations are `NOT_ACQUIRED`. The query was not enumerated.
- MHIC [license categories](https://www.labor.maryland.gov/license/mhic/mhiclicreq.shtml): contractor and salesperson are separate classes. A salesperson can represent up to two licensed contractors.
- MHIC [disciplinary index](https://labor.maryland.gov/license/mhic/mhicdisc.shtml): FY2022–FY2025 linked at retrieval on 2026-09-29. FY2026 page was not linked and is `NOT_ACQUIRED`. `scripts/build_maryland_snapshot.py` parses the four official public tables into `lib/maryland-intelligence/discipline.json`. It preserves fiscal year, date, complaint number, decree, action summary, case name, document URL, source page and printed Guaranty Fund award amount. The scraper does not query licenses or infer license numbers from names.
- MHIC [complaint FAQ](https://labor.maryland.gov/license/mhic/mhicfaqcomp.shtml): complaint intake KNOWN; closed history REQUEST_ONLY / KNOWN; open complaints not publicly reportable. Bulk provider-level complaint corpus `NOT_ACQUIRED`.
- MHIC [Guaranty Fund FAQ](https://labor.maryland.gov/license/mhic/mhicfaqgf.shtml): the Fund applies to eligible losses from licensed home improvement work. An award, proposed award, disciplinary order, license revocation and confirmed payment are separate concepts.
- Maryland Labor [occupational licensing](https://labor.maryland.gov/license/) covers separate electrical, plumbing and HVACR classes. Their rosters and counts are `NOT_ACQUIRED` in this bounded MHIC release.

## Graph limits

MHIC public table rows do not print exact license numbers. Exact enforcement attachments 0; exact Guaranty Fund attachments 0; name-only adverse joins 0; new canonical companies 0; graph writes 0; claim eligibility changes 0. No personal residence or contact details are published.

## Clocks

The active-license search is live, with no frozen roster/status clock. The action snapshot has per-row action dates, separate fiscal years and a retrieval timestamp. Each Fund amount retains its action/order date and printed decree status. Build `generatedAt` is not asserted as a regulator clock.
