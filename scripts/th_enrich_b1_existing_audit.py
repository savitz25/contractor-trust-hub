"""Read-only existing-source audit against the configured Contractor database."""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ingest.env import load_dotenv_files, normalize_database_url
load_dotenv_files(Path.home() / "contractor-trust-hub/.env.local")
url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
result = {"retrieved_at": datetime.now(timezone.utc).isoformat()}
try:
    if not url:
        raise RuntimeError("No configured database URL")
    with psycopg.connect(normalize_database_url(url, connect_timeout="10")) as conn:
        conn.execute("BEGIN READ ONLY")
        result.update({
        "license_source_counts": conn.execute(
            "SELECT source_system, count(*) FROM licenses GROUP BY source_system ORDER BY source_system"
        ).fetchall(),
        "fl_dbpr_board_counts": conn.execute(
            "SELECT source_board, count(*) FROM licenses WHERE source_system='fl_dbpr' GROUP BY source_board ORDER BY source_board"
        ).fetchall(),
        "b1_existing_batches": conn.execute(
            "SELECT source_system,source_dataset,row_count,checksum_sha256 FROM ingest_batches "
            "WHERE source_system IN ('fl_dbpr','nj_dfs','nyc_dob','ny_dol') "
            "ORDER BY extracted_at DESC LIMIT 30"
        ).fetchall(),
        })
        conn.rollback()
    result["live_ownership_verified"] = True
except (psycopg.Error, RuntimeError) as error:
    result["live_ownership_verified"] = False
    result["failure"] = "configured database connection unavailable" if isinstance(error, psycopg.Error) else str(error)
path = ROOT / "docs/TH-ENRICH-2026-09-30-B1-existing-audit.json"
path.write_text(json.dumps(result, indent=2, default=str), encoding="utf-8")
print(json.dumps(result, indent=2, default=str))
