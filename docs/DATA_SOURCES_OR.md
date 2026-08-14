# Oregon data sources — CCB Active Licenses

Florida remains the full-journey product. Oregon Verify is a **statewide Construction Contractors Board (CCB)** license lookup — not a marketplace and not a ranking.

## Coverage reality

| What Oregon has statewide | What this extract is not |
|---------------------------|--------------------------|
| CCB contractor licenses (residential, commercial, specialty, some related credentials) | A guarantee of live status at page load |
| Published bond company / amount / expiration when present | Proof that a bond would pay a claim today |
| Published liability insurance company / amount / expiration when present | A verified certificate of insurance |
| Workers’ comp **Exempt / Nonexempt** flag as published | Live WC policy confirmation |
| Daily-refreshed **active** license list | Historical inactive / revoked archive (not in this feed) |

**Product rule:** Oregon CCB *is* the statewide contractor license. Still confirm current status on the official CCB site before hiring. Do not treat published bond/insurance fields as live coverage.

## Official open data (preferred)

| Resource | URL | Notes |
|----------|-----|--------|
| CCB Active Licenses | https://data.oregon.gov/Business/CCB-Active-Licenses/g77e-6bhs | Socrata dataset `g77e-6bhs`; contractors who can legally work in Oregon |
| SODA API | `https://data.oregon.gov/resource/g77e-6bhs.json` | Paginated; daily refresh |
| CCB home | https://www.oregon.gov/ccb/ | Consumer / licensee info |
| CCB license search | https://search.ccb.state.or.us/search/ | Interactive human verify |

**Prefer:** Open Data Portal / SODA bulk export.  
**Avoid:** Scraping the interactive search as the primary source.

## Columns observed (dataset `g77e-6bhs`, 2026 probe)

| Field | Description |
|-------|-------------|
| `license_number` | CCB number (not globally unique across types — pair with type) |
| `license_type` | Short code (`RGC`, `RSC`, `CGC1`, `CGC2`, …) |
| `endorsement_text` | Plain-language type (e.g. Residential General Contractor) |
| `related_key` / `related_type` | Related CCB row when a firm holds multiple types |
| `orig_regis_date` | Original registration (`MM/DD/YYYY`) |
| `lic_exp_date` | License expiration |
| `full_name` | Business / licensee name |
| `address`, `city`, `state`, `zip_code` | Address on file |
| `county_code`, `county_name` | County when present |
| `phone_number` | When present |
| `rmi_name` | Responsible Managing Individual |
| `bond_company`, `bond_amount`, `bond_exp_date` | Bond as published |
| `ins_company`, `ins_amount`, `ins_exp_date` | Liability insurance as published |
| `exempt_text` | Workers’ comp Exempt / Nonexempt (as published) |

**Stable product key:** `OR-CCB:{license_number}:{license_type}`  
Do not invent board IDs. The same CCB number can appear on more than one license type.

## License types (approx. counts, 2026 probe — refresh on extract)

| Code | Endorsement (published) | Approx. rows |
|------|-------------------------|--------------|
| RGC | Residential General Contractor | ~30k |
| RSC | Residential Specialty Contractor | ~7.5k |
| CGC2 | Commercial General Contractor Level 2 | ~5.5k |
| LBPR | Lead Based Paint Renovation Contractor | ~4.4k |
| CSC2 | Commercial Specialty Contractor Level 2 | ~2.5k |
| CGC1 | Commercial General Contractor Level 1 | ~2.3k |
| CSC1 | Commercial Specialty Contractor Level 1 | ~1.0k |
| RLC | Residential Limited Contractor | ~0.9k |
| OCHI | Oregon Certified Home Inspector | ~0.6k |
| Others | Locksmith, developer, flagging, restoration, … | smaller |

**Verify v1:** ingest the **full active list** as published. Label types honestly (including inspectors / locksmiths). Do not imply every row is a general contractor.

## Bond / insurance limitations

- Fields are **as of the last CCB open-data refresh**, not a live COI check.
- Amounts and expirations can be missing.
- `exempt_text` is a workers’ comp classification on the extract — not a substitute for asking for current certificates.
- Always re-check on the official CCB search when a decision depends on coverage.

## Provenance

1. `source_system = or_ccb`
2. Store source URL, file, SHA-256, `extracted_at` on `ingest_batches`
3. Never invent license numbers or coverage status
4. Product copy: statewide CCB licensing; confirm on the official board

## Ingest path

```bash
python scripts/download_or_ccb.py
python -m ingest.adapters.or_ccb --input data/raw/or_ccb/ccb_active_licenses.csv
python scripts/load_or_ccb_to_postgres.py --staging-dir data/staging/or_ccb
```

Sample (committed): `data/samples/or_ccb_active_sample.csv`

## Explore (Full Journey v1)

County browse uses official `county_name` / `county_code`. See [OREGON_FULL_JOURNEY_V1.md](./OREGON_FULL_JOURNEY_V1.md).

## Related

- Index: [DATA_SOURCES.md](./DATA_SOURCES.md)
- Product: [OREGON_VERIFY_V1.md](./OREGON_VERIFY_V1.md)
- Explore: [OREGON_FULL_JOURNEY_V1.md](./OREGON_FULL_JOURNEY_V1.md)
- Ingest conventions: [../ingest/README.md](../ingest/README.md)
