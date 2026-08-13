# California Verify v1 — CSLB top-county foundation

## What is live (product path)

| Surface | Status |
|---------|--------|
| Official source notes | [DATA_SOURCES_CA.md](./DATA_SOURCES_CA.md) |
| Raw downloads | `data/raw/ca_contractors/CSLBSearchData_*.xlsx` |
| Normalize | `python -m ingest.adapters.ca_cslb` → `data/staging/ca_cslb/` |
| Postgres load | `scripts/load_ca_cslb_to_postgres.py` / `load_ca_cslb_via_supabase_rest.py` |
| State config | `EVIDENCE_STATES.ca` — pilot Verify |
| Verify UI | `/verify?state=ca` |
| Coverage banner | Amber county-limit banner + Instant License Check |

## Honest product claims

**Do say:**

- California licenses most construction contractors through **CSLB** statewide.  
- **This extract covers high-impact counties present in our official list downloads** (top-30 plan; Riverside missing from the 2026-08-13 file set).  
- Always confirm on **CSLB Instant License Check**.  
- Missing from results does **not** mean unlicensed.

**Do not say:**

- “All California contractors” from this download alone  
- Complete statewide file if county coverage is partial  
- Live bond / workers’ comp verification  
- Florida-depth plan / permit journey for CA  

## End-to-end load path

```bash
python -m ingest.adapters.ca_cslb \
  --input-dir data/raw/ca_contractors \
  --out-dir data/staging/ca_cslb

python scripts/load_ca_cslb_to_postgres.py --staging-dir data/staging/ca_cslb
# or PostgREST:
python scripts/load_ca_cslb_via_supabase_rest.py --staging-dir data/staging/ca_cslb
```

## Counts (after adapter run)

See `data/staging/ca_cslb/batch_manifest.json` for live county and class rollups.  
Initial inventory: **~36.7k unique CLEAR licenses** across **30 counties** in the download set.

## Guardrails

1. Honest county-coverage banner  
2. No invented license numbers  
3. FL / TX / NJ / OR paths unchanged  
4. Official portal files only  

## Related

- [DATA_SOURCES_CA.md](./DATA_SOURCES_CA.md)  
- [LOAD_PATH.md](./LOAD_PATH.md)  
