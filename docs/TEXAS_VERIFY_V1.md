# Texas Verify v1 — specialty trades (shipped path)

## What is live

| Surface | Status |
|---------|--------|
| TDLR specialty download | `scripts/download_tx_tdlr.py` → `data/raw/tx_tdlr/` |
| Normalize / stage | `python -m ingest.adapters.tx_tdlr` → `data/staging/tx_tdlr/` |
| Postgres load | `scripts/load_tx_tdlr_to_postgres.py` (`source_system = tx_tdlr`) |
| State config | `EVIDENCE_STATES.tx.live = true` with honest `coverageNote` |
| Verify UI | `/verify?state=tx` — name or license # search |
| Trust Report | `/contractors/[slug]` for TX rows (TDLR fields; no Sunbiz) |
| Coverage banner | Calm sky-toned banner: included vs not-yet trades |
| Trade labels | Plain-language labels via `lib/states/tx-trades.ts` (e.g. Air Conditioning Contractor) |
| Empty states | Texas-specific copy + next actions (FL switch, TDLR official search) |

### Specialty license types (v1)

Business-level TDLR contractor classes only:

- Electrical Contractor  
- A/C Contractor  
- Electrical Sign Contractor  
- Appliance Installation Contractor  
- Elevator Contractor  
- Water Well Driller/Pump Installer  

Apprentices / journeymen / master electrician individual cards are **not** the default ingest filter (noise for homeowners). Labels exist in code if a future slice needs them.

## Honest product claims

**Do say:**

- Texas has **no** statewide general contractor license.  
- This product covers **selected TDLR specialty trades** only.  
- Plumbing is under **TSBPE** and is **not fully covered** yet.  
- Many general builders are **city/county only** — confirm local requirements.  
- Prefer fewer accurate matches over weak padded results.

**Do not say:**

- “All Texas contractors”  
- Statewide GC / residential builder directory  
- That missing from results means “unlicensed” in Texas (local registration may still exist)

## Still out of scope (v1)

- TSBPE plumbing adapter (`tx_tsbpe`)  
- Municipal / county GC registration feeds  
- Full TDLR non-construction programs  
- Texas Discovery browse by county (thin without solid addresses)  
- Plan / Cost Studio Texas cost bands  
- Lead gen, rankings, scores, introductions  
- High-confidence TX SOS entity linking (unlike Florida Sunbiz)

## End-to-end load path

```bash
# 1) Download specialty slice (SODA 7358-krk7)
python scripts/download_tx_tdlr.py
# optional smoke: python scripts/download_tx_tdlr.py --limit 2000

# 2) Stage normalized licenses + batch manifest
python -m ingest.adapters.tx_tdlr \
  --input data/raw/tx_tdlr/tdlr_licenses_specialty.csv \
  --out-dir data/staging/tx_tdlr

# 3) Idempotent upsert into Postgres (requires DATABASE_URL)
python scripts/load_tx_tdlr_to_postgres.py \
  --staging-dir data/staging/tx_tdlr

# First-time local DB only:
python scripts/load_tx_tdlr_to_postgres.py --init-schema \
  --staging-dir data/staging/tx_tdlr
```

Sample (committed, no network):

```bash
python -m ingest.adapters.tx_tdlr \
  --input data/samples/tx_tdlr_specialty_sample.csv \
  --out-dir data/staging/tx_tdlr_sample
python scripts/load_tx_tdlr_to_postgres.py \
  --staging-dir data/staging/tx_tdlr_sample --limit 100
```

Details: [LOAD_PATH.md](./LOAD_PATH.md) · [DATA_SOURCES_TX.md](./DATA_SOURCES_TX.md) · [ingest/README.md](../ingest/README.md)

## UI entry points

| URL | Behavior |
|-----|----------|
| `/verify` | Florida (default) — unchanged |
| `/verify?state=tx` | Texas TDLR specialty search + coverage banner |
| `/contractors/{slug}` | Trust Report; TX detected via `home_state` |

Search accepts TDLR license numbers (e.g. `10001`) or product keys (`TX-TDLR:…`), or business / owner name tokens.

## Implementation checklist

1. ✅ Document sources (`DATA_SOURCES_TX.md`)  
2. ✅ Download + normalize TDLR specialty slice  
3. ✅ Load `tx_tdlr` into Postgres with batch provenance  
4. ✅ `EVIDENCE_STATES.tx.live = true`  
5. ✅ Verify UI state switcher + coverage banner  
6. ✅ Trust Report TX path (no Sunbiz requirement)  
7. ⬜ Production full specialty refresh on schedule (ops)  
8. ⬜ Optional: TSBPE plumbing as separate source later  

## Success criteria

- Search by known A/C or Electrical Contractor license # returns the right row  
- Name search returns specialty contractors, not cosmetology  
- Empty / wrong GC-style queries show coverage explanation, not invented matches  
- Florida Verify / Plan / Discovery remain default and stable  

## Explicit non-claims

- Not a statewide GC registry  
- Not “all Texas contractors”  
- Not a substitute for municipal permitting or local registration checks  
- Not TSBPE until that adapter ships  
