# CA-CON-001 source manifest

Primary regulator: **Contractors State License Board (CSLB)**, California Department of Consumer Affairs.

Primary identity: **CSLB license number** (`CA-CSLB:{LicenseNo}`).

## Acquired

| Source | Access | As-of | Grain | Result |
|--------|--------|-------|-------|--------|
| CSLB License Master CSV | OPEN_BULK (portal postback) | 2026-09-02 | license | 75,572 rows, stream truncated |
| DIR ECU certified electricians | OPEN_API (CKAN datastore) | 2026-09-03 | person certificate | 36,983 |
| DIR ECU trainees | OPEN_API | 2026-09-03 | person certificate | 19,661 |
| DIR DLSE debarment HTML | OPEN_HTML | July 2025 footer | debarment order listing | 57 exact CSLB IDs |
| Cal/OSHA asbestos registrant table | OPEN_HTML | 2026-09-02 | registrant | 321 rows / 312 CSLB IDs |
| CSLB classification option list | OPEN_HTML | retrieved 2026-09-03 | class dictionary | 78 options |

## Not acquired / blocked

| Source | Access | Why skipped | Future? |
|--------|--------|-------------|---------|
| CSLB License Master (complete portal file) | OPEN_BULK | Server ended chunked CSV ~30s / ~24MB | Retry with better transport |
| CSLB Personnel file | OPEN_BULK | Same portal stream failure | Yes — qualifier graph |
| CSLB Workers' Comp file | OPEN_BULK | Same | Yes — WC overlay |
| CSLB Full/Update files | REQUEST_ONLY $235 | Paid data services; 700k–830k+ historical | Maybe for revoked/cancelled |
| CSLB legal action / complaint disclosure file | REQUEST_ONLY | Paid Full File option | Maybe |
| CSLB Instant License Check / legal actions | SEARCH_ONLY | Interactive | No scrape |
| DIR PW contractor registration | SEARCH_ONLY | Account portal, no bulk | Watch for open data |
| DIR local debarment Excel | CAPTCHA for public download | Anti-bot | Skip |
| Cal eProcure / SCPRS vendor dump | SEARCH_ONLY | 65k row cap, required filters | Construction UNSPSC pass later |
| California SOS entity bulk | REQUEST_ONLY / data sales | Not a free API for identity join | Only if cheap official dump appears |
| Statewide building permits | LOCAL_FRAGMENTED | City/county portals (SF, LA, SD, San José, …) | Do not crawl |
| Home Improvement Salesperson roster | SEARCH_ONLY | Instant License Check | Skip |

## Identity rules used

- EXACT: same CSLB license number
- HIGH_CONFIDENCE: exact legal name + exact official business address, no conflict (not auto-run this ticket)
- REVIEW_REQUIRED: DBA / name+city / qualifier ambiguity / sole-owner mailing address
- UNSAFE: name only, phone only, web search

Adverse evidence attaches only on EXACT license ID.

VENDOR ≠ LICENSED CONTRACTOR. PUBLIC WORKS REGISTERED ≠ CSLB STATUS. PERSON CERTIFICATE ≠ CONTRACTOR BUSINESS.
