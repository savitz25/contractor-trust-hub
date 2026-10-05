# LA-CON-001 source receipt

Official LSLBC public Request Roster, refreshed once on 2026-10-05 with `python scripts/download_la_lslbc.py`.

- Portal: https://arlspublic.lslbc.louisiana.gov/Public/RequestRoster
- Lookup: https://arlspublic.lslbc.louisiana.gov/Public/Search
- Board home: https://lslbc.gov/
- Downloaded at: 2026-10-05T13:15:57.451072+00:00
- Published clock: 2026-10-05
- Status filter: Active only (`StatusTypes=1`). The public form does not offer expired or inactive.
- This is a roster re-pull for publication counts. It is not the 2026-08-14 production load (that load was CLC 19993, RLC 4579, HIR 1462, MRL 264, total 26298). Graph writes: 0. The raw CSVs stayed in gitignored `data/raw/la_lslbc/` and were not committed.

## Rows by Credential Type and Status

Counted from the downloaded CSVs. Board quantity matched each file. Duplicate license keys across the four files: 0. Empty license numbers: 0. Skipped rows: 0.

| Code | Credential Type | Status | Rows |
|------|-----------------|--------|------|
| CLC | Commercial License Certificate | Active | 19898 |
| RLC | Residential License Certificate | Active | 4701 |
| HIR | Home Improvement Registration | Active | 1501 |
| MRL | Mold Remediation License Certificate | Active | 269 |
| | All four types | Active | 26369 |

26369 is a certificate-row total. It is not a deduplicated company census. One business can hold more than one certificate number. The four types are not one Louisiana contractors population.

## File receipts

| File | Bytes | SHA-256 | Rows |
|------|------:|---------|-----:|
| commercial_active.csv | 3833935 | 59d5348938d46e63a1c72dd2f9b35852d9f3951db3cada72f9f27d1dd2047e30 | 19898 |
| residential_active.csv | 918095 | efe69a01903a95bb27b8f4875b90f1a73d1a056ee585fca50424d6ae3f6406d8 | 4701 |
| home_improvement_active.csv | 295235 | 72718b1091ef9bc1f9130f4184a5575f3c7841b0284f6863730f7303c0225747 | 1501 |
| mold_remediation_active.csv | 55175 | b5d5c8989b0f97610bab543aebbea9f1cdf28b86e6eb19ebb561ed89b6397fae | 269 |
| lslbc_contractor_roster.csv | 5101879 | 39a63aac9ee213e474d983e61fa1b9de1961a7cb35c9be5968d9950fda482d58 | 26369 |

## Not in this pull

- Trade classifications and qualifying-party names are not on the roster export. Classifications on the interactive lookup were NOT_ACQUIRED.
- Louisiana State Plumbing Board person licenses are a separate grain and were NOT_ACQUIRED.
- Expired and inactive rows are not in the Active export. Missing is not zero.
- Parish is an address field on the roster, not a service area. No parish pages.
