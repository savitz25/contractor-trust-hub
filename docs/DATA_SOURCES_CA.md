# California data sources (Phase 0)

Florida remains the full-journey product. Texas / New Jersey / Oregon are Verify-focused.  
**California Verify v1** uses official **CSLB** (Contractors State License Board) public list downloads for high-impact counties.

## Coverage reality (product-critical)

| What California has | What this extract does **not** claim |
|---------------------|--------------------------------------|
| Statewide CSLB licensing for most construction trades | Complete coverage of every CA county in the current download set |
| Public Data Portal classification / county list Excel files | Live bond / workers’ comp certificate verification |
| Instant License Check (interactive) | Automatic SOS entity linkage |
| Classifications A, B, C-series specialties | A full statewide dump in this repo (we staged county-list extracts) |

**Product rule:** Label Verify as **CSLB licenses from official public list extracts covering the loaded counties**. Always tell users to confirm on [CSLB Instant License Check](https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx).

## Official sources

| Resource | URL | Notes |
|----------|-----|--------|
| CSLB home | https://www.cslb.ca.gov/ | Board + consumer info |
| Instant License Check | https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx | Human verify — not bulk ingest |
| Public Data Portal / list downloads | CSLB online services | County / classification Excel lists (`CSLBSearchData_*.xlsx`) |

**Prefer:** Official free portal Excel downloads.  
**Avoid:** Scraping Instant License Check as primary truth.

## Download inventory (this repo)

Raw directory: `data/raw/ca_contractors/`

| Item | Value |
|------|--------|
| Files | 24 × `CSLBSearchData_*.xlsx` |
| Schema | Shared 24-column layout (LicenseNumber, BusinessName, County, Classification(s), Status, bond/WC fields, …) |
| Unique licenses (after dedupe) | **~43,779** (baseline 36,665 + Riverside + coverage batches) |
| Status in extract | **CLEAR** only in the 2026-08-13 download set |
| Counties present | **39** (includes Riverside + smaller northern counties from later extracts) |

### Columns observed

```
LicenseNumber, BusinessType, BusinessName, Address, City, State, ZIP Code, County,
PhoneNumber, IssueDate, ExpirationDate, Classification(s), Status,
SuretyCompany, ContractorBondNumber, BondEffectiveDate, BondCancellationDate,
WorkersCompCoverageType, WorkersCompInsuranceCompany, WorkersCompPolicyNumber,
EffectiveDate, ExpirationDate1, CancellationDate, WorkersCompSuspendDate
```

### Target high-impact counties vs download

**Present (39 counties after Riverside batch):**  
Los Angeles, Orange, San Diego, **Riverside**, San Bernardino, Sacramento, Santa Clara, Alameda, Contra Costa, Fresno, Ventura, Sonoma, Kern, San Luis Obispo, San Mateo, Placer, Santa Barbara, El Dorado, San Joaquin, Marin, Santa Cruz, Stanislaus, Monterey, Solano, Butte, Tulare, Yolo, Napa, Merced, Imperial, San Francisco, plus smaller counties from later extracts (Shasta, Nevada, Humboldt, Madera, Sutter, San Benito, Yuba, Kings).

**Tier 1 high-impact:** all present (Riverside closed with 7 portal extracts).

Approximate unique license counts by county (after license-number dedupe) are written to `batch_manifest.json` on each adapter run.

### Classification multi-value handling

- Portal field `Classification(s)` is pipe-separated (e.g. `A | B | C10`)
- Product `occupation_code` = **primary** (first) class code  
- Full set stored in `class_code` as `A|B|C10`  
- Bond / WC metadata kept in `secondary_status` + `raw_payload_json`

## Stable product key

`CA-CSLB:{LicenseNumber}`  
Do not invent board IDs. Numeric license numbers only after stripping non-alphanumerics.

## Ingest path

| Step | Command |
|------|---------|
| Inventory | Files under `data/raw/ca_contractors/`; optional `inventory.json` |
| Normalize | `python -m ingest.adapters.ca_cslb --input-dir data/raw/ca_contractors --out-dir data/staging/ca_cslb` |
| Load (Postgres) | `python scripts/load_ca_cslb_to_postgres.py --staging-dir data/staging/ca_cslb` |
| Load (PostgREST) | `python scripts/load_ca_cslb_via_supabase_rest.py --staging-dir data/staging/ca_cslb` |
| Verify UI | `/verify?state=ca` |

### Sample (committed)

```bash
python -m ingest.adapters.ca_cslb \
  --input data/samples/ca_cslb_sample.csv --csv \
  --out-dir data/staging/ca_cslb_sample
```

## Production counts (2026-08-13)

| Metric | Value |
|--------|------:|
| Unique licenses loaded | **43,779** |
| Status | CLEAR only |
| Counties | **39** (includes Riverside + several smaller counties) |
| Top class tokens | C-10, A, B, C-36, C-20, C-53, … |

Full county / class tables: [CALIFORNIA_VERIFY_V1.md](./CALIFORNIA_VERIFY_V1.md) · staging `batch_manifest.json`.

## CA-CON-001 statewide foundation (2026-09-03)

The high-impact county Excel extracts above remain the Verify v1 load. CA-CON-001 separately acquired the official **License Master** portal stream (as of 2026-09-02) plus DIR electrician, DLSE debarment, and Cal/OSHA asbestos lists.

See [california/ca-con-001-contractor-opportunity.md](./california/ca-con-001-contractor-opportunity.md). `/california` is still unpublished.

## Remaining gaps

| Gap | Notes |
|-----|--------|
| Statewide completeness | High-impact county extracts — not every CA county file |
| Smaller / rural counties | e.g. Alpine, Amador, and other low-population counties may still be absent |
| License-type breadth | Portal 10-type limit may under-cover some trades even in loaded counties |
| Personnel file | Qualifier/personnel depth not in list columns |
| Workers’ comp | Fields as published only — not live COI |
| Enforcement | Not present — do not invent |
| Inactive/expired | CLEAR-only extract |
| CA Plan/Studios | Out of scope (Verify first) |

## Provenance rules

1. Store `source_system = ca_cslb`, source file list, SHA-256 when available, `extracted_at`  
2. Never invent license numbers  
3. Prefer latest portal extract; keep prior `ingest_batches`  
4. Product copy must state county coverage limits + Instant License Check  

## Related

- Main index: [DATA_SOURCES.md](./DATA_SOURCES.md)  
- Product slice: [CALIFORNIA_VERIFY_V1.md](./CALIFORNIA_VERIFY_V1.md)  
- Load path: [LOAD_PATH.md](./LOAD_PATH.md)  
- Ingest: [../ingest/README.md](../ingest/README.md)  

