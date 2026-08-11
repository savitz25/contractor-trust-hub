# Florida Sunbiz bulk ingest

Official Florida Division of Corporations entity data via **public SFTP** — no third-party API.

Hub: [Data Downloads](https://dos.fl.gov/sunbiz/other-services/data-downloads/)  
Definitions: [Corporate File Definitions](https://dos.sunbiz.org/data-definitions/cor.html)  
Usage guide: [Data Usage Guide](https://dos.fl.gov/sunbiz/other-services/data-downloads/data-usage-guide/)

## Credentials (public)

| | |
|---|---|
| Host | `sftp.floridados.gov` |
| Username | `Public` |
| Password | `PubAccess1845!` (published by FL DOS; override with `SUNBIZ_SFTP_PASSWORD`) |

These are **state-published public bulk-access credentials**, not product secrets. Prefer env override in automation.

## Remote layout (verified 2026)

| Dataset | Remote path | Notes |
|---------|-------------|--------|
| Quarterly corporate filings | `doc/Quarterly/Cor/cordata.zip` | ~1.8 GB; full snapshot |
| Quarterly corporate events | `doc/Quarterly/Cor/corevent.zip` | ~190 MB |
| Daily corporate filings | `doc/cor/YYYYMMDDc.txt` | Workdays only |
| Daily corporate events | `doc/cor/events/YYYYMMDDce.txt` | Workdays only |

Server directory names are **case-sensitive** (`Quarterly`, `Cor`).

## Corporate data format

- Fixed-width ASCII/Latin-1 text
- **Record length: 1440** characters
- **No header row**
- Unique key: **document number** (corporation number), 6 or 12 characters
- Up to **6 officers** embedded per row; `more_than_six_officers` flag when truncated

Key fields we normalize:

| Field | Positions (1-based) | Maps to `entities` |
|-------|---------------------|--------------------|
| Document number | 1–12 | `external_key` |
| Entity name | 13–204 | `legal_name` |
| Status A/I | 205 | `status` → active/inactive |
| Filing type | 206–220 | `entity_type` (DOMP, FLAL, …) |
| Principal address | 221–344 | `principal_address` + city/state/zip |
| File date | 473–480 | `formation_date` (MMDDYYYY in current extracts; parser also accepts YYYYMMDD) |
| FEI | 481–494 | stored in `raw_payload` / staging column |
| Registered agent | 545–668 | staging columns + payload |
| Officers 1–6 | 669–1436 | `officers_json` / officers staging file |

## Download

```bash
pip install -r ingest/requirements.txt

# List remote dirs
python scripts/download_sunbiz.py --list

# Latest daily corporate filings (default if no flags)
python scripts/download_sunbiz.py --daily-latest

# Specific day
python scripts/download_sunbiz.py --daily 20260809 --daily-events

# Full quarterly snapshot (large)
python scripts/download_sunbiz.py --quarterly
python scripts/download_sunbiz.py --quarterly --events
```

Raw files land under `data/raw/sunbiz/` (**gitignored**). Manifest: `data/raw/sunbiz/download_manifest.json`.

## Parse → staging

```bash
# Daily file
python -m ingest.adapters.fl_sunbiz \
  --input data/raw/sunbiz/daily/20260809c.txt \
  --out-dir data/staging/fl_sunbiz

# Active entities only (smaller product set)
python -m ingest.adapters.fl_sunbiz \
  --input data/raw/sunbiz/daily/20260809c.txt \
  --out-dir data/staging/fl_sunbiz \
  --active-only

# Quarterly zip (streams members; memory-friendly line reader)
python -m ingest.adapters.fl_sunbiz \
  --input data/raw/sunbiz/quarterly/cordata.zip \
  --out-dir data/staging/fl_sunbiz_full
```

Staging outputs:

| File | Purpose |
|------|---------|
| `entities_normalized.csv` | Row-per-entity → `entities` table |
| `officers_normalized.csv` | Flattened officers for search / future linker |
| `batch_manifest.json` | Provenance + counts |

`entities` mapping:

```
source_system   = fl_sunbiz
external_key    = document_number
legal_name      = entity_name
entity_type     = filing_type (FLAL, DOMP, …)
status          = active | inactive
formation_date  = file_date
principal_address / city / state / postal_code
raw_payload     = full field set + officers[]
```

## Postgres load + high-confidence linker

```bash
python -m ingest.adapters.fl_sunbiz \
  --input data/raw/sunbiz/daily --glob '*c.txt' \
  --out-dir data/staging/fl_sunbiz

python scripts/load_sunbiz_to_postgres.py --init-schema \
  --staging-dir data/staging/fl_sunbiz

python scripts/link_dbpr_to_sunbiz.py
python scripts/verify_sunbiz_link.py
```

### Matching rules (implemented — high-confidence only)

| Priority | Method | Confidence | Signal |
|----------|--------|------------|--------|
| 1 | `exact_name_address` | 0.98 | `name_normalized` + address line + ZIP5 |
| 2 | `exact_name_zip5` | 0.95 | `name_normalized` + ZIP5 |
| 3 | `exact_name_city` | 0.92 | `name_normalized` + city |
| 4 | `officer_name_zip` | 0.90 | person + ZIP + city + address (opt-in via `--allow-officer-links`; off by default) |

**Ambiguity rule:** if two different Sunbiz document numbers tie at the best confidence for a contractor, **no link** is written.

Writes to `contractor_entities`:
- `role` = `sunbiz_entity`
- `match_method`, `confidence`, `evidence` (JSONB), `linked_at`

Never invent document numbers. Never overwrite DBPR QB `QB-ENTITY:*` keys — Sunbiz uses `source_system = fl_sunbiz`.

**Coverage note:** Daily filings only cover new/changed records for those days. For full-population matching, download quarterly `cordata.zip` and re-stage/load.

## Relation to DBPR load

1. Load DBPR licenses / QB shells (`scripts/load_fl_dbpr_to_postgres.py`)
2. Download + parse Sunbiz → staging
3. Load Sunbiz entities (`scripts/load_sunbiz_to_postgres.py`)
4. Run high-confidence linker (`scripts/link_dbpr_to_sunbiz.py`)

## Notes from FL DOS

- Quarterly files are huge; use a streaming parser / database, not Excel.
- Rows may occasionally be misaligned (special characters); validate length when strict mode is needed.
- Officer/address fields may lag sunbiz.org due to fixed-width space limits.
