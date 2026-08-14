# Kentucky data sources — DHBC specialty trades (Phase 0)

Florida remains the full-journey product. Kentucky Verify, if built, is **specialty-trade verification only** — not a statewide general-contractor directory.

## Coverage reality (product-critical)

| What Kentucky has statewide | What it does **not** have |
|-----------------------------|---------------------------|
| DHBC licenses for electrical, HVAC, plumbing, fire protection, inspectors, manufactured housing, and related trades | **No statewide general contractor license** |
| Official interactive licensee search | A posted statewide contractor roster / open-data CSV |
| Local city/county contractor cards in some metros (e.g. Louisville Metro) | One board that covers every builder who can pull a permit |

**Product rule:** Never say “all Kentucky contractors.” A missing DHBC row does **not** mean the person cannot work — many general builders are city/county only. Always confirm on the official DHBC search.

## Official sources (preferred)

| Resource | URL | Notes |
|----------|-----|--------|
| License search & verification overview | https://dhbc.ky.gov/newstatic_Info.aspx?static_ID=573 | Points consumers at the DHBC search + JO Portal |
| DHBC licensee search | https://dhbc.ky.gov/Search/HBC_List_Licensees.aspx | Official interactive lookup (ASP.NET) |
| DHBC home | https://dhbc.ky.gov/ | Department of Housing, Buildings and Construction |
| JO Portal (other licensee data) | https://www.joportal.com/ky/Spa/Home | Separate portal for credentials not on HBC_List_Licensees |
| Open records | https://ppc.ky.gov/NewOpenRecords.aspx | No posted bulk CSV; request path if a roster is needed |

**Prefer:** official search confirmation + any future DHBC/open-records extract.  
**Avoid:** third-party “all Kentucky contractors” scrapes as the source of truth.

There is **no** Socrata / data.ky.gov DHBC contractor roster as of this Phase 0 probe (2026-08-14).

## What the official search offers

Divisions on the public form:

- Building Code Enforcement
- Electrical
- Fire Prevention
- HVAC
- KIBS
- Manufactured Home / RV & Certified Installer
- Plumbing
- HAZMAT / Inspection Companies / State Fire Marshal

**Firm / contractor-facing types (recommended for a later Verify v1):**

| Official license type | Form value | Sample number shape |
|-----------------------|------------|---------------------|
| Contractor Electrician-Business | `269` | `CE66125` |
| Master HVAC Contractor | `308` | `HM06165` |
| Master Plumber | `322` | `M8317` |
| Fire Protection Sprinkler / Chemical / Rangehood **Contractors License** | `296` / `286` / `294` | not sampled in Phase 0 |
| Master Electrician | `274` | individual qualifier — include only if labeled clearly |

**Default exclude (not “hire this contractor” credentials):** HVAC Apprentice, Journeyman HVAC / Plumber, inspector/trainee classes, UPST / LP-gas subclasses, fire-safe cigarette certification, most MH retailer / RV types — unless a later phase documents them separately.

### Status values published on the form

All, Active, Cancelled, Closed, Deceased, Delinquent, Denied, Deployed, Downgraded, Expired, Inactive, Incomplete, Not Active, On Hold, Pending, Revoked, Suspended, Terminated, Terminated-BCE, Upgraded, Void.

License number, issue date, and expiration date appear once the license is **Active** (board copy on the search page).

## Columns observed (official search results, 2026-08-14)

Polite POSTs against the official form (one license type + name `SMITH` + Active). Result table:

| Field | Example |
|-------|---------|
| Licensee name | `Smith, Charles J` |
| License Type | `Master HVAC Contractor` |
| DBA Name | `Smiths Htg & Air` |
| License Number | `HM05171` |
| Status | `Active` |
| Issued Date | `9/16/2011` |
| Expiration Date | `6/30/2027` |

**Not on the list view:** bond, insurance, discipline, street address, city/county, qualifying-party roster beyond the named licensee.

**Stable product key (Phase 1 production load):** `KY-DHBC:{LicenseNumber}`  
e.g. `KY-DHBC:HM05171`. Occupation codes on that load: `ELEC`, `HVAC`, `PLB`. Do not invent numbers.

## Local / municipal (not statewide)

| Resource | Notes |
|----------|--------|
| [Louisville Metro KY — Active Contractors](https://catalog.data.gov/dataset/louisville-metro-ky-active-contractors) | Municipal Office of Construction Review; last catalog update **2022-06-19**. Not a DHBC statewide extract. Do not treat as Kentucky-wide coverage. |
| Lexington-Fayette and other cities | May require local contractor registration. Not ingested in Phase 0. |

## Acquisition limits (Phase 0)

- Search is ASP.NET (`__VIEWSTATE`). No Excel/CSV button on the form.
- Unfiltered “all Active” POSTs are not appropriate as a bulk harvest.
- Phase 0 used **three** narrow queries (one type + last name + Active). Rate: one request every few seconds if a later harvest is approved.
- A production-scale load should prefer an **open-records roster** from DHBC rather than paging the public form.

## Gaps

- No official bulk extract
- No bond / COI
- No discipline archive on the list view
- Inactive/historical depth only if you query those statuses
- Municipal-only GC cards (Louisville, Lexington, others) are out of DHBC
- JO Portal credentials are a separate system

## Related

- Index: [DATA_SOURCES.md](./DATA_SOURCES.md)
- Product: [KENTUCKY_VERIFY_V1.md](./KENTUCKY_VERIFY_V1.md)
