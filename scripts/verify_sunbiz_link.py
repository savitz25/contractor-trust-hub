#!/usr/bin/env python3
"""Print Sunbiz load + DBPR link verification report."""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ingest.env import load_dotenv_files, normalize_database_url


def main() -> int:
    try:
        import psycopg
    except ImportError:
        print("pip install 'psycopg[binary]>=3.1'")
        return 2

    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    url = normalize_database_url(os.environ["DATABASE_URL"])

    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            print("\n=== Sunbiz entities ===")
            cur.execute(
                """
                SELECT COUNT(*),
                       COUNT(*) FILTER (WHERE status = 'active'),
                       COUNT(*) FILTER (WHERE officers IS NOT NULL AND officers != '[]'::jsonb)
                FROM entities WHERE source_system = 'fl_sunbiz'
                """
            )
            total, active, with_off = cur.fetchone()
            print(f"total={total} active={active} with_officers={with_off}")

            print("\n=== High-confidence links (role=sunbiz_entity) ===")
            cur.execute(
                """
                SELECT COUNT(*), ROUND(AVG(confidence)::numeric, 3)
                FROM contractor_entities
                WHERE role = 'sunbiz_entity' AND match_method IS NOT NULL
                """
            )
            n, avg = cur.fetchone()
            print(f"links={n} avg_confidence={avg}")

            cur.execute(
                """
                SELECT match_method, COUNT(*), ROUND(AVG(confidence)::numeric, 3)
                FROM contractor_entities
                WHERE role = 'sunbiz_entity' AND match_method IS NOT NULL
                GROUP BY 1 ORDER BY 2 DESC
                """
            )
            print("by_method:")
            for row in cur.fetchall():
                print(f"  {row[0]}: {row[1]} (avg conf {row[2]})")

            print("\n=== Sample links ===")
            cur.execute(
                """
                SELECT c.display_name, e.legal_name, e.external_key, e.status,
                       ce.match_method, ce.confidence, c.primary_city
                FROM contractor_entities ce
                JOIN contractors c ON c.id = ce.contractor_id
                JOIN entities e ON e.id = ce.entity_id
                WHERE ce.role = 'sunbiz_entity'
                ORDER BY ce.confidence DESC NULLS LAST
                LIMIT 12
                """
            )
            for row in cur.fetchall():
                print(" | ".join(str(x) for x in row))

            print("\n=== Coverage ===")
            cur.execute("SELECT COUNT(*) FROM contractors")
            contractors = cur.fetchone()[0]
            print(f"contractors={contractors}")
            print(f"link_rate={ (n or 0) / contractors * 100:.4f}% of contractors")
            if total:
                cur.execute(
                    """
                    SELECT COUNT(DISTINCT entity_id) FROM contractor_entities
                    WHERE role = 'sunbiz_entity'
                    """
                )
                linked_ents = cur.fetchone()[0]
                print(f"sunbiz_entities_linked={linked_ents} ({linked_ents/total*100:.2f}% of loaded sunbiz)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
