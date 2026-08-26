#!/usr/bin/env python3
"""
Reproducible Florida Contractor Intelligence baseline audit.

Reads production/preproduction Postgres and writes a JSON snapshot that
identifies the *entity being counted* at every step.

Usage (from contractor-discovery-001):
  python scripts/audit_florida_intelligence_baseline.py
  python scripts/audit_florida_intelligence_baseline.py --out docs/intelligence/baseline-snapshot.json

Does not modify data.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import UUID

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingest.env import load_dotenv_files, normalize_database_url  # noqa: E402

SOURCE_LIC = "fl_dbpr"
SOURCE_SUNBIZ = "fl_sunbiz"

# Consumer trade buckets — occupation codes are NOT silently merged outside this map.
TRADE_BUCKETS = {
    "general": ["CGC"],
    "building": ["CBC"],
    "residential": ["CRC"],
    "roofing": ["CCC", "RC"],
    "hvac_air_conditioning": ["CAC", "RAC"],
    "plumbing": ["CFC", "RF", "RP"],
    "mechanical": ["CMC"],
    "pool_spa": ["CPC"],
    "underground_utility": ["CUC"],
    "specialty_structure": ["SCC"],
    "solar": ["CSL", "CSA"],
    "qualifier_related": ["QB", "FRO"],
}


def json_default(obj: Any) -> Any:
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, date):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, bytes):
        return obj.decode("utf-8", "replace")
    raise TypeError(f"Unserializable {type(obj)}")


def connect():
    import psycopg
    from psycopg.rows import dict_row

    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    import os

    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise SystemExit("DATABASE_URL is not set")
    dsn = normalize_database_url(url, connect_timeout="30")
    conn = psycopg.connect(dsn, row_factory=dict_row, autocommit=True)
    with conn.cursor() as cur:
        cur.execute("SET statement_timeout = '180s'")
        cur.execute("SET lock_timeout = '15s'")
    return conn


def q(conn, sql: str, params: tuple | list | None = None) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(sql, params or ())
        return list(cur.fetchall())


def q1(conn, sql: str, params: tuple | list | None = None) -> dict[str, Any] | None:
    rows = q(conn, sql, params)
    return rows[0] if rows else None


def scalar(conn, sql: str, params: tuple | list | None = None, key: str = "n") -> int:
    row = q1(conn, sql, params)
    if not row:
        return 0
    val = row.get(key, next(iter(row.values())))
    return int(val or 0)


def run_audit(conn) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    out: dict[str, Any] = {
        "meta": {
            "generated_at": now.isoformat(),
            "as_of": now.date().isoformat(),
            "script": "scripts/audit_florida_intelligence_baseline.py",
            "notes": [
                "Counts identify the entity being counted. License rows are not businesses.",
                "QB rows are not credentials. Discipline rows are not disciplined contractors.",
                "Sunbiz name/city/zip links are not Florida entity-identifier links.",
            ],
        }
    }

    # ------------------------------------------------------------------ schema
    tables = q(
        conn,
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY 1
        """,
    )
    views = q(
        conn,
        """
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = 'public'
        ORDER BY 1
        """,
    )
    columns = q(
        conn,
        """
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN (
            'contractors','licenses','entities','contractor_entities',
            'discipline_actions','ingest_batches','permit_events',
            'permit_records','contractor_permit_activity'
          )
        ORDER BY table_name, ordinal_position
        """,
    )
    out["schema"] = {
        "tables": [r["table_name"] for r in tables],
        "views": [r["table_name"] for r in views],
        "core_columns": columns,
        "has_contact_observations": "contact_observations" in [r["table_name"] for r in tables],
        "has_qualifier_relationships": "qualifier_relationships" in [
            r["table_name"] for r in tables
        ],
        "has_attribution_class": any(
            c["table_name"] == "discipline_actions" and c["column_name"] == "attribution_class"
            for c in columns
        ),
    }

    # ------------------------------------------------------------------ batches
    out["ingest_batches"] = q(
        conn,
        """
        SELECT source_system, source_dataset, source_url, source_file,
               extracted_at, row_count, checksum_sha256, notes, created_at
        FROM ingest_batches
        ORDER BY extracted_at DESC NULLS LAST, created_at DESC
        LIMIT 50
        """,
    )

    # ------------------------------------------------------------------ licenses
    lic = q1(
        conn,
        """
        SELECT
          COUNT(*)::bigint AS credential_rows,
          COUNT(DISTINCT external_key)::bigint AS distinct_external_keys,
          COUNT(DISTINCT license_number)::bigint AS distinct_numeric_cores,
          COUNT(*) FILTER (WHERE status_normalized = 'active')::bigint AS active,
          COUNT(*) FILTER (WHERE status_normalized = 'inactive')::bigint AS inactive,
          COUNT(*) FILTER (WHERE status_normalized = 'current')::bigint AS current_unknown_activity,
          COUNT(*) FILTER (WHERE status_normalized = 'expired')::bigint AS expired,
          COUNT(*) FILTER (WHERE status_normalized = 'suspended')::bigint AS suspended,
          COUNT(*) FILTER (WHERE status_normalized = 'revoked')::bigint AS revoked,
          COUNT(*) FILTER (WHERE status_normalized = 'other')::bigint AS other,
          COUNT(*) FILTER (WHERE status_normalized = 'unknown' OR status_normalized IS NULL)::bigint AS unknown_status,
          COUNT(*) FILTER (WHERE expiration_date IS NOT NULL AND expiration_date < CURRENT_DATE)::bigint AS expiration_in_past,
          COUNT(*) FILTER (WHERE expiration_date IS NOT NULL AND expiration_date >= CURRENT_DATE)::bigint AS expiration_in_future,
          COUNT(*) FILTER (WHERE expiration_date IS NULL)::bigint AS expiration_missing,
          COUNT(*) FILTER (WHERE COALESCE(state,'') IN ('FL',''))::bigint AS state_fl_or_blank,
          COUNT(*) FILTER (WHERE state IS NOT NULL AND state <> 'FL')::bigint AS state_not_fl,
          COUNT(*) FILTER (WHERE NULLIF(TRIM(address_line_1),'') IS NOT NULL)::bigint AS with_address,
          COUNT(*) FILTER (WHERE NULLIF(TRIM(county_code),'') IS NOT NULL)::bigint AS with_county_code,
          COUNT(*) FILTER (WHERE NULLIF(TRIM(county_name),'') IS NOT NULL)::bigint AS with_county_name,
          COUNT(*) FILTER (WHERE NULLIF(TRIM(county_code),'') IS NOT NULL
                           OR NULLIF(TRIM(county_name),'') IS NOT NULL)::bigint AS with_any_county,
          COUNT(*) FILTER (WHERE NULLIF(TRIM(dba_name_raw),'') IS NOT NULL)::bigint AS with_dba,
          COUNT(DISTINCT NULLIF(UPPER(TRIM(licensee_name_raw)),''))::bigint AS distinct_licensee_names,
          COUNT(DISTINCT NULLIF(UPPER(TRIM(dba_name_raw)),''))::bigint AS distinct_dba_names,
          COUNT(DISTINCT contractor_id)::bigint AS distinct_contractor_shells,
          MIN(last_verified_at) AS min_last_verified,
          MAX(last_verified_at) AS max_last_verified,
          MIN(original_licensure_date) AS min_original_licensure,
          MAX(original_licensure_date) AS max_original_licensure
        FROM licenses
        WHERE source_system = %s
        """,
        (SOURCE_LIC,),
    )
    out["licensing"] = {
        "entity_counted": "Florida DBPR construction credential rows (occupation <> QB)",
        "dedup_key": "licenses.(source_system, external_key)",
        "status_rule": (
            "status_normalized from adapter: secondary A→active, I→inactive; "
            "primary C + blank secondary→current (activity unknown); else other/unknown. "
            "Suspended/revoked/expired are NOT separately represented in the licensee extract."
        ),
        **(lic or {}),
        "by_status": q(
            conn,
            """
            SELECT COALESCE(status_normalized,'(null)') AS status_normalized,
                   COUNT(*)::bigint AS n
            FROM licenses WHERE source_system = %s
            GROUP BY 1 ORDER BY n DESC
            """,
            (SOURCE_LIC,),
        ),
        "by_primary_secondary": q(
            conn,
            """
            SELECT COALESCE(primary_status,'(null)') AS primary_status,
                   COALESCE(secondary_status,'(null)') AS secondary_status,
                   COALESCE(status_normalized,'(null)') AS status_normalized,
                   COUNT(*)::bigint AS n
            FROM licenses WHERE source_system = %s
            GROUP BY 1,2,3
            ORDER BY n DESC
            LIMIT 30
            """,
            (SOURCE_LIC,),
        ),
        "numeric_core_collisions": q(
            conn,
            """
            SELECT license_number, COUNT(*)::bigint AS n,
                   COUNT(DISTINCT occupation_code)::bigint AS occupations
            FROM licenses
            WHERE source_system = %s
              AND NULLIF(TRIM(license_number),'') IS NOT NULL
            GROUP BY 1
            HAVING COUNT(*) > 1
            ORDER BY n DESC
            LIMIT 20
            """,
            (SOURCE_LIC,),
        ),
        "numeric_core_collision_count": scalar(
            conn,
            """
            SELECT COUNT(*)::bigint AS n FROM (
              SELECT license_number
              FROM licenses
              WHERE source_system = %s
                AND NULLIF(TRIM(license_number),'') IS NOT NULL
              GROUP BY 1
              HAVING COUNT(*) > 1
            ) s
            """,
            (SOURCE_LIC,),
        ),
        "licenses_per_contractor_shell": q1(
            conn,
            """
            SELECT
              COUNT(*)::bigint AS contractor_shells_with_fl_license,
              COUNT(*) FILTER (WHERE n = 1)::bigint AS shells_with_exactly_one_license,
              COUNT(*) FILTER (WHERE n > 1)::bigint AS shells_with_multiple_licenses,
              MAX(n)::bigint AS max_licenses_on_one_shell
            FROM (
              SELECT contractor_id, COUNT(*)::bigint AS n
              FROM licenses
              WHERE source_system = %s AND contractor_id IS NOT NULL
              GROUP BY 1
            ) s
            """,
            (SOURCE_LIC,),
        ),
    }

    occ = q(
        conn,
        """
        SELECT occupation_code,
               COUNT(*)::bigint AS credential_rows,
               COUNT(*) FILTER (WHERE status_normalized = 'active')::bigint AS active,
               COUNT(*) FILTER (WHERE status_normalized = 'current')::bigint AS current_unknown_activity,
               COUNT(*) FILTER (WHERE status_normalized IN ('active','current'))::bigint AS active_or_current,
               COUNT(DISTINCT contractor_id)::bigint AS distinct_contractor_shells,
               COUNT(DISTINCT NULLIF(UPPER(TRIM(dba_name_raw)),''))::bigint AS distinct_dba_names
        FROM licenses
        WHERE source_system = %s
        GROUP BY 1
        ORDER BY credential_rows DESC
        """,
        (SOURCE_LIC,),
    )
    out["occupations"] = {
        "entity_counted": "credentials by DBPR occupation_code (not merged)",
        "rows": occ,
    }

    buckets = []
    for name, codes in TRADE_BUCKETS.items():
        row = q1(
            conn,
            """
            SELECT
              COUNT(*)::bigint AS credential_rows,
              COUNT(*) FILTER (WHERE status_normalized = 'active')::bigint AS active,
              COUNT(*) FILTER (WHERE status_normalized = 'current')::bigint AS current_unknown_activity,
              COUNT(*) FILTER (WHERE status_normalized IN ('active','current'))::bigint AS active_or_current,
              COUNT(DISTINCT contractor_id)::bigint AS distinct_contractor_shells,
              COUNT(DISTINCT NULLIF(UPPER(TRIM(dba_name_raw)),''))::bigint AS distinct_dba_names
            FROM licenses
            WHERE source_system = %s
              AND UPPER(occupation_code) = ANY(%s)
            """,
            (SOURCE_LIC, codes),
        )
        buckets.append({"bucket": name, "occupation_codes": codes, **(row or {})})
    out["trade_buckets"] = {
        "warning": "Buckets are documented mappings only. Do not treat as official board classes.",
        "rows": buckets,
    }

    # ------------------------------------------------------------------ contractors
    out["contractor_shells"] = q1(
        conn,
        """
        SELECT
          COUNT(*)::bigint AS contractor_rows,
          COUNT(*) FILTER (WHERE home_state = 'FL')::bigint AS home_state_fl,
          COUNT(*) FILTER (WHERE is_thin_profile = FALSE)::bigint AS not_thin,
          COUNT(*) FILTER (WHERE is_thin_profile = TRUE)::bigint AS thin,
          COUNT(*) FILTER (WHERE is_thin_profile = FALSE AND home_state = 'FL')::bigint AS public_fl_shells,
          COUNT(*) FILTER (WHERE NULLIF(TRIM(phone),'') IS NOT NULL)::bigint AS with_phone,
          COUNT(*) FILTER (WHERE NULLIF(TRIM(website),'') IS NOT NULL)::bigint AS with_website,
          COUNT(*) FILTER (WHERE NULLIF(TRIM(dba_name),'') IS NOT NULL)::bigint AS with_dba,
          COUNT(DISTINCT NULLIF(UPPER(TRIM(legal_name)),''))::bigint AS distinct_legal_names,
          COUNT(DISTINCT NULLIF(UPPER(TRIM(display_name)),''))::bigint AS distinct_display_names
        FROM contractors
        """,
    )
    out["contractor_shells_note"] = (
        "A contractor row is a credential-keyed product shell (slug = license key + name), "
        "not a distinct person and not a distinct business. One license → one non-thin shell. "
        "QB rows become thin shells."
    )

    # Approximate person vs business name keys on licenses
    out["name_shape"] = q1(
        conn,
        """
        SELECT
          COUNT(*) FILTER (WHERE licensee_name_raw LIKE '%%,%%')::bigint AS licensee_names_with_comma,
          COUNT(*) FILTER (WHERE licensee_name_raw NOT LIKE '%%,%%')::bigint AS licensee_names_without_comma,
          COUNT(DISTINCT UPPER(TRIM(licensee_name_raw)))
            FILTER (WHERE licensee_name_raw LIKE '%%,%%')::bigint AS distinct_comma_licensee_names,
          COUNT(DISTINCT UPPER(TRIM(licensee_name_raw)))
            FILTER (WHERE licensee_name_raw NOT LIKE '%%,%%')::bigint AS distinct_noncomma_licensee_names
        FROM licenses
        WHERE source_system = %s
        """,
        (SOURCE_LIC,),
    )
    out["name_shape_note"] = (
        "Comma in licensee_name_raw is a heuristic for person LAST, FIRST format. "
        "Not a resolved person identity. Not eligible for public 'distinct persons' metrics."
    )

    people_multi = q1(
        conn,
        """
        SELECT
          COUNT(*)::bigint AS comma_names_with_multiple_credentials,
          COALESCE(MAX(n),0)::bigint AS max_credentials_per_comma_name
        FROM (
          SELECT UPPER(TRIM(licensee_name_raw)) AS k, COUNT(*) AS n
          FROM licenses
          WHERE source_system = %s AND licensee_name_raw LIKE '%%,%%'
          GROUP BY 1
          HAVING COUNT(*) > 1
        ) s
        """,
        (SOURCE_LIC,),
    )
    dba_multi = q1(
        conn,
        """
        SELECT
          COUNT(*)::bigint AS dba_names_with_multiple_credentials,
          COALESCE(MAX(n),0)::bigint AS max_credentials_per_dba
        FROM (
          SELECT UPPER(TRIM(dba_name_raw)) AS k, COUNT(*) AS n
          FROM licenses
          WHERE source_system = %s AND NULLIF(TRIM(dba_name_raw),'') IS NOT NULL
          GROUP BY 1
          HAVING COUNT(*) > 1
        ) s
        """,
        (SOURCE_LIC,),
    )
    out["multi_license_heuristics"] = {
        "persons_with_multiple_licenses_heuristic": people_multi,
        "dba_with_multiple_licenses_heuristic": dba_multi,
        "eligible_for_public": False,
        "reason": "Name-key heuristics, not resolved person/business identity.",
    }

    # ------------------------------------------------------------------ entities / relationships
    out["entities"] = {
        "by_source_type": q(
            conn,
            """
            SELECT source_system, COALESCE(entity_type,'(null)') AS entity_type,
                   COUNT(*)::bigint AS n,
                   COUNT(*) FILTER (WHERE LOWER(COALESCE(status,'')) IN ('active','current'))::bigint AS activeish
            FROM entities
            GROUP BY 1,2
            ORDER BY n DESC
            """,
        ),
        "fl_dbpr_qb": q1(
            conn,
            """
            SELECT
              COUNT(*)::bigint AS qb_entity_rows,
              COUNT(*) FILTER (WHERE LOWER(COALESCE(status,'')) = 'active')::bigint AS status_active,
              COUNT(*) FILTER (WHERE LOWER(COALESCE(status,'')) = 'current')::bigint AS status_current,
              COUNT(*) FILTER (WHERE LOWER(COALESCE(status,'')) = 'inactive')::bigint AS status_inactive,
              COUNT(*) FILTER (WHERE NULLIF(TRIM(fei_number),'') IS NOT NULL)::bigint AS with_fei,
              COUNT(*) FILTER (WHERE NULLIF(TRIM(principal_address),'') IS NOT NULL)::bigint AS with_address,
              COUNT(*) FILTER (WHERE NULLIF(TRIM(county_name),'') IS NOT NULL)::bigint AS with_county_name
            FROM entities
            WHERE source_system = %s
            """,
            (SOURCE_LIC,),
        ),
        "fl_sunbiz": q1(
            conn,
            """
            SELECT
              COUNT(*)::bigint AS sunbiz_entity_rows,
              COUNT(*) FILTER (WHERE LOWER(COALESCE(status,'')) = 'active')::bigint AS active,
              COUNT(*) FILTER (WHERE LOWER(COALESCE(status,'')) = 'inactive')::bigint AS inactive,
              COUNT(*) FILTER (WHERE NULLIF(TRIM(fei_number),'') IS NOT NULL)::bigint AS with_fei,
              COUNT(*) FILTER (WHERE officers IS NOT NULL AND jsonb_typeof(officers)='array'
                               AND jsonb_array_length(officers) > 0)::bigint AS with_officers,
              COUNT(*) FILTER (WHERE NULLIF(TRIM(registered_agent_name),'') IS NOT NULL)::bigint AS with_registered_agent,
              COUNT(*) FILTER (WHERE NULLIF(TRIM(principal_address),'') IS NOT NULL)::bigint AS with_principal_address,
              MIN(last_verified_at) AS min_last_verified,
              MAX(last_verified_at) AS max_last_verified
            FROM entities
            WHERE source_system = %s
            """,
            (SOURCE_SUNBIZ,),
        ),
    }

    out["contractor_entities"] = {
        "by_role_method": q(
            conn,
            """
            SELECT ce.role,
                   COALESCE(ce.match_method,'(null)') AS match_method,
                   COUNT(*)::bigint AS relationship_rows,
                   COUNT(DISTINCT ce.contractor_id)::bigint AS distinct_contractors,
                   COUNT(DISTINCT ce.entity_id)::bigint AS distinct_entities,
                   ROUND(AVG(ce.confidence)::numeric, 3) AS avg_confidence,
                   COUNT(*) FILTER (WHERE ce.confidence >= 0.98)::bigint AS conf_ge_098,
                   COUNT(*) FILTER (WHERE ce.confidence >= 0.95 AND ce.confidence < 0.98)::bigint AS conf_095_098,
                   COUNT(*) FILTER (WHERE ce.confidence >= 0.90 AND ce.confidence < 0.95)::bigint AS conf_090_095,
                   COUNT(*) FILTER (WHERE ce.confidence < 0.90 OR ce.confidence IS NULL)::bigint AS conf_lt_090_or_null
            FROM contractor_entities ce
            GROUP BY 1,2
            ORDER BY relationship_rows DESC
            """,
        ),
        "sunbiz_link_funnel": q1(
            conn,
            """
            WITH fl_shells AS (
              SELECT c.id
              FROM contractors c
              JOIN licenses l ON l.contractor_id = c.id
              WHERE l.source_system = %s AND c.is_thin_profile = FALSE
              GROUP BY c.id
            ),
            links AS (
              SELECT ce.contractor_id, ce.entity_id, ce.match_method, ce.confidence
              FROM contractor_entities ce
              JOIN entities e ON e.id = ce.entity_id
              WHERE ce.role = 'sunbiz_entity' AND e.source_system = %s
            )
            SELECT
              (SELECT COUNT(*) FROM fl_shells)::bigint AS contractor_shells_evaluated,
              (SELECT COUNT(DISTINCT contractor_id) FROM links)::bigint AS shells_with_any_sunbiz_link,
              (SELECT COUNT(DISTINCT contractor_id) FROM links WHERE confidence >= 0.98)::bigint AS confirmed_or_address_match,
              (SELECT COUNT(DISTINCT contractor_id) FROM links WHERE confidence >= 0.95)::bigint AS high_confidence_public_candidate,
              (SELECT COUNT(DISTINCT contractor_id) FROM links WHERE confidence >= 0.90)::bigint AS current_product_public_threshold_090,
              (SELECT COUNT(DISTINCT contractor_id) FROM links
                WHERE confidence >= 0.90 AND confidence < 0.95)::bigint AS review_required_city_or_officer,
              (SELECT COUNT(*) FROM fl_shells s
                WHERE NOT EXISTS (SELECT 1 FROM links l WHERE l.contractor_id = s.id))::bigint AS unresolved_no_link
            """,
            (SOURCE_LIC, SOURCE_SUNBIZ),
        ),
        "qualifier_graph": q1(
            conn,
            """
            SELECT
              COUNT(*) FILTER (WHERE role = 'qualifying_business')::bigint AS qb_self_links,
              COUNT(*) FILTER (WHERE role = 'qualifier')::bigint AS qualifier_role_links,
              COUNT(*) FILTER (WHERE role IN ('officer','dba'))::bigint AS officer_or_dba_links,
              COUNT(*) FILTER (WHERE role = 'sunbiz_entity')::bigint AS sunbiz_links
            FROM contractor_entities
            """,
        ),
    }
    out["qualifier_graph_note"] = (
        "There is no first-class PERSON/QUALIFIER → LICENSE → QUALIFIES → BUSINESS graph. "
        "QB extract rows become entities + thin contractor shells linked to themselves "
        "(role=qualifying_business, confidence=1.0). They are not joined to the individual "
        "license credentials that qualify the business. Current vs historical qualifier "
        "windows, start/end dates, and multi-qualifier businesses are not represented."
    )

    # ------------------------------------------------------------------ geography
    out["geography"] = {
        "rule": (
            "License mailing/principal address county is BASE/HEADQUARTERS county. "
            "Permit/activity county (when present) is OPERATING county. "
            "Statewide credential totals MUST NOT equal the sum of county operating totals. "
            "A contractor may operate in multiple counties."
        ),
        "by_county_name": q(
            conn,
            """
            SELECT COALESCE(NULLIF(TRIM(county_name),''),'(blank)') AS county_name,
                   COUNT(*)::bigint AS credential_rows,
                   COUNT(*) FILTER (WHERE status_normalized IN ('active','current'))::bigint AS active_or_current,
                   COUNT(DISTINCT contractor_id)::bigint AS contractor_shells
            FROM licenses
            WHERE source_system = %s
            GROUP BY 1
            ORDER BY credential_rows DESC
            LIMIT 80
            """,
            (SOURCE_LIC,),
        ),
        "by_county_code": q(
            conn,
            """
            SELECT COALESCE(NULLIF(TRIM(county_code),''),'(blank)') AS county_code,
                   MAX(NULLIF(TRIM(county_name),'')) AS sample_county_name,
                   COUNT(*)::bigint AS credential_rows,
                   COUNT(*) FILTER (WHERE NULLIF(TRIM(county_name),'') IS NOT NULL)::bigint AS with_name,
                   COUNT(*) FILTER (WHERE NULLIF(TRIM(county_name),'') IS NULL)::bigint AS name_missing
            FROM licenses
            WHERE source_system = %s
            GROUP BY 1
            ORDER BY credential_rows DESC
            """,
            (SOURCE_LIC,),
        ),
        "code_to_name_observed": q(
            conn,
            """
            SELECT TRIM(county_code) AS county_code,
                   TRIM(county_name) AS county_name,
                   COUNT(*)::bigint AS n
            FROM licenses
            WHERE source_system = %s
              AND NULLIF(TRIM(county_code),'') IS NOT NULL
              AND NULLIF(TRIM(county_name),'') IS NOT NULL
            GROUP BY 1,2
            ORDER BY n DESC
            """,
            (SOURCE_LIC,),
        ),
        "out_of_state_mailing": q(
            conn,
            """
            SELECT COALESCE(state,'(null)') AS state, COUNT(*)::bigint AS n
            FROM licenses
            WHERE source_system = %s
            GROUP BY 1
            ORDER BY n DESC
            """,
            (SOURCE_LIC,),
        ),
        "permit_event_rows": (
            scalar(conn, "SELECT COUNT(*)::bigint AS n FROM permit_events")
            if "permit_events" in out["schema"]["tables"]
            else None
        ),
        "permit_records": None,
    }

    if "permit_records" in out["schema"]["tables"]:
        out["geography"]["permit_records"] = q1(
            conn,
            """
            SELECT COUNT(*)::bigint AS n,
                   COUNT(*) FILTER (WHERE contractor_license_key IS NOT NULL)::bigint AS with_license_key,
                   COUNT(DISTINCT jurisdiction_slug)::bigint AS jurisdictions
            FROM permit_records
            """,
        )

    # ------------------------------------------------------------------ discipline
    out["discipline"] = {
        "funnel": q1(
            conn,
            """
            SELECT
              COUNT(*)::bigint AS raw_rows_loaded,
              COUNT(*) FILTER (WHERE source_dataset = 'contractor_disc_lic')::bigint AS licensed_discipline_dataset,
              COUNT(*) FILTER (WHERE source_dataset ILIKE '%%ula%%')::bigint AS ula_dataset,
              COUNT(*) FILTER (WHERE source_dataset ILIKE '%%rf%%'
                               OR source_dataset ILIKE '%%recovery%%')::bigint AS recovery_fund_dataset,
              COUNT(*) FILTER (WHERE NULLIF(TRIM(license_number_raw),'') IS NOT NULL)::bigint AS with_license_identifier,
              COUNT(*) FILTER (WHERE license_id IS NOT NULL)::bigint AS matched_to_license_id,
              COUNT(*) FILTER (WHERE contractor_id IS NOT NULL)::bigint AS attributed_to_contractor_shell,
              COUNT(*) FILTER (WHERE license_id IS NULL)::bigint AS unmatched_license,
              COUNT(*) FILTER (WHERE contractor_id IS NULL)::bigint AS unattributed_contractor,
              COUNT(DISTINCT license_id) FILTER (WHERE license_id IS NOT NULL)::bigint AS distinct_attributed_licenses,
              COUNT(DISTINCT contractor_id) FILTER (WHERE contractor_id IS NOT NULL)::bigint AS distinct_attributed_contractor_shells,
              COUNT(DISTINCT complaint_number)::bigint AS distinct_complaint_numbers,
              COUNT(*) FILTER (WHERE COALESCE(disposition_date, entered_date) >= CURRENT_DATE - INTERVAL '12 months')::bigint AS rows_last_12m,
              COUNT(*) FILTER (WHERE COALESCE(disposition_date, entered_date) >= CURRENT_DATE - INTERVAL '3 years')::bigint AS rows_last_3y,
              COUNT(*) FILTER (WHERE COALESCE(disposition_date, entered_date) >= CURRENT_DATE - INTERVAL '5 years')::bigint AS rows_last_5y,
              MIN(entered_date) AS min_entered,
              MAX(entered_date) AS max_entered,
              MIN(disposition_date) AS min_disposition,
              MAX(disposition_date) AS max_disposition,
              MIN(last_verified_at) AS min_last_verified,
              MAX(last_verified_at) AS max_last_verified
            FROM discipline_actions
            WHERE source_system = %s
            """,
            (SOURCE_LIC,),
        ),
        "by_dataset": q(
            conn,
            """
            SELECT source_dataset, COUNT(*)::bigint AS n,
                   COUNT(*) FILTER (WHERE license_id IS NOT NULL)::bigint AS matched,
                   COUNT(DISTINCT complaint_number)::bigint AS complaints
            FROM discipline_actions
            WHERE source_system = %s
            GROUP BY 1 ORDER BY n DESC
            """,
            (SOURCE_LIC,),
        ),
        "by_disposition": q(
            conn,
            """
            SELECT COALESCE(NULLIF(TRIM(disposition),''),'(blank)') AS disposition,
                   COUNT(*)::bigint AS action_rows,
                   COUNT(DISTINCT complaint_number)::bigint AS distinct_complaints
            FROM discipline_actions
            WHERE source_system = %s
            GROUP BY 1 ORDER BY action_rows DESC
            """,
            (SOURCE_LIC,),
        ),
        "by_classification": q(
            conn,
            """
            SELECT COALESCE(NULLIF(TRIM(classification),''),'(blank)') AS classification,
                   COUNT(*)::bigint AS n
            FROM discipline_actions
            WHERE source_system = %s
            GROUP BY 1 ORDER BY n DESC
            """,
            (SOURCE_LIC,),
        ),
        "attributed_active_shells": scalar(
            conn,
            """
            SELECT COUNT(DISTINCT l.contractor_id)::bigint AS n
            FROM discipline_actions d
            JOIN licenses l ON l.id = d.license_id
            WHERE d.source_system = %s
              AND d.license_id IS NOT NULL
              AND l.status_normalized IN ('active','current')
            """,
            (SOURCE_LIC,),
        ),
        "ambiguous_numeric_matches": q1(
            conn,
            """
            WITH attributed AS (
              SELECT d.id, d.license_number_raw, d.license_id, l.occupation_code, l.external_key
              FROM discipline_actions d
              JOIN licenses l ON l.id = d.license_id
              WHERE d.source_system = %s AND d.license_id IS NOT NULL
            ),
            collisions AS (
              SELECT l.license_number
              FROM licenses l
              WHERE l.source_system = %s
                AND NULLIF(TRIM(l.license_number),'') IS NOT NULL
              GROUP BY 1
              HAVING COUNT(*) > 1
            )
            SELECT
              COUNT(*) FILTER (
                WHERE EXISTS (
                  SELECT 1 FROM collisions c
                  WHERE c.license_number = attributed.license_number_raw
                     OR TRIM(LEADING '0' FROM c.license_number)
                        = TRIM(LEADING '0' FROM attributed.license_number_raw)
                )
              )::bigint AS attributed_rows_on_colliding_numeric_core
            FROM attributed
            """,
            (SOURCE_LIC, SOURCE_LIC),
        ),
    }

    out["missing_source_families"] = {
        "dbpr_unlicensed_activity": "Not loaded. No source_dataset matching ula in discipline_actions.",
        "homeowners_construction_recovery_fund": "Not loaded. No recovery-fund dataset in discipline_actions.",
        "dfs_workers_compensation_stop_work": "No table or ingest adapter present.",
        "business_contact_observations": "No contact_observations table. contractors.phone/website unused by FL DBPR adapter (extract has no email/phone).",
    }

    # ------------------------------------------------------------------ contacts
    out["contacts"] = q1(
        conn,
        """
        SELECT
          COUNT(*) FILTER (WHERE NULLIF(TRIM(phone),'') IS NOT NULL)::bigint AS contractor_phone_populated,
          COUNT(*) FILTER (WHERE NULLIF(TRIM(website),'') IS NOT NULL)::bigint AS contractor_website_populated,
          COUNT(*) FILTER (WHERE is_thin_profile = FALSE AND home_state = 'FL'
                           AND NULLIF(TRIM(phone),'') IS NOT NULL)::bigint AS fl_public_shells_with_phone,
          COUNT(*) FILTER (WHERE is_thin_profile = FALSE AND home_state = 'FL'
                           AND NULLIF(TRIM(website),'') IS NOT NULL)::bigint AS fl_public_shells_with_website
        FROM contractors
        """,
    )

    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Florida intelligence baseline audit")
    parser.add_argument(
        "--out",
        type=Path,
        default=ROOT / "docs" / "intelligence" / "baseline-snapshot.json",
    )
    args = parser.parse_args(argv)
    args.out.parent.mkdir(parents=True, exist_ok=True)

    conn = connect()
    try:
        snapshot = run_audit(conn)
    finally:
        conn.close()

    args.out.write_text(json.dumps(snapshot, indent=2, default=json_default), encoding="utf-8")
    print(f"Wrote {args.out}")
    lic = snapshot.get("licensing", {})
    print(
        json.dumps(
            {
                "as_of": snapshot["meta"]["as_of"],
                "fl_dbpr_credential_rows": lic.get("credential_rows"),
                "active": lic.get("active"),
                "inactive": lic.get("inactive"),
                "current_unknown_activity": lic.get("current_unknown_activity"),
                "contractor_shells": snapshot.get("contractor_shells"),
                "sunbiz_link_funnel": snapshot.get("contractor_entities", {}).get(
                    "sunbiz_link_funnel"
                ),
                "discipline_funnel": snapshot.get("discipline", {}).get("funnel"),
            },
            indent=2,
            default=json_default,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
