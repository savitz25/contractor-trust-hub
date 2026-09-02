#!/usr/bin/env python3
"""Apply 015_nj_statewide_permit_intelligence.sql if columns are absent. Additive only."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ingest.env import load_dotenv_files  # noqa: E402

MIG = ROOT / "schema" / "migrations" / "015_nj_statewide_permit_intelligence.sql"


def main() -> int:
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL missing", file=sys.stderr)
        return 2
    import psycopg
    from ingest.env import normalize_database_url

    url = normalize_database_url(url)
    sql = MIG.read_text(encoding="utf-8")
    with psycopg.connect(url) as conn:
        conn.execute("SET lock_timeout = '5s'")
        conn.execute("SET statement_timeout = '60s'")
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'permit_source_records'
                  AND column_name = 'source_record_key'
                """
            )
            has_key = cur.fetchone() is not None
        print("before", {"source_record_key": has_key})
        if has_key:
            print("015 already applied")
            return 0
        conn.execute(sql)
        conn.commit()
        print("015 applied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
