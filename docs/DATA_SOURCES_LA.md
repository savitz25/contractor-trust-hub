# Louisiana data sources — LSLBC contractor licenses

Florida remains the full-journey product. Louisiana Verify is a **statewide State Licensing Board for Contractors (LSLBC)** lookup — not a marketplace and not a ranking.

## Coverage reality

| What Louisiana has statewide | What this extract is not |
|------------------------------|--------------------------|
| LSLBC commercial, residential, home improvement, and mold credentials | A live check at page load |
| Official public Request Roster (Active) | Trade classifications / qualifying parties |
| Parish, city, mailing address, dates | Proof of current bond or insurance |
| Interactive lookup for confirmation | A complaint / discipline archive |
| Frequent roster regeneration | A substitute for the official LSLBC lookup |

**Product rule:** Louisiana *does* license contractors statewide through LSLBC. Still confirm current status and classifications on the official LSLBC lookup before hiring.

## Official sources (preferred)

| Resource | URL | Notes |
|----------|-----|--------|
| Request Roster | https://arlspublic.lslbc.louisiana.gov/Public/RequestRoster | Free public CSV; `$0.00` |
| Roster POST | `https://arlspublic.lslbc.louisiana.gov/Public/_RequestRoster/` | Returns JSON pointer to generated CSV |
| Contractor lookup | https://arlspublic.lslbc.louisiana.gov/Public/Search | Interactive human confirm |
| Types of licenses | https://lslbc.gov/types-of-licenses/ | Commercial / residential / HI / mold |
| Classifications list | https://lslbc.gov/exams-classifications/ | Trade exams — **not** on the roster CSV |
| Consumer verify page | https://lslbc.gov/verify-licensure/ | How to confirm |

**Prefer:** official Request Roster CSVs.  
**Avoid:** scraping the interactive search as the primary source.

## License structure (published types)

LSLBC statutes provide four consumer-facing credential types on the public roster (`AccountTypeID=20`):

| Roster type id | Published “Credential Type” | Product code | Family |
|----------------|-----------------------------|--------------|--------|
| 23 | Commercial License Certificate | `CLC` | Commercial |
| 25 | Residential License Certificate | `RLC` | Residential |
| 27 | Home Improvement Registration | `HIR` | Specialty |
| 45 | Mold Remediation License Certificate | `MRL` | Specialty |

Commercial / residential thresholds and home-improvement / mold scopes are published on [Types of Licenses](https://lslbc.gov/types-of-licenses/). Inspector credentials (`AccountTypeID=70`) are **not** ingested.

The public roster form only offers **Active** status (`StatusTypes=1`). Omitting status returns an error. Expired / inactive rows are not on this export.

## Columns observed (Request Roster CSV, 2026-08-14)

| Field | Description |
|-------|-------------|
| `LicenseNumber` | Official LSLBC number (unique across the four contractor types in this load) |
| `CompanyName` | Business name |
| `Credential Type` | Commercial / Residential / Home Improvement / Mold |
| `Status` | Active on this export |
| `MailingAddress1`, `MailingAddress2` | Address on file |
| `City`, `StateCode`, `ZipCode` | Mailing location |
| `Parish` | Louisiana parish when present |
| `Phone`, `Email` | As published (stored on payload; not used for lead-gen) |
| `EffectiveDate`, `ExpirationDate`, `FirstEffectiveDate` | `MM/DD/YYYY` |
| `OutOfStateFlag` | `Y` / `N` |

**Not on this export:** trade classifications, qualifying-party names, bond, insurance, discipline.

**Stable product key:** `LA-LSLBC:{LicenseNumber}`

## Production download (2026-08-14)

| Type | Active rows |
|------|-------------|
| Commercial License Certificate | 19,993 |
| Residential License Certificate | 4,579 |
| Home Improvement Registration | 1,462 |
| Mold Remediation License Certificate | 264 |
| **Total** | **26,298** |

0 duplicate license numbers across types.

## Qualifying party / parish

- **Parish** is a first-class field on the roster and is stored as `county_name`.
- **Qualifying parties** appear on the interactive lookup, not on this CSV. Do not invent them.

## Bond / insurance / entity limitations

- This roster does **not** publish bond or insurance. Do not invent them.
- Email / phone are contact fields as published — not a COI.
- Mailing `StateCode` can be outside LA. The **credential is still Louisiana LSLBC**. Product `home_state` is always `LA`.
- Always re-check on [LSLBC lookup](https://arlspublic.lslbc.louisiana.gov/Public/Search).

## Provenance

1. `source_system = la_lslbc`
2. Store source URL, file, SHA-256, `extracted_at` on `ingest_batches`
3. Never invent license numbers, classifications, discipline, bond, or insurance

## Ingest path

```bash
python scripts/download_la_lslbc.py
python -m ingest.adapters.la_lslbc --input data/raw/la_lslbc/lslbc_contractor_roster.csv
python scripts/load_la_lslbc_to_postgres.py --staging-dir data/staging/la_lslbc
```

Sample (committed): `data/samples/la_lslbc_contractor_sample.csv`

## Related

- Index: [DATA_SOURCES.md](./DATA_SOURCES.md)
- Product: [LOUISIANA_VERIFY_V1.md](./LOUISIANA_VERIFY_V1.md)
- Ingest conventions: [../ingest/README.md](../ingest/README.md)
