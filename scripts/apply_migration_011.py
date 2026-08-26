#!/usr/bin/env python3
"""Apply 011_enhanced_county_foundation.sql if tables are absent. Additive only."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ingest.env import load_dotenv_files  # noqa: E402

MIG = ROOT / "schema" / "migrations" / "011_enhanced_county_foundation.sql"
TABLES = [
    "enhanced_jurisdictions",
    "local_credentials",
    "local_credential_relations",
    "permit_source_records",
    "permit_lifecycle_events",
    "permit_attributions",
    "public_contact_observations",
    "enhanced_source_files",
]


def main() -> int:
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL missing", file=sys.stderr)
        return 2
    from urllib.parse import quote, urlparse, urlunparse

    parsed = urlparse(url)
    if parsed.password:
        user = quote(parsed.username or "", safe="")
        pw = quote(parsed.password, safe="")
        host = parsed.hostname or ""
        port = f":{parsed.port}" if parsed.port else ""
        url = f"{parsed.scheme}://{user}:{pw}@{host}{port}{parsed.path}"
        if parsed.query:
            url += f"?{parsed.query}"
    import psycopg

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
            print("011 already applied")
            return 0
        conn.execute(sql)
        conn.commit()
        after = []
        with conn.cursor() as cur:
            for t in TABLES:
                cur.execute("SELECT to_regclass(%s)", (f"public.{t}",))
                after.append((t, cur.fetchone()[0] is not None))
                if after[-1][1]:
                    cur.execute(f"SELECT count(*) FROM {t}")
                    n = cur.fetchone()[0]
                    print(f"  {t} exists count={n}")
        print("after", after)
        if not all(e for _, e in after):
            print("apply incomplete", file=sys.stderr)
            return 1
        print("011 applied")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
