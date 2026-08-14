# Washington data sources — L&I contractor licenses

Florida remains the full-journey product. Washington Verify is a **statewide Labor & Industries (L&I) contractor license / registration** lookup — not a marketplace and not a ranking.

## Coverage reality

| What Washington has statewide | What this extract is not |
|------------------------------|--------------------------|
| L&I contractor licensing / registration (construction, electrical, plumbing, elevator) | A guarantee of live status at page load |
| Published license status (Active, Expired, Suspended, and others) | A complete complaint / discipline archive |
| Specialty codes and descriptions when present | Proof of current bond or insurance |
| Address, UBI, and primary principal as published | A Secretary of State entity link |
| Frequent open-data refresh | A substitute for the official L&I verify site |

**Product rule:** Washington *does* license / register contractors statewide through L&I. Still confirm current status on the official L&I verify site before hiring. This general contractor-license extract does **not** include bond or insurance amounts.

## Official open data (preferred)

| Resource | URL | Notes |
|----------|-----|--------|
| L&I Contractor License Data — General | https://data.wa.gov/Labor/L-I-Contractor-License-Data-General/m8qx-ubtq | Socrata dataset `m8qx-ubtq` |
| SODA API | `https://data.wa.gov/resource/m8qx-ubtq.json` | Paginated JSON; prefer this over scraping |
| L&I contractor verify | https://secure.lni.wa.gov/verify/ | Interactive human confirm |
| L&I contractor licensing | https://lni.wa.gov/licensing-permits/contractors/ | Consumer / licensee info |

**Prefer:** data.wa.gov / SODA bulk export.  
**Avoid:** Scraping the interactive verify tool as the primary source.

## Columns observed (dataset `m8qx-ubtq`, 2026-08-13 probe)

~**160,998** rows. `ContractorLicenseNumber` is unique in this extract (1:1 with rows).

| Field | Description |
|-------|-------------|
| `BusinessName` | Legal / business name on the license |
| `ContractorLicenseNumber` | Stable L&I contractor license number |
| `ContractorLicenseTypeCode` | `CC`, `EC`, `PC`, `LC` |
| `ContractorLicenseTypeCodeDesc` | Construction / Electrical / Plumbing / Elevator contractor |
| `Address1`, `Address2`, `City`, `State`, `Zip` | Address on file (mailing state is not always WA) |
| `PhoneNumber` | When present |
| `LicenseEffectiveDate`, `LicenseExpirationDate` | ISO timestamps as published |
| `BusinessTypeCode` / `BusinessTypeCodeDesc` | LLC, Corporation, Individual, … |
| `SpecialtyCode1` / `SpecialtyCode1Desc` | Primary specialty (e.g. GENERAL, ROOFING) |
| `SpecialtyCode2` / `SpecialtyCode2Desc` | Second specialty — rarely populated |
| `UBI` | Washington Unified Business Identifier |
| `PrimaryPrincipalName` | Primary principal as published |
| `StatusCode` | Short code (`A`, `E`, `S`, …) |
| `ContractorLicenseStatus` | ACTIVE, EXPIRED, SUSPENDED, RE-LICENSED, OUT OF BUSINESS, … |
| `ContractorLicenseSuspendDate` | Present on many suspended / historical rows |

**Not in this feed:** bond company / amount, liability insurance, workers’ comp, complaints, or SOS entity records.

**Stable product key:** `WA-LNI:{ContractorLicenseNumber}`  
License numbers are unique in the 2026 probe. Do not invent board IDs.

## License types (production load 2026-08-13)

| Code | Published description | Rows |
|------|----------------------|------|
| CC | Construction Contractor | 148,648 |
| EC | Electrical Contractor | 9,199 |
| PC | Plumbing Contractor | 3,029 |
| LC | Elevator Contractor | 122 |

**Status mix (same load):** Active 75,483 · Expired 61,333 · Suspended 9,820 · Re-licensed 9,405 · Out of business 4,708 · smaller residual statuses (249). Total **160,998**.

Unlike Oregon’s *active-only* CCB feed, this L&I extract includes expired and suspended rows. That is useful evidence — do not treat a hit as “cleared to hire.”

**Specialty note:** `GENERAL` is the dominant specialty (~115k). Specialty is a published classification on the license — not a ranking and not a substitute for asking what work they will perform.

**County note:** This general feed is strong on city and ZIP and does **not** publish an official county field. Explore derives county at query time from a maintained ZIP5 → county map. That derivation is not written onto license rows. See [WASHINGTON_FULL_JOURNEY_V1.md](./WASHINGTON_FULL_JOURNEY_V1.md).

## Bond / insurance / entity limitations

- This general dataset **does not publish** bond or insurance fields. Do not invent them.
- UBI is an identifier, not proof a business filing is in good standing.
- Primary principal is as published — not a linked officer roster.
- Mailing `State` can be OR, ID, CA, etc. The **credential is still Washington L&I**. Product `home_state` is always `WA`.
- Always re-check on [L&I verify](https://secure.lni.wa.gov/verify/) when a decision depends on status.

## Provenance

1. `source_system = wa_lni`
2. Store source URL, file, SHA-256, `extracted_at` on `ingest_batches`
3. Never invent license numbers, discipline, bond, or insurance
4. Product copy: statewide L&I contractor licensing / registration; confirm on the official L&I site

## Ingest path

```bash
python scripts/download_wa_lni.py
python -m ingest.adapters.wa_lni --input data/raw/wa_lni/lni_contractor_licenses.csv
python scripts/load_wa_lni_to_postgres.py --staging-dir data/staging/wa_lni
```

Sample (committed): `data/samples/wa_lni_contractor_sample.csv`

## Related

- Index: [DATA_SOURCES.md](./DATA_SOURCES.md)
- Product: [WASHINGTON_VERIFY_V1.md](./WASHINGTON_VERIFY_V1.md)
- Explore: [WASHINGTON_FULL_JOURNEY_V1.md](./WASHINGTON_FULL_JOURNEY_V1.md)
- Ingest conventions: [../ingest/README.md](../ingest/README.md)
