# Exact contractor activity opportunity — Los Angeles + Santa Clara

Ticket: **CA-CON-COUNTY-001B**. Harvest only. **No county pages.**

Geography is labeled at source grain:

- **City of Los Angeles** ≠ **Los Angeles County** ≠ **unincorporated LA County** ≠ other municipalities.
- **City of San Jose** ≠ **Santa Clara County** ≠ other Santa Clara cities.

CSLB spine reused: **75,572** acquired rows, coverage **`ACQUIRED_PARTIAL_STREAM_TRUNCATED`**. Complete statewide renewable denominator: **UNKNOWN**.

Exact local license IDs that are not in that partial extract are **`EXACT_LICENSE_NOT_IN_ACQUIRED_PARTIAL_SPINE`**. They are **not** invalid and **not** unlicensed.

PERMIT ACTIVITY ≠ QUALITY. No Trust Score, ranking, or “best contractor.”

---

## 1. How many local permit rows contain a CSLB number?

Verified current schemas (do not assume fields):

| Source | Grain | Jurisdiction | Rows | Source-native CSLB (`License #`) |
|---|---|---|---|---|
| LADBS Certificate of Occupancy (`3f9m-afei`) official, weekly | CofO | **City of Los Angeles** | 132,426 | **68,813** |
| Building Permit Information Data (`d9aa-v8bm`) PCIS field extract, last updated 2023-05-22, community-created view of official LADBS columns | PCIS permit | **City of Los Angeles** | 317,027 | **207,951** |
| LADBS Building Permits Issued 2020–present (`pi9x-tg5x`) official weekly | issued building permit | **City of Los Angeles** | 409,619 | **0 — column not in current schema** |
| San Jose official monthly Permit Data file | issued/finaled permit | **City of San Jose** | 2,456 | **0 — CONTRACTOR name only** |

The current official City of LA weekly building-permit extract **dropped contractor/license columns**. Exact CSLB attribution therefore uses:

1. Official CofO (current, weekly) — best live official license-bearing table.
2. Historical/stale PCIS permit extract with native `License #` — largest exact-ID layer, labeled stale and community-view.

Do not present either as countywide LA County permit coverage.

## 2. How many distinct CSLB licenses?

| Source | Distinct source-native licenses |
|---|---|
| City of LA CofO | 12,786 |
| City of LA PCIS permit extract | 18,132 |
| Union of those two exact-ID sets (match + outside-spine) | **20,412** distinct license numbers (3,708 in spine ∪ 16,704 outside spine) |

Malformed IDs: CofO 66; PCIS 618. Owner-builder / blank: CofO 63,547; PCIS 108,458.

## 3. How many exact-match the acquired state spine?

| Source | Exact-match rows | Distinct licenses in 75,572-row spine |
|---|---|---|
| CofO | 12,505 | **2,507** |
| PCIS permit extract | 28,974 | **3,063** |
| **Union** | — | **3,708** |

Identity: `CA-CSLB:{LicenseNo}` from source-native digits only. No guessed digits. No name-only auto-attach.

## 4. How many exact IDs are outside the partial state spine?

| Source | Outside-spine rows | Distinct licenses |
|---|---|---|
| CofO | 56,308 | 10,279 |
| PCIS permit extract | 178,977 | 15,069 |
| **Union** | — | **16,704** |

These licenses can appear in local permits even though they are missing from the truncated CSLB stream. **Not unlicensed.**

## 5. How many permit rows could safely appear as contractor work activity?

**Safe attach (this ticket):** rows with `EXACT_MATCH_ACQUIRED_CSLB`.

- CofO: **12,505** rows / 2,507 licenses
- PCIS extract: **28,974** rows / 3,063 licenses

Outside-spine exact IDs are publishable later as “exact local license, not in the acquired partial statewide extract” — not as a finding against the contractor.

San Jose contractor **name** is **UNSAFE** for auto-attach (name-only). 2,050 of 2,456 monthly rows have a contractor name.

## 6. Which lifecycle fields exist?

**CofO (official):** Status (`CofO Issued` 130,192), CofO Issue Date, Permit Issue Date, Permit Type.

**PCIS extract:** Status (`Permit Finaled`, `Issued`, `CofO Issued`, expired/closed, etc.), Issue Date, Status Date.

**Official 2020–present issued permits:** `status_desc` (Permit Finaled, Issued, CofO Issued, expired, …), `issue_date`, `status_date`, `cofo_date`. No contractor identity.

**Inspections (`9w5z-rg2h`):** 11,691,152 inspection **events**, joinable by permit number. Result is an event on a permit. Preferred wording: **“Inspection events associated with this permit.”** Do not say the contractor passed inspection unless grain + identity prove that.

Inspection-result aggregates (top): Approved 2,425,450; plus Permit Finaled and other official result tokens in `inspections-profile.json`. Full dump not committed.

## 7. Which valuations exist?

- CofO: 132,407 rows with valuation; sum ≈ **$48.12B** (source-native dollars; not a quality metric).
- PCIS extract: 316,411+ valuation-occupied rows (see join report).
- Official 2020–present extract: `valuation` field present on issued building permits.
- San Jose monthly file: `PERMITVALUATION`, `REROOFVALUATION`.

Valuation ≠ quality.

## 8. Which property IDs exist?

- CofO / PCIS: Assessor Book + Page + Parcel; address parts; zip.
- Official 2020–present: `apn`, `pin_nbr`, `primary_address`, lat/lon, zone, CPA, CNC.
- LA County eGIS parcels: **2,432,860** features; `AIN`, `APN`, `SitusFullAddress`, `TaxRateCity`, use/year-built. **No owner-person fields** on the public layer. GDB not committed.
- City of LA APN table (`qv4c-k9xz`): PIN↔APN crosswalk (~1.03M) available, not ingested.
- Santa Clara parcels (`ubcd-cewv`): **504,717** rows; `apn` + situs + `jurisdiction`. Geometry not committed.
- San Jose monthly: `APN`, `JOBLOCATION`.

## 9. Can inspections be safely associated?

**To a permit:** yes, via `permit` = PCIS permit number.

**To a contractor:** only after the permit itself has a source-native CSLB number. Then the public sentence is still “inspection events associated with this permit,” not “contractor passed inspection.”

11.7M-row dump skipped.

## 10. What would a ContractorTrustHub consumer gain?

For a contractor whose CSLB number is in the acquired partial spine **and** appears on City of LA CofO/PCIS rows:

- Neutral work-activity: permit/CofO row counts, distinct permits, types, statuses, issue years, valuations, work-description coverage, distinct APN/address locations, earliest/latest dates.
- Exact ID: `CA-CSLB:{n}` — not a name match.
- Separate CSLB public phone from LA permit business address (address difference ≠ violation).
- Honest coverage: City of LA only; current weekly permit extract has **no** contractor license; statewide spine is truncated.

That is a real moat versus name-only permit scrapers. It is **not** a county page yet.

---

## Santa Clara / San Jose (thinner, high quality)

- County parcels: 504,717 — identity/jurisdiction layer for later joins.
- County Accela public development records: **30,179** — unincorporated/county portal, not every city. No CSLB field in the public layer profiled.
- San Jose official monthly TAB file: **2,456** rows, **2,050** with contractor **name**, **0** CSLB numbers. Name-only = UNSAFE auto-attach. Useful as a light city market module (volume, APN, valuation).
- DEH Food Facility Inspection 2021: official facility/inspection identity. **Restaurant score ≠ RCFE quality.** Future owner: SENIOR. Not ingested as a senior-care score.

## Contacts

LA CofO/PCIS: contractor address/city/state. **Phone/email/website = 0** on those tables. Do not overwrite CSLB public phone. Do not web-search contacts.

## Deliberately skipped

Other LA/Santa Clara cities; Orange/Alameda/Sacramento/Riverside/San Bernardino; recorder/owner dossiers; EPIC-LA scrape (portal, no bulk); DCBA case retrieval (no bulk table found); 11.7M inspection dump; parcel binaries; CAPTCHA/PRA.

## Publication (not this ticket)

| Surface | Decision |
|---|---|
| `/california/los-angeles-county` | not built — KEEP_DATA_ONLY / later county page |
| City of Los Angeles contractor activity | **PUBLISH_CITY_MARKET_MODULE** (follow-up) |
| Unincorporated LA / EPIC | PARK |
| Santa Clara County | KEEP_DATA_ONLY |
| City of San Jose | **PUBLISH_LIGHT_MARKET_MODULE** (volume only; no name-only contractor attach) |
| Ask / specialist sitemaps | unchanged |

Recommended follow-up: a shared county loader **after** SF/SD (Builder 3) and this harvest both land — do not invent it here.
