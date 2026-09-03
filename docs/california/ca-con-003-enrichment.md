# Recommended CA-CON-003 enrichment

CA-CON-002 published `/california` on a deterministic truncated License Master. Next enrichment should not turn CSLB download into a multi-day project.

## Priority 1 — finish the official download if a durable transport appears

The portal’s real file URL is:

`https://www.cslb.ca.gov/OnlineServices/DataPortal/DownLoadFile.ashx?fName=MasterLicenseData&type=C`

Personnel: `fName=PersonnelData&type=C`  
Workers’ Comp: `fName=WorkerCompData&type=C`

HTTP/1.1 chunked transfer still dies around 30 seconds. If CSLB advertises `Accept-Ranges`, a Range resume on `DownLoadFile.ashx` is the next *supported* attempt. Do not scrape Instant License Check. Do not buy the $235 Full File to finish the renewable stream.

If a complete portal master lands, rebuild the snapshot and inventory and keep coverage honest until then.

## Priority 2 — Personnel qualifier graph (not people profiles)

If Personnel CSV/XLS becomes available, store exact CSLB license ID + official personnel role. Do not publish people as public profiles. Use it for qualifier-missing / RME research later.

## Priority 3 — Workers’ Comp overlay

Standalone WC file would separate “License does not have current W/C” from live policy proof. Until then, keep source-native `Work Comp Susp` and master WC coverage-type labels. CLEAR is not current WC.

## Priority 4 — exact-ID overlays already in hand

- Re-join Cal/OSHA asbestos on every master refresh (65 exact joins in this extract).
- Keep DLSE IDs stored; do not invent currently-debarred counts.
- DIR ECU electrician files stay person-grain; never auto-create contractor businesses.

## Priority 5 — not this product yet

- California county pages
- DIR PWCR bulk (SEARCH_ONLY / CAPTCHA)
- Cal eProcure vendor dump (vendor ≠ licensed contractor)
- Municipal permit crawls
- Paid Full File unless a revocation/cancellation product is separately authorized

## Do not

CAPTCHA bypass, Selenium/Playwright evasion, undocumented APIs, session-replay, Instant License Check scrape, Trust Scores, paid ranking, name-only adverse attach.
