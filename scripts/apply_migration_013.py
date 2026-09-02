#!/usr/bin/env python3
"""Apply 013_nj_public_works_sanctions.sql if tables are absent. Additive only."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ingest.env import load_dotenv_files  # noqa: E402

MIG = ROOT / "schema" / "migrations" / "013_nj_public_works_sanctions.sql"
TABLES = ["official_source_snapshots", "official_source_observations", "official_source_occurrences"]


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
        existing = []
        with conn.cursor() as cur:
            for t in TABLES:
                cur.execute("SELECT to_regclass(%s)", (f"public.{t}",))
                existing.append((t, cur.fetchone()[0] is not None))
        print("before", existing)
        if all(e for _, e in existing):
            print("013 already applied")
            return 0
        conn.execute(sql)
        conn.commit()
        print("013 applied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
