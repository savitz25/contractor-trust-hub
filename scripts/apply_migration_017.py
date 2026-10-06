#!/usr/bin/env python3
"""Apply 017_contractor_enrichment_observations.sql if the table is absent. Additive only.

Target URL comes from --database-url-env (default DATABASE_URL). A non-local host needs --production.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ingest.env import load_dotenv_files, normalize_database_url  # noqa: E402

MIG = ROOT / "schema" / "migrations" / "017_contractor_enrichment_observations.sql"
TABLE = "contractor_enrichment_observations"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--database-url-env", default="DATABASE_URL")
    ap.add_argument("--production", action="store_true")
    args = ap.parse_args()
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    url = os.environ.get(args.database_url_env)
    if not url:
        print(f"{args.database_url_env} missing", file=sys.stderr)
        return 2
    if (urlparse(url).hostname or "") not in ("localhost", "127.0.0.1", "::1") and not args.production:
        print("refusing non-local target without --production", file=sys.stderr)
        return 2
    import psycopg

    with psycopg.connect(normalize_database_url(url)) as conn:
        conn.execute("SET lock_timeout = '5s'")
        conn.execute("SET statement_timeout = '60s'")
        exists = conn.execute("SELECT to_regclass(%s) IS NOT NULL", (f"public.{TABLE}",)).fetchone()[0]
        print("before", {TABLE: exists})
        if not exists:
            conn.execute(MIG.read_text(encoding="utf-8"))
            conn.commit()
        cols = conn.execute(
            "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = %s", (TABLE,)
        ).fetchone()[0]
        rls = conn.execute("SELECT relrowsecurity FROM pg_class WHERE oid = %s::regclass", (f"public.{TABLE}",)).fetchone()[0]
        grants = conn.execute(
            """SELECT count(*) FROM information_schema.role_table_grants
               WHERE table_name = %s AND grantee IN ('anon', 'authenticated', 'PUBLIC')""", (TABLE,)
        ).fetchone()[0]
        print("after", {"columns": cols, "rls": rls, "public_grants": grants, "applied_now": not exists})
        if cols != 17 or not rls or grants:
            print("017 verification FAILED", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
