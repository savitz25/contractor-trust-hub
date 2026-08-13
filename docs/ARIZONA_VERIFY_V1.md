# Arizona Verify v1

Minimum viable **evidence-only** Verify for Arizona Registrar of Contractors (ROC).

## Scope

| In | Out |
|----|-----|
| `/verify?state=az` license + name search | AZ Plan / Studios / Passport |
| Official **current active** posting-list CSV | Scraping interactive search as primary truth |
| Class + Class Type + location + dates | Invented discipline or live COI |
| Trust Report from loaded ROC fields | Full Florida-depth journey |

## Data

- Source: `https://roc.az.gov/posting-list` — All Current Contractors
- Adapter: `ingest/adapters/az_roc.py`
- Key: `AZ-ROC:{LicenseNo}`
- `source_system`: `az_roc`

See [DATA_SOURCES_AZ.md](./DATA_SOURCES_AZ.md).

## Product surfaces

| Surface | Behavior |
|---------|----------|
| Search | License number (preferred) or business / DBA name |
| Result card | Status, class + plain category, city/state |
| Coverage banner | Statewide ROC; posting-list current active; confirm on ROC search |
| Trust Report | Available ROC fields only; no invented discipline |

## Load

```bash
python -m ingest.adapters.az_roc \
  --input data/raw/az_roc/ROC_Posting-List_2026-08-13.csv \
  --out-dir data/staging/az_roc

python scripts/load_az_roc_via_supabase_rest.py --staging-dir data/staging/az_roc
# or: python scripts/load_az_roc_to_postgres.py --staging-dir data/staging/az_roc
```

## Guardrails

- Evidence only — not a marketplace or lead board
- Missing ≠ unlicensed
- Do not break FL / TX / NJ / OR / CA
