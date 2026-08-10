#!/usr/bin/env python3
"""Run FL DBPR load verification queries and print a compact report."""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    try:
        import psycopg
    except ImportError:
        print("pip install 'psycopg[binary]>=3.1'", file=sys.stderr)
        return 2

    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        host = os.environ.get("PGHOST", "localhost")
        port = os.environ.get("PGPORT", "5432")
        db = os.environ.get("PGDATABASE", "contractor_trust_hub")
        user = os.environ.get("PGUSER", "postgres")
        password = os.environ.get("PGPASSWORD", "")
        url = (
            f"host={host} port={port} dbname={db} user={user} "
            f"connect_timeout={os.environ.get('PGCONNECT_TIMEOUT', '10')}"
        )
        if password:
            url += f" password={password}"
    elif "connect_timeout" not in url:
        sep = "&" if "?" in url else "?"
        if url.startswith("postgres"):
            url = f"{url}{sep}connect_timeout=10"

    queries = [
        (
            "totals",
            """
            SELECT 'contractors' AS t, COUNT(*)::text FROM contractors
            UNION ALL SELECT 'licenses', COUNT(*)::text FROM licenses
            UNION ALL SELECT 'entities', COUNT(*)::text FROM entities
            UNION ALL SELECT 'discipline_actions', COUNT(*)::text FROM discipline_actions
            """,
        ),
        (
            "status",
            """
            SELECT COALESCE(status_normalized, '(null)'), COUNT(*)::text
            FROM licenses GROUP BY 1 ORDER BY COUNT(*) DESC
            """,
        ),
        (
            "top_counties",
            """
            SELECT COALESCE(NULLIF(county_name, ''), county_code, '(unknown)'), COUNT(*)::text
            FROM licenses WHERE state = 'FL'
            GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 10
            """,
        ),
        (
            "sample_active",
            """
            SELECT c.display_name, l.external_key, l.occupation_code, c.primary_city
            FROM licenses l
            JOIN contractors c ON c.id = l.contractor_id
            WHERE l.status_normalized = 'active' AND c.is_thin_profile = FALSE
            ORDER BY l.updated_at DESC NULLS LAST
            LIMIT 10
            """,
        ),
    ]

    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            for label, sql in queries:
                print(f"\n=== {label} ===")
                cur.execute(sql)
                for row in cur.fetchall():
                    print(" | ".join(str(c) for c in row))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
