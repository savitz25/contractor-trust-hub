# California Verify v1 — CSLB high-impact counties

## What is live

| Surface | Status |
|---------|--------|
| Official sources | [DATA_SOURCES_CA.md](./DATA_SOURCES_CA.md) |
| Raw files | `data/raw/ca_contractors/CSLBSearchData_*.xlsx` (24 files) |
| Adapter | `python -m ingest.adapters.ca_cslb` → `data/staging/ca_cslb/` |
| Load | `scripts/load_ca_cslb_to_postgres.py` / `load_ca_cslb_via_supabase_rest.py` |
| Registry | `EVIDENCE_STATES.ca` · `live: true` · pilot |
| Verify | `/verify?state=ca` |
| Banner | Statewide CSLB; dataset prioritizes top counties; Instant License Check |

## Honest product claims

**Do say:**

- California **statewide CSLB** licensing  
- Current dataset prioritizes **top high-impact counties** from official CSLB list extracts  
- Always confirm **live status on CSLB Instant License Check**  
- Missing from results does **not** mean unlicensed  

**Do not say:**

- Complete statewide directory from this download alone  
- Invented discipline / personnel history  
- Live bond or workers’ comp verification  
- CA Plan / Studios (Florida-only for now)  

## Plain-language class labels

| Code | Label |
|------|--------|
| **B** | General Building |
| **C-10** | Electrical |
| **C-36** | Plumbing |
| **C-39** | Roofing |
| **C-20** | HVAC / Warm-Air Heating |
| **A** | General Engineering |
| **C-27** | Landscaping |
| **C-53** | Swimming Pool |
| … | See `lib/states/ca-classifications.ts` |

Multi-class licenses: primary class drives the card label; full set is in `class_code` (`A|B|C10`).

## Production counts (2026-08-13 load)

| Metric | Value |
|--------|------:|
| Unique licenses (`ca_cslb`) | **36,665** |
| Status in extract | **CLEAR** (active) only |
| Source files | 24 Excel downloads |
| Counties in extract | **30** |

### By county (unique licenses)

| County | Count | County | Count |
|--------|------:|--------|------:|
| Los Angeles | 9,585 | San Mateo | 684 |
| Orange | 4,068 | Placer | 631 |
| San Diego | 3,726 | Santa Barbara | 534 |
| San Bernardino | 2,308 | El Dorado | 483 |
| Sacramento | 1,699 | San Joaquin | 479 |
| Santa Clara | 1,626 | Marin | 427 |
| Alameda | 1,451 | Santa Cruz | 391 |
| Contra Costa | 1,370 | Stanislaus | 368 |
| Fresno | 906 | Monterey | 367 |
| Ventura | 892 | Solano | 337 |
| San Francisco | 833 | Butte | 337 |
| Sonoma | 761 | Tulare | 257 |
| Kern | 716 | Yolo | 205 |
| San Luis Obispo | 715 | Napa | 202 |
| | | Merced | 192 |
| | | Imperial | 115 |

**Tier 1 high-impact:** all present after Riverside batch (**Riverside ≈ 3,472** unique CLEAR).

### Major classifications (token frequency; multi-class licenses count multiple)

| Class | Approx. licenses holding class |
|-------|-------------------------------:|
| C-10 Electrical | ~19.7k |
| A General Engineering | ~11.2k |
| B General Building | ~10.5k |
| C-36 Plumbing | ~4.4k |
| C-20 HVAC | ~2.0k |
| C-53 Pool | ~1.9k |
| C-39 Roofing | ~0.3k (plus others in long tail) |

Exact rollups: `data/staging/ca_cslb/batch_manifest.json` → `county_counts` / `class_counts_top`.

## End-to-end path

```bash
python -m ingest.adapters.ca_cslb \
  --input-dir data/raw/ca_contractors \
  --out-dir data/staging/ca_cslb

python scripts/load_ca_cslb_to_postgres.py --staging-dir data/staging/ca_cslb
# or:
python scripts/load_ca_cslb_via_supabase_rest.py --staging-dir data/staging/ca_cslb
```

Sample (no Excel):

```bash
python -m ingest.adapters.ca_cslb \
  --input data/samples/ca_cslb_sample.csv --csv \
  --out-dir data/staging/ca_cslb_sample
```

## Remaining gaps

| Gap | Notes |
|-----|--------|
| **Statewide completeness** | Extract is high-impact counties present in downloads — not every CA county file |
| **Smaller counties** | Low-population counties may still be absent |
| **Personnel / qualifier file** | Not in these list columns |
| **Workers’ comp depth** | Fields stored as published; **not** live COI / policy verification |
| **Enforcement / discipline** | Not in list Excel files — do not invent |
| **Inactive / expired** | Current downloads are CLEAR-only |
| **SOS entity links** | Not wired |
| **CA Plan / Studios** | Out of scope for Verify v1 |

## Guardrails

1. Official CSLB list files only  
2. Evidence-only; no lead-gen  
3. FL / TX / NJ / OR unchanged  
4. Always confirm on Instant License Check  

## Related

- [DATA_SOURCES_CA.md](./DATA_SOURCES_CA.md)  
- [LOAD_PATH.md](./LOAD_PATH.md)  
