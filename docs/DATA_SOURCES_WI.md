# Wisconsin data sources — DSPS / LicensE credentials (Phase 0)

Florida remains the full-journey product. Wisconsin Verify, if built later, is **dwelling-contractor plus trade-credential verification** — not a statewide commercial general-contractor directory.

## Coverage reality (product-critical)

| What Wisconsin has statewide | What it does **not** have |
|------------------------------|---------------------------|
| DSPS credentials for Dwelling Contractor / Restricted, Dwelling Contractor Qualifier, Electrical Contractor, HVAC Contractor / HVAC Qualifier, plumbing (master / journeyman / apprentice), and related trades | **No statewide commercial general contractor license** |
| A permit rule for **one- and two-family dwellings**: the person pulling the building permit must hold Dwelling Contractor or Restricted **and** hold or employ a Dwelling Contractor Qualifier ([SPS 305.31](https://docs.legis.wisconsin.gov/code/admin_code/sps/safety_and_buildings_and_environment/301_319/305/III/31); [Wis. Stat. § 101.654](https://docs.legis.wisconsin.gov/statutes/statutes/101/II/654)) | A Florida-style CGC / commercial builder roster |
| Official interactive lookup on LicensE | A posted statewide contractor CSV / open-data roster |
| Published license-count totals by profession | Bond, COI, or a discipline field on a public extract |

**Product rule:** Never say “all Wisconsin contractors.” A missing DSPS row does **not** mean the person cannot work — commercial builders are not licensed as a statewide GC, and many municipal permit rules still apply. Always confirm on the official LicensE lookup.

Dwelling Contractor is a **1–2 family dwelling permit credential**, not a commercial GC.

## Official sources (preferred)

| Resource | URL | Notes |
|----------|-----|--------|
| DSPS public look-up hub | https://dsps.wi.gov/Pages/SelfService/LicenseLookUp.aspx | Points consumers at LicensE (trades / health / business) vs eSLA (plan / safety programs) |
| LicensE License Lookup (current) | https://license.wi.gov/s/license-lookup | Current DSPS path for trades credentials |
| Legacy license search | https://licensesearch.wi.gov/ | Redirects to LicensE |
| Alternate legacy host | https://app.wi.gov/licensesearch | Also redirects to LicensE |
| eSLA public lookup | https://esla.wi.gov/verifylicense | Plan status / safety programs — **not** the trades roster |
| Order list of licensees | https://dsps.wi.gov/Pages/SelfService/OrderListofLicensees.aspx | Official bulk-list service — **temporarily suspended** (LicensE consolidation) |
| DSPS License API (verify only) | https://dsps.wi.gov/Documents/DSPSLicenseAPIConnectionGuide.pdf | GET by known license number; **not** a roster sync |
| LicensE numbering (trades suffixes) | https://dsps.wi.gov/Credentialing/Trades/LicensEnumbering.pdf | Official `1234 - ABC` format (space-dash-space + suffix) |
| License counts PDF | https://dsps.wi.gov/Credentialing/General/LicenseCounts.pdf | Profession totals as of **06/01/2026** |
| Orders / disciplinary actions | https://dsps.wi.gov/Pages/SelfService/OrdersDisciplinaryActions.aspx | Human lookup → LicensE public orders search |
| Open records | https://dsps.wi.gov/Pages/AboutDSPS/OpenRecordsRequests.aspx | Custodian: DSPSPublicRecords@Wisconsin.gov |
| Dwelling Contractor | https://dsps.wi.gov/Pages/Professions/DwellingContractor/Default.aspx | Firm-oriented 1–2 family permit credential |
| Electrical Contractor | https://dsps.wi.gov/Pages/Professions/ElectricalContractor/Default.aspx | Firm-oriented electrical business license |
| HVAC Contractor | https://dsps.wi.gov/Pages/Professions/HVACContractor/Default.aspx | Firm-oriented HVAC registration |

**Prefer:** a restored Order List export, an open-records roster, or (later) on-demand API verification of a number the user already has.  
**Avoid:** third-party “all Wisconsin contractors” scrapes as the source of truth.  
**Do not** treat the License API as a bulk harvest — DSPS says it “should not be used to continuously synchronize or replicate DSPS data.”

There is **no** working `data.wisconsin.gov` Socrata roster as of this Phase 0 probe (2026-08-14).

## Credential types relevant to homeowners

Official LicensE suffixes from [LicensEnumbering.pdf](https://dsps.wi.gov/Credentialing/Trades/LicensEnumbering.pdf) (R.4/23/2024). Display format: `1234 - DC`.

### Firm-oriented (recommended for a later Verify v1)

| Official type | LicensE suffix | Count-table code | Why |
|---------------|----------------|------------------|-----|
| Dwelling Contractor | `DC` | `DCFR` | Person/entity that may obtain a 1–2 family building permit |
| Dwelling Contractor Restricted | `DCR` | `DCFRR` | Restricted dwelling-permit credential |
| Electrical Contractor | `EC` | `EC` | Installing / repairing / maintaining electrical wiring as a business ([SPS 305.41](https://docs.legis.wisconsin.gov/code/admin_code/sps/safety_and_buildings_and_environment/301_319/305/IV/41)) |
| HVAC Contractor | `HVACCONT` | `HVACC` | Installing / servicing HVAC as a business ([SPS 305.70](https://docs.legis.wisconsin.gov/code/admin_code/sps/safety_and_buildings_and_environment/301_319/305/VII/70)) |

### Qualifier / person credentials (label clearly — not “the company is licensed to build houses”)

| Official type | LicensE suffix | Notes |
|---------------|----------------|-------|
| Dwelling Contractor Qualifier | `DCQ` | Required alongside DC / DCR to pull a 1–2 family permit |
| HVAC Qualifier | `HVACQ` | Individual qualifier, not the firm registration |
| Master Electrician | `ME` | Person credential |
| Master Plumber | `PM` | Person credential (restricted appliance / service variants exist) |

### Default exclude (not “hire this contractor” credentials)

Electrical / plumbing / HVAC apprentices and helpers, journeyman classes, registered electrician (`BE`), inspectors (UDC / commercial / fire), testers, learners, welders, manufactured-home sales roles, blasters, and similar helper / inspector sets — unless a later phase documents them separately.

Utility Contractor (`UC`) and Automatic Fire Sprinkler Contractor (`AFSC`) are real contractor credentials but are out of the Phase 0 / v1 homeowner set.

## What is / is not statewide GC

| Claim | Truth |
|-------|--------|
| “Wisconsin licenses general contractors statewide” | **False** for commercial GC. DSPS does not issue a Florida-style certified general contractor license. |
| “Dwelling Contractor is the Wisconsin GC” | **Too strong.** It is the statewide credential tied to **1–2 family dwelling building permits**, plus a Qualifier. It is not a commercial GC. |
| “Electrical / HVAC contractor licenses cover every builder” | **False.** Those are trade-specific firm credentials. |
| Missing from Verify | **Does not mean unlicensed.** Commercial work, municipal cards, and credentials we chose not to load can all explain a miss. |

## Approximate published counts (official PDF, as of 06/01/2026)

Source: [LicenseCounts.pdf](https://dsps.wi.gov/Credentialing/General/LicenseCounts.pdf). Columns below are the PDF **statewide totals** (in-state + out-of-state). Entity `F` = firm / entity row; `I` = individual.

| Profession | Entity | Active | Inactive | Total |
|------------|--------|--------|----------|-------|
| Dwelling Contractor | F | 9,460 | 7,356 | 16,727 |
| Dwelling Contractor Restricted | F | 66 | 125 | 190 |
| Electrical Contractor | F | 3,701 | 1,458 | 5,161 |
| HVAC Contractor | F | 2,843 | 2,050 | 4,894 |
| HVAC Qualifier | I | 607 | 199 | 806 |
| Master Electrician | I | 6,232 | 1,208 | 7,442 |
| Master Plumber | I | 2,833 | 634 | 3,468 |

In-state **active** subsets (same PDF): Dwelling Contractor 6,691 · Electrical Contractor 3,005 · HVAC Contractor 2,282.

The published **Dwelling Contractor Qualifier** row on that PDF is not usable (two identical lines totaling 2 credentials). Do not cite it as a product count.

A v1 firm set of DC + EC + HVACCONT is on the order of **~16,000 active** credentials statewide — large enough to be useful, **if** we obtain an official extract.

## Field inventory

### License API (official guide — verification of a known number)

[DSPSLicenseAPIConnectionGuide.pdf](https://dsps.wi.gov/Documents/DSPSLicenseAPIConnectionGuide.pdf)

- Endpoint: `GET https://prod-exp-wi-license–search-v1.us-e2.cloudhub.io/api/blp/{LicenseNumber}`
- Number format: `{number} - {typeId}` e.g. `1000 - 21` (space-dash-space)
- Auth: `client_id` / `client_secret` from `widsps-license-apirequest@wisconsin.gov`
- Phase 0 unauthenticated probe: **401** `Authentication denied.` — endpoint is live; we have no credentials and will not request bulk use.

Documented response fields (example in the guide is a health-license shape; trades may populate a subset):

| Field | In example | Product use |
|-------|------------|-------------|
| Name | yes | Licensee name |
| Organization Name | yes | Firm / DBA when present |
| Status | yes | Active / other as published |
| License Number / License Name | yes | Official id (`1000 - 21`) |
| License Type | yes | e.g. “Regular” — not the trade name |
| Regulatory Authorization Type | yes | Profession label in the example |
| Period End | yes | Expiration |
| Granted Date | yes | Original / grant date |
| Jurisdiction Type | yes | e.g. STATE |
| Disciplinary Action Indicator | yes | **Pointer** to LicensE orders search — not a structured discipline archive |
| Orders Indicator | yes | Boolean-ish flag in the example |
| Multi-State / Compact / Speciality fields | yes | Health-compact oriented; do not invent trades meaning |

**Not in the API example:** street address, city, county, bond, insurance, qualifying-party roster, inactive historical archive.

### Interactive LicensE lookup

Salesforce Experience Cloud **criteria search** (guest community, `authenticated=false`). Not a roster export.

- Direct `GET https://license.wi.gov/s/license-lookup` → **Cloudflare 403** (2026-08-14)
- `https://licensesearch.wi.gov/` → 200 after redirect; SPA shell only (~318 KB). Lightning search button CSS; no CSV / Excel
- Aura/bootstrap paths exist; no public `/services` REST roster. Do not harvest Aura.
- Result columns are not in the static HTML (client-rendered LWC). API guide fields above are the documented verify shape.

Raw probe files: `data/raw/wi_dsps/` (gitignored) · notes: `data/samples/wi_dsps/probe_notes.txt`

### Order list of licensees

Official paid/self-service list path exists as a page, but the service is **temporarily suspended** while DSPS consolidates onto LicensE. Field inventory for that file is therefore **unknown until the service returns or an open-records file arrives**.

### Stable product key

`WI-DSPS:{SUFFIX}:{number}`  
e.g. `WI-DSPS:DC:1234` for official `1234 - DC`.

If a future extract only has an opaque credential id, fall back to `WI-DSPS:{credential_id}`. Do not invent numbers.

## Acquisition limits (Phase 0)

| Path | Result |
|------|--------|
| Official Order List export | Suspended — preferred future path |
| Open data / Socrata | No DSPS contractor roster found |
| License API | Live, auth required, **verification only** — no roster sync |
| LicensE search harvest | Cloudflare-protected Salesforce app; no stable public export |
| eSLA | Wrong system (plans / safety), not trades credentials |
| Open records | Honest path for a firm-only roster (DC, EC, HVACCONT) |

If a later harvest of LicensE were ever approved (last resort):

- Human-paced only: **one query every 5–10 seconds**, hard daily cap, no unfiltered “all Active” crawls
- Prefer name + credential-type queries, sample pages only
- Stop if Cloudflare / ToS / robots indicate we should
- Prefer asking DSPS for a file instead

Phase 0 obtained **zero licensee rows**. Sample files under `data/samples/wi_dsps/` are schema + official suffix / count inventory only.

## Gaps

- No official bulk extract while Order List is suspended
- License API must not be used to replicate the roster
- No bond / COI
- Discipline is a separate LicensE orders search (plus an API indicator that points there) — not a loadable archive in Phase 0
- Inactive / historical depth only if a future extract includes those statuses (the count PDF shows large inactive piles)
- Municipal permit cards and commercial-builder registrations are out of DSPS trades
- Dwelling Contractor Qualifier counts in the 06/01/2026 PDF look incomplete

## Related

- Index: [DATA_SOURCES.md](./DATA_SOURCES.md)
- Product: [WISCONSIN_VERIFY_V1.md](./WISCONSIN_VERIFY_V1.md)
