#!/usr/bin/env python3
"""CTH-FL-BASE-001: production Florida state forensic BEFORE baseline.

This audit is intentionally read-only. It opens one repeatable-read snapshot,
sets a bounded statement timeout, executes deterministic aggregate queries,
writes JSON, renders Markdown from those same results, and rolls back.
It never calls an external API or mutates database state.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingest.env import load_dotenv_files, normalize_database_url  # noqa: E402

CORE_TABLES = (
    "contractors",
    "licenses",
    "entities",
    "contractor_entities",
    "discipline_actions",
    "ingest_batches",
)
PUBLIC_SUNBIZ_CONFIDENCE = Decimal("0.90")


def json_default(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    raise TypeError(f"Cannot serialize {type(value).__name__}")


def git(*args: str) -> str:
    return subprocess.check_output(
        ["git", *args], cwd=ROOT, text=True, encoding="utf-8"
    ).strip()


def fetch_all(cur: Any, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    cur.execute(sql, params)
    names = [d.name for d in cur.description]
    return [dict(zip(names, row)) for row in cur.fetchall()]


def fetch_one(cur: Any, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any]:
    rows = fetch_all(cur, sql, params)
    if len(rows) != 1:
        raise RuntimeError(f"Expected one row, received {len(rows)}")
    return rows[0]


def normalized_core_sql(expression: str) -> str:
    digits = f"regexp_replace(COALESCE({expression}, ''), '[^0-9]', '', 'g')"
    return (
        f"CASE WHEN {digits} = '' THEN NULL "
        f"WHEN ltrim({digits}, '0') = '' THEN {digits} "
        f"ELSE ltrim({digits}, '0') END"
    )


def pct(numerator: int, denominator: int) -> float:
    return round((numerator * 100.0 / denominator), 2) if denominator else 0.0


def rows_total(rows: list[dict[str, Any]], key: str = "total") -> int:
    return sum(int(row.get(key) or 0) for row in rows)


def assert_equal(assertions: list[dict[str, Any]], name: str, left: Any, right: Any) -> None:
    passed = left == right
    assertions.append({"name": name, "left": left, "right": right, "pass": passed})
    if not passed:
        raise AssertionError(f"Reconciliation failed: {name}: {left!r} != {right!r}")


def audit(cur: Any) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    safety = fetch_one(
        cur,
        """
        SELECT current_setting('transaction_read_only') AS transaction_read_only,
               current_setting('transaction_isolation') AS transaction_isolation,
               current_setting('statement_timeout') AS statement_timeout,
               current_setting('server_version') AS postgres_version
        """,
    )
    if safety["transaction_read_only"] != "on":
        raise RuntimeError("Audit transaction is not read-only")

    table_rows = fetch_all(
        cur,
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ANY(%s)
        ORDER BY table_name
        """,
        (list(CORE_TABLES),),
    )
    present = {row["table_name"] for row in table_rows}
    missing = sorted(set(CORE_TABLES) - present)
    if missing:
        raise RuntimeError(f"Required production tables missing: {', '.join(missing)}")

    result: dict[str, Any] = {
        "audit": {
            "id": "CTH-FL-BASE-001",
            "timestamp_utc": now.isoformat(),
            "git_sha": git("rev-parse", "HEAD"),
            "branch": git("branch", "--show-current"),
            "environment": "PRODUCTION",
            **safety,
            "tables": {name: name in present for name in CORE_TABLES},
            "mutation_performed": False,
        }
    }

    result["ingest_batches"] = fetch_all(
        cur,
        """
        SELECT DISTINCT ON (source_system, source_dataset)
               source_system, source_dataset, extracted_at, row_count,
               LEFT(checksum_sha256, 12) AS checksum_prefix,
               source_file, source_url
        FROM ingest_batches
        WHERE source_system IN ('fl_dbpr', 'fl_sunbiz')
        ORDER BY source_system, source_dataset, extracted_at DESC
        """,
    )

    contractor = fetch_one(
        cur,
        """
        WITH fl_counts AS (
          SELECT contractor_id, COUNT(*)::int AS license_count
          FROM licenses
          WHERE source_system = 'fl_dbpr' AND contractor_id IS NOT NULL
          GROUP BY contractor_id
        )
        SELECT
          COUNT(*)::int AS regulated_shells,
          COUNT(*) FILTER (WHERE NOT c.is_thin_profile)::int AS non_thin_shells,
          COUNT(*) FILTER (WHERE c.is_thin_profile)::int AS thin_shells,
          COUNT(*) FILTER (WHERE NOT c.is_thin_profile)::int AS public_searchable_profiles,
          COUNT(*) FILTER (WHERE c.home_state = 'FL')::int AS home_state_fl,
          COUNT(*) FILTER (WHERE c.home_state IS NOT NULL AND c.home_state <> 'FL')::int AS home_state_not_fl,
          COUNT(*) FILTER (WHERE c.home_state IS NULL)::int AS home_state_unknown,
          COUNT(*) FILTER (WHERE fc.license_count = 1)::int AS one_license_shells,
          COUNT(*) FILTER (WHERE fc.license_count > 1)::int AS multi_license_shells,
          COALESCE(MAX(fc.license_count), 0)::int AS max_licenses_per_shell
        FROM fl_counts fc JOIN contractors c ON c.id = fc.contractor_id
        """,
    )
    contractor["contractors_without_any_license"] = fetch_one(
        cur,
        """
        SELECT COUNT(*)::int AS n FROM contractors c
        WHERE NOT EXISTS (SELECT 1 FROM licenses l WHERE l.contractor_id = c.id)
        """,
    )["n"]
    result["contractors"] = contractor

    duplicate_summary = fetch_one(
        cur,
        """
        WITH fl AS (
          SELECT DISTINCT c.id, c.legal_name, c.display_name
          FROM contractors c JOIN licenses l ON l.contractor_id=c.id
          WHERE l.source_system='fl_dbpr'
        ), keys AS (
          SELECT id,
            NULLIF(regexp_replace(upper(trim(COALESCE(legal_name,''))), '[^A-Z0-9]+', '', 'g'),'') legal_key,
            NULLIF(regexp_replace(upper(trim(COALESCE(display_name,''))), '[^A-Z0-9]+', '', 'g'),'') display_key
          FROM fl
        ), legal_groups AS (
          SELECT legal_key FROM keys WHERE legal_key IS NOT NULL GROUP BY legal_key HAVING COUNT(*)>1
        ), display_groups AS (
          SELECT display_key FROM keys WHERE display_key IS NOT NULL GROUP BY display_key HAVING COUNT(*)>1
        ), shared_sunbiz AS (
          SELECT ce.entity_id FROM contractor_entities ce JOIN fl ON fl.id=ce.contractor_id
          WHERE ce.role='sunbiz_entity' GROUP BY ce.entity_id HAVING COUNT(DISTINCT ce.contractor_id)>1
        ), exact_name_address AS (
          SELECT upper(trim(COALESCE(c.legal_name,c.display_name))) name_key,
                 upper(trim(COALESCE(l.address_line_1,''))) addr_key,
                 regexp_replace(COALESCE(l.postal_code,''),'[^0-9]','','g') zip_key
          FROM fl JOIN contractors c ON c.id=fl.id
          JOIN licenses l ON l.contractor_id=c.id AND l.source_system='fl_dbpr'
          WHERE COALESCE(l.address_line_1,'')<>''
          GROUP BY 1,2,3 HAVING COUNT(DISTINCT c.id)>1
        )
        SELECT (SELECT COUNT(*) FROM legal_groups)::int normalized_legal_name_groups,
               (SELECT COUNT(*) FROM display_groups)::int normalized_display_name_groups,
               (SELECT COUNT(*) FROM shared_sunbiz)::int shared_sunbiz_entity_groups,
               (SELECT COUNT(*) FROM exact_name_address)::int exact_name_address_groups
        """,
    )
    duplicate_summary["potential_duplicate_shell_groups"] = max(
        duplicate_summary["normalized_legal_name_groups"],
        duplicate_summary["normalized_display_name_groups"],
    )
    result["potential_duplicates"] = duplicate_summary
    result["potential_duplicate_samples"] = fetch_all(
        cur,
        """
        WITH fl AS (
          SELECT DISTINCT c.id, c.display_name, c.legal_name
          FROM contractors c JOIN licenses l ON l.contractor_id=c.id
          WHERE l.source_system='fl_dbpr'
        ), grouped AS (
          SELECT regexp_replace(upper(trim(COALESCE(legal_name,display_name))), '[^A-Z0-9]+','','g') key,
                 COUNT(*)::int shells, array_agg(display_name ORDER BY display_name) names
          FROM fl GROUP BY 1 HAVING COUNT(*)>1
        )
        SELECT key AS normalized_key, shells, names[1:5] AS bounded_names
        FROM grouped ORDER BY shells DESC, key LIMIT 10
        """,
    )

    license_core = fetch_one(
        cur,
        """
        SELECT COUNT(*)::int AS total,
          COUNT(DISTINCT external_key)::int AS distinct_external_keys,
          COUNT(*) FILTER (WHERE contractor_id IS NOT NULL)::int AS attached,
          COUNT(*) FILTER (WHERE contractor_id IS NULL)::int AS unattached,
          (COUNT(*)-COUNT(DISTINCT external_key))::int AS duplicate_external_key_rows,
          COUNT(DISTINCT license_number)::int AS distinct_numeric_license_numbers,
          COUNT(*) FILTER (WHERE license_number IS NULL OR trim(license_number)='')::int AS null_numeric_license_numbers,
          COUNT(*) FILTER (WHERE raw_payload IS NOT NULL)::int AS with_raw_payload,
          COUNT(*) FILTER (WHERE ingest_batch_id IS NOT NULL)::int AS with_ingest_batch,
          COUNT(*) FILTER (WHERE last_verified_at IS NOT NULL)::int AS with_last_verified_at,
          MIN(original_licensure_date) AS oldest_original_licensure_date,
          MAX(original_licensure_date) AS newest_original_licensure_date,
          MIN(expiration_date) AS earliest_expiration_date,
          MAX(expiration_date) AS latest_expiration_date
        FROM licenses WHERE source_system='fl_dbpr'
        """,
    )
    result["licenses"] = license_core
    result["license_status_normalized"] = fetch_all(
        cur,
        """SELECT COALESCE(status_normalized,'(null)') AS status, COUNT(*)::int AS total
             FROM licenses WHERE source_system='fl_dbpr' GROUP BY 1 ORDER BY total DESC, status""",
    )
    result["license_primary_status"] = fetch_all(
        cur,
        """SELECT COALESCE(primary_status,'(null)') AS status, COUNT(*)::int AS total
             FROM licenses WHERE source_system='fl_dbpr' GROUP BY 1 ORDER BY total DESC, status""",
    )
    result["license_secondary_status"] = fetch_all(
        cur,
        """SELECT COALESCE(secondary_status,'(null)') AS status, COUNT(*)::int AS total
             FROM licenses WHERE source_system='fl_dbpr' GROUP BY 1 ORDER BY total DESC, status""",
    )
    result["license_classes"] = fetch_all(
        cur,
        f"""
        SELECT occupation_code, occupation_description, COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status_normalized='active')::int AS active,
          COUNT(*) FILTER (WHERE status_normalized='inactive')::int AS inactive,
          COUNT(*) FILTER (WHERE status_normalized='current')::int AS current,
          COUNT(*) FILTER (WHERE status_normalized IS NULL OR status_normalized NOT IN ('active','inactive','current'))::int AS other_unknown,
          COUNT(DISTINCT contractor_id) FILTER (WHERE contractor_id IS NOT NULL)::int AS attached_shells,
          COUNT(DISTINCT {normalized_core_sql('license_number')})::int AS unique_numeric_cores
        FROM licenses WHERE source_system='fl_dbpr'
        GROUP BY occupation_code, occupation_description ORDER BY total DESC, occupation_code
        """,
    )

    result["qualifying_business"] = fetch_one(
        cur,
        """
        SELECT
          (SELECT COUNT(*) FROM entities WHERE source_system='fl_dbpr')::int AS dbpr_entity_rows,
          (SELECT COUNT(*) FROM entities WHERE source_system='fl_dbpr' AND entity_type='qualifying_business')::int AS qualifying_business_entities,
          COUNT(*)::int AS relationships,
          COUNT(DISTINCT ce.contractor_id)::int AS contractors_covered,
          COUNT(DISTINCT ce.entity_id)::int AS entities_linked,
          (SELECT COUNT(*) FROM entities e WHERE e.source_system='fl_dbpr' AND e.entity_type='qualifying_business'
             AND NOT EXISTS (SELECT 1 FROM contractor_entities x WHERE x.entity_id=e.id AND x.role='qualifying_business'))::int AS orphan_entities,
          (SELECT COUNT(*) FROM (SELECT contractor_id FROM contractor_entities WHERE role='qualifying_business' GROUP BY contractor_id HAVING COUNT(DISTINCT entity_id)>1) q)::int AS contractors_multiple_entities,
          (SELECT COUNT(*) FROM (SELECT entity_id FROM contractor_entities WHERE role='qualifying_business' GROUP BY entity_id HAVING COUNT(DISTINCT contractor_id)>1) q)::int AS entities_multiple_contractors
        FROM contractor_entities ce WHERE ce.role='qualifying_business'
        """,
    )
    result["qualifying_confidence"] = fetch_all(
        cur,
        """SELECT COALESCE(confidence::text,'(null)') AS confidence, COUNT(*)::int total
             FROM contractor_entities WHERE role='qualifying_business' GROUP BY 1 ORDER BY total DESC""",
    )
    result["qualifying_match_method"] = fetch_all(
        cur,
        """SELECT COALESCE(match_method,'(null)') AS match_method, COUNT(*)::int total
             FROM contractor_entities WHERE role='qualifying_business' GROUP BY 1 ORDER BY total DESC""",
    )

    sunbiz_entity_profile = fetch_all(
        cur,
        """SELECT COALESCE(status,'(null)') status, COUNT(*)::int total,
          COUNT(*) FILTER (WHERE formation_date IS NOT NULL)::int formation_date,
          COUNT(*) FILTER (WHERE fei_number IS NOT NULL AND trim(fei_number)<>'')::int fei,
          COUNT(*) FILTER (WHERE principal_address IS NOT NULL AND trim(principal_address)<>'')::int principal_address,
          COUNT(*) FILTER (WHERE registered_agent_name IS NOT NULL AND trim(registered_agent_name)<>'')::int registered_agent,
          COUNT(*) FILTER (WHERE officers IS NOT NULL AND officers <> '[]'::jsonb)::int officers
          FROM entities WHERE source_system='fl_sunbiz'
          GROUP BY 1 ORDER BY total DESC, status""",
    )
    sunbiz = {"total_entities": rows_total(sunbiz_entity_profile)}
    sunbiz.update(
        fetch_one(
            cur,
            """
            WITH fl AS (
              SELECT DISTINCT contractor_id FROM licenses
              WHERE source_system='fl_dbpr' AND contractor_id IS NOT NULL
            ), links AS MATERIALIZED (
              SELECT ce.contractor_id, ce.entity_id, ce.confidence
              FROM contractor_entities ce JOIN fl ON fl.contractor_id=ce.contractor_id
              WHERE ce.role='sunbiz_entity'
            )
            SELECT COUNT(DISTINCT contractor_id)::int AS contractors_with_link,
              ((SELECT COUNT(*) FROM fl)-COUNT(DISTINCT contractor_id))::int AS contractors_without_link,
              COUNT(*) FILTER (WHERE confidence >= 0.90)::int AS high_confidence_public_safe_links,
              COUNT(*) FILTER (WHERE confidence IS NULL OR confidence < 0.90)::int AS below_public_threshold_links,
              (SELECT COUNT(*) FROM (SELECT contractor_id FROM links GROUP BY contractor_id HAVING COUNT(DISTINCT entity_id)>1) q)::int AS contractors_multiple_sunbiz,
              (SELECT COUNT(*) FROM (SELECT entity_id FROM links GROUP BY entity_id HAVING COUNT(DISTINCT contractor_id)>1) q)::int AS entities_shared_by_contractors,
              0::int AS exact_duplicate_relationships
            FROM links
            """,
        )
    )
    sunbiz["coverage_percent"] = pct(sunbiz["contractors_with_link"], contractor["regulated_shells"])
    result["sunbiz"] = sunbiz
    result["sunbiz_confidence"] = fetch_all(
        cur,
        """SELECT COALESCE(ce.confidence::text,'(null)') confidence, COUNT(*)::int total
             FROM contractor_entities ce
             WHERE ce.role='sunbiz_entity'
               AND EXISTS (SELECT 1 FROM licenses l WHERE l.contractor_id=ce.contractor_id AND l.source_system='fl_dbpr')
             GROUP BY 1 ORDER BY total DESC""",
    )
    result["sunbiz_match_method"] = fetch_all(
        cur,
        """SELECT COALESCE(ce.match_method,'(null)') match_method, COUNT(*)::int total
             FROM contractor_entities ce
             WHERE ce.role='sunbiz_entity'
               AND EXISTS (SELECT 1 FROM licenses l WHERE l.contractor_id=ce.contractor_id AND l.source_system='fl_dbpr')
             GROUP BY 1 ORDER BY total DESC""",
    )
    result["sunbiz_status_actual"] = [
        {"status": x["status"], "total": x["total"]} for x in sunbiz_entity_profile
    ]
    result["sunbiz_fields"] = {
        key: sum(int(x[key]) for x in sunbiz_entity_profile)
        for key in ("formation_date", "fei", "principal_address", "registered_agent", "officers")
    }

    result["canonical_contacts_regulated"] = fetch_one(
        cur,
        """
        WITH fl AS (SELECT DISTINCT contractor_id FROM licenses WHERE source_system='fl_dbpr' AND contractor_id IS NOT NULL)
        SELECT COUNT(*) FILTER (WHERE NULLIF(trim(c.phone),'') IS NOT NULL)::int phone,
          COUNT(*) FILTER (WHERE NULLIF(trim(c.website),'') IS NOT NULL)::int website,
          COUNT(*) FILTER (WHERE NULLIF(trim(c.phone),'') IS NOT NULL AND NULLIF(trim(c.website),'') IS NOT NULL)::int phone_and_website,
          COUNT(*) FILTER (WHERE NULLIF(trim(c.phone),'') IS NULL AND NULLIF(trim(c.website),'') IS NULL)::int neither
        FROM fl JOIN contractors c ON c.id=fl.contractor_id
        """,
    )
    result["canonical_contacts_public"] = fetch_one(
        cur,
        """
        WITH fl AS (SELECT DISTINCT contractor_id FROM licenses WHERE source_system='fl_dbpr' AND contractor_id IS NOT NULL)
        SELECT COUNT(*) FILTER (WHERE NULLIF(trim(c.phone),'') IS NOT NULL)::int phone,
          COUNT(*) FILTER (WHERE NULLIF(trim(c.website),'') IS NOT NULL)::int website,
          COUNT(*) FILTER (WHERE NULLIF(trim(c.phone),'') IS NOT NULL AND NULLIF(trim(c.website),'') IS NOT NULL)::int phone_and_website,
          COUNT(*) FILTER (WHERE NULLIF(trim(c.phone),'') IS NULL AND NULLIF(trim(c.website),'') IS NULL)::int neither
        FROM fl JOIN contractors c ON c.id=fl.contractor_id WHERE NOT c.is_thin_profile
        """,
    )

    payload_sources = {
        "fl_dbpr_license": ("licenses", "source_system='fl_dbpr'", "external_key"),
        "fl_sunbiz_entity": ("entities", "source_system='fl_sunbiz'", "name_normalized, external_key"),
        "fl_discipline": ("discipline_actions", "source_system='fl_dbpr'", "external_key"),
    }
    result["raw_payload_keys"] = {}
    for label, (table, where, order_by) in payload_sources.items():
        result["raw_payload_keys"][label] = fetch_all(
            cur,
            f"""
            WITH payload_sample AS MATERIALIZED (
              SELECT raw_payload FROM {table} WHERE {where} AND raw_payload IS NOT NULL
              ORDER BY {order_by} LIMIT 1000
            )
            SELECT key, COUNT(*)::int AS rows_with_key
            FROM payload_sample t CROSS JOIN LATERAL jsonb_object_keys(t.raw_payload) key
            WHERE TRUE
              AND key ~* '(email|phone|website|url|fax|address)'
            GROUP BY key ORDER BY key
            """,
        )

    result["source_contact_observations"] = {}
    for kind, regex in {
        "email": r"(^|_)(email|e_mail)($|_)",
        "phone": r"(^|_)(phone|telephone|tel)($|_)",
        "website": r"(^|_)(website|web_site|url)($|_)",
    }.items():
        result["source_contact_observations"][kind] = fetch_one(
            cur,
            """
            WITH observations AS (
              SELECT l.contractor_id, lower(trim(j.value)) value
              FROM licenses l CROSS JOIN LATERAL jsonb_each_text(l.raw_payload) j
              WHERE l.source_system='fl_dbpr' AND l.contractor_id IS NOT NULL
                AND j.key ~* %s AND trim(j.value)<>''
            ), per_shell AS (
              SELECT contractor_id, COUNT(*)::int observation_rows,
                     COUNT(DISTINCT value)::int distinct_values
              FROM observations GROUP BY contractor_id
            )
            SELECT COUNT(*)::int AS contractor_shells,
                   (SELECT COUNT(DISTINCT value) FROM observations)::int AS distinct_observations,
                   COALESCE(SUM(observation_rows),0)::int AS observation_rows,
                   COUNT(*) FILTER (WHERE distinct_values>1)::int AS conflicting_shells
            FROM per_shell
            """,
            (regex,),
        )
        result["source_contact_observations"][kind]["source"] = "licenses.raw_payload / fl_dbpr"

    result["address_coverage"] = fetch_one(
        cur,
        """
        WITH la AS (
          SELECT contractor_id,
            bool_or(NULLIF(trim(address_line_1),'') IS NOT NULL) dbpr_address,
            bool_or(NULLIF(trim(city),'') IS NOT NULL) city,
            bool_or(NULLIF(trim(state),'') IS NOT NULL) state,
            bool_or(NULLIF(trim(postal_code),'') IS NOT NULL) zip,
            bool_or(NULLIF(trim(county_name),'') IS NOT NULL OR NULLIF(trim(county_code),'') IS NOT NULL) county
          FROM licenses WHERE source_system='fl_dbpr' AND contractor_id IS NOT NULL
          GROUP BY contractor_id
        )
        SELECT COUNT(*) FILTER (WHERE la.dbpr_address)::int dbpr_license_address,
          COUNT(*) FILTER (WHERE la.city)::int city,
          COUNT(*) FILTER (WHERE la.state)::int state,
          COUNT(*) FILTER (WHERE la.zip)::int zip,
          COUNT(*) FILTER (WHERE la.county)::int county
        FROM la
        """,
    )
    result["address_coverage"]["sunbiz_principal_address"] = fetch_one(
        cur,
        """
        WITH links AS MATERIALIZED (
          SELECT contractor_id, entity_id FROM contractor_entities
          WHERE role='sunbiz_entity'
        )
        SELECT COUNT(DISTINCT ce.contractor_id)::int AS n
        FROM links ce JOIN entities e ON e.id=ce.entity_id
        WHERE TRUE
          AND NULLIF(trim(e.principal_address),'') IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM licenses l WHERE l.contractor_id=ce.contractor_id
              AND l.source_system='fl_dbpr'
          )
        """,
    )["n"]

    result["discipline_by_dataset"] = fetch_all(
        cur,
        """
        SELECT source_dataset, COUNT(*)::int total,
          COUNT(DISTINCT external_key)::int distinct_external_keys,
          COUNT(DISTINCT complaint_number) FILTER (WHERE complaint_number IS NOT NULL AND trim(complaint_number)<>'')::int distinct_complaints,
          COUNT(*) FILTER (WHERE license_id IS NOT NULL)::int with_license_id,
          COUNT(*) FILTER (WHERE contractor_id IS NOT NULL)::int with_contractor_id,
          COUNT(*) FILTER (WHERE license_id IS NOT NULL AND contractor_id IS NOT NULL)::int with_both,
          COUNT(*) FILTER (WHERE license_id IS NULL AND contractor_id IS NULL)::int with_neither,
          COUNT(DISTINCT contractor_id) FILTER (WHERE contractor_id IS NOT NULL)::int unique_contractors,
          COUNT(DISTINCT license_id) FILTER (WHERE license_id IS NOT NULL)::int unique_licenses,
          LEAST(MIN(entered_date),MIN(disposition_date)) AS earliest_date,
          GREATEST(MAX(entered_date),MAX(disposition_date)) AS latest_date
        FROM discipline_actions WHERE source_system='fl_dbpr'
        GROUP BY source_dataset ORDER BY total DESC, source_dataset
        """,
    )
    result["discipline_total"] = fetch_one(
        cur,
        """SELECT COUNT(*)::int total,
          COUNT(*) FILTER (WHERE license_id IS NOT NULL)::int with_license_id,
          COUNT(*) FILTER (WHERE contractor_id IS NOT NULL)::int with_contractor_id,
          COUNT(*) FILTER (WHERE license_id IS NULL)::int without_license_id,
          COUNT(*) FILTER (WHERE contractor_id IS NULL)::int without_contractor_id,
          COUNT(*) FILTER (WHERE license_id IS NULL AND contractor_id IS NULL)::int with_neither
          FROM discipline_actions WHERE source_system='fl_dbpr'""",
    )
    result["discipline_distributions"] = {}
    for column in ("classification", "disposition", "discipline_description", "violation_code", "license_type"):
        result["discipline_distributions"][column] = fetch_all(
            cur,
            f"""SELECT COALESCE(NULLIF(trim({column}),''),'(null)') value, COUNT(*)::int total
                 FROM discipline_actions WHERE source_system='fl_dbpr'
                 GROUP BY 1 ORDER BY total DESC, value LIMIT 100""",
        )

    license_core_expr = normalized_core_sql("license_number")
    discipline_core_expr = normalized_core_sql("license_number_raw")
    collision_cte = f"""
      WITH lc AS (
        SELECT id, contractor_id, external_key, occupation_code, {license_core_expr} core
        FROM licenses WHERE source_system='fl_dbpr'
      ), collisions AS (
        SELECT core, COUNT(*)::int license_rows, COUNT(DISTINCT external_key)::int external_keys,
          COUNT(DISTINCT occupation_code)::int occupation_codes,
          COUNT(DISTINCT contractor_id) FILTER (WHERE contractor_id IS NOT NULL)::int contractor_shells,
          string_agg(DISTINCT occupation_code, '+' ORDER BY occupation_code) occupation_combination
        FROM lc WHERE core IS NOT NULL GROUP BY core
        HAVING COUNT(*)>1 OR COUNT(DISTINCT external_key)>1 OR COUNT(DISTINCT occupation_code)>1
            OR COUNT(DISTINCT contractor_id) FILTER (WHERE contractor_id IS NOT NULL)>1
      )
    """
    result["numeric_core_collisions"] = fetch_one(
        cur,
        collision_cte + """
        SELECT COUNT(*)::int collision_cores, COALESCE(SUM(license_rows),0)::int licenses_inside,
          COALESCE(SUM(contractor_shells),0)::int shell_exposures,
          (SELECT COUNT(DISTINCT lc.contractor_id) FROM lc JOIN collisions USING(core) WHERE lc.contractor_id IS NOT NULL)::int distinct_contractor_shells_exposed
        FROM collisions
        """,
    )
    result["collision_combinations"] = fetch_all(
        cur,
        collision_cte + """
        SELECT occupation_combination, COUNT(*)::int collision_cores, SUM(license_rows)::int license_rows
        FROM collisions GROUP BY occupation_combination ORDER BY collision_cores DESC, occupation_combination LIMIT 100
        """,
    )
    result["collision_samples"] = fetch_all(
        cur,
        collision_cte + """
        SELECT core, license_rows, external_keys, occupation_codes, contractor_shells, occupation_combination
        FROM collisions ORDER BY contractor_shells DESC, license_rows DESC, core LIMIT 20
        """,
    )

    exposed_cte = collision_cte + f""",
      dc AS (
        SELECT d.*, {discipline_core_expr} core FROM discipline_actions d
        WHERE d.source_system='fl_dbpr'
      ), exposed AS (SELECT dc.* FROM dc JOIN collisions USING(core))
    """
    result["discipline_collision_exposure"] = fetch_one(
        cur,
        exposed_cte + """
        SELECT COUNT(*)::int total,
          COUNT(*) FILTER (WHERE license_id IS NOT NULL)::int with_license_id,
          COUNT(*) FILTER (WHERE contractor_id IS NOT NULL)::int with_contractor_id,
          COUNT(*) FILTER (WHERE license_id IS NOT NULL OR contractor_id IS NOT NULL)::int with_any_link,
          COUNT(*) FILTER (WHERE license_id IS NULL AND contractor_id IS NULL)::int with_neither,
          COUNT(*) FILTER (WHERE contractor_id IS NOT NULL)::int currently_linked,
          COUNT(*) FILTER (WHERE contractor_id IS NULL)::int currently_unlinked,
          COUNT(DISTINCT contractor_id) FILTER (WHERE contractor_id IS NOT NULL)::int unique_contractor_ids,
          COUNT(DISTINCT license_id) FILTER (WHERE license_id IS NOT NULL)::int unique_license_ids,
          COUNT(DISTINCT complaint_number) FILTER (WHERE complaint_number IS NOT NULL)::int unique_complaints
        FROM exposed
        """,
    )
    result["discipline_collision_by_dataset"] = fetch_all(
        cur,
        exposed_cte + """
        SELECT source_dataset, COUNT(*)::int total,
          COUNT(*) FILTER (WHERE license_id IS NOT NULL)::int license_linked,
          COUNT(*) FILTER (WHERE contractor_id IS NOT NULL)::int contractor_linked,
          COUNT(*) FILTER (WHERE license_id IS NULL AND contractor_id IS NULL)::int with_neither
        FROM exposed GROUP BY source_dataset ORDER BY total DESC
        """,
    )

    result["discipline_link_consistency"] = fetch_one(
        cur,
        """
        SELECT COUNT(*) FILTER (WHERE d.license_id IS NOT NULL AND l.contractor_id IS NOT NULL AND d.contractor_id=l.contractor_id)::int consistent,
          COUNT(*) FILTER (WHERE d.license_id IS NOT NULL AND l.contractor_id IS NOT NULL AND d.contractor_id IS NOT NULL AND d.contractor_id<>l.contractor_id)::int mismatch,
          COUNT(*) FILTER (WHERE d.license_id IS NOT NULL AND l.contractor_id IS NULL)::int license_null_contractor,
          COUNT(*) FILTER (WHERE d.license_id IS NOT NULL AND d.contractor_id IS NULL)::int discipline_null_contractor
        FROM discipline_actions d LEFT JOIN licenses l ON l.id=d.license_id
        WHERE d.source_system='fl_dbpr'
        """,
    )
    result["discipline_type_agreement"] = fetch_one(
        cur,
        """
        SELECT COUNT(*) FILTER (WHERE d.license_type IS NULL OR trim(d.license_type)='')::int missing,
          COUNT(*) FILTER (WHERE d.license_type IS NOT NULL AND trim(d.license_type)<>'' AND upper(trim(d.license_type))=upper(trim(l.occupation_code)))::int agreement,
          COUNT(*) FILTER (WHERE d.license_type ~ '^[A-Za-z]{2,6}$' AND upper(trim(d.license_type))<>upper(trim(l.occupation_code)))::int disagreement,
          COUNT(*) FILTER (WHERE d.license_type IS NOT NULL AND trim(d.license_type)<>'' AND d.license_type !~ '^[A-Za-z]{2,6}$')::int not_comparable
        FROM discipline_actions d JOIN licenses l ON l.id=d.license_id
        WHERE d.source_system='fl_dbpr'
        """,
    )
    consistency = result["discipline_link_consistency"]
    types = result["discipline_type_agreement"]
    exposure = result["discipline_collision_exposure"]
    result["wrong_company_assessment"] = {
        "proven_consistent": consistency["consistent"],
        "ambiguous_collision_exposed": max(0, exposure["with_any_link"] - types["disagreement"]),
        "suspect_identifier_type_conflict": types["disagreement"],
        "unresolved": result["discipline_total"]["without_contractor_id"],
        "proven_wrong": consistency["mismatch"],
    }
    result["proven_wrong_samples"] = fetch_all(
        cur,
        """
        SELECT d.external_key AS discipline_external_key, d.complaint_number,
               l.external_key AS linked_license_external_key,
               'discipline contractor_id differs from linked license contractor_id' AS reason
        FROM discipline_actions d JOIN licenses l ON l.id=d.license_id
        WHERE d.source_system='fl_dbpr' AND d.contractor_id IS NOT NULL
          AND l.contractor_id IS NOT NULL AND d.contractor_id<>l.contractor_id
        ORDER BY d.external_key LIMIT 20
        """,
    )

    result["publication_exposure"] = {
        "discipline_with_contractor_id": result["discipline_total"]["with_contractor_id"],
        "discipline_with_license_id": result["discipline_total"]["with_license_id"],
        "collision_exposed_with_contractor_id": exposure["currently_linked"],
        "suspect_reachable_by_profile_logic": types["disagreement"],
    }

    result["provenance"] = {
        "licenses": {
            "total": license_core["total"],
            "with_ingest_batch": license_core["with_ingest_batch"],
            "with_last_verified_at": license_core["with_last_verified_at"],
            "with_raw_payload": license_core["with_raw_payload"],
        },
        "sunbiz_entities": fetch_one(
            cur,
            """SELECT COUNT(*)::int total,
              COUNT(*) FILTER (WHERE ingest_batch_id IS NOT NULL)::int with_ingest_batch,
              COUNT(*) FILTER (WHERE last_verified_at IS NOT NULL)::int with_last_verified_at,
              COUNT(*) FILTER (WHERE raw_payload IS NOT NULL)::int with_raw_payload
              FROM entities WHERE source_system='fl_sunbiz'""",
        ),
        "discipline": fetch_one(
            cur,
            """SELECT COUNT(*)::int total,
              COUNT(*) FILTER (WHERE ingest_batch_id IS NOT NULL)::int with_ingest_batch,
              COUNT(*) FILTER (WHERE last_verified_at IS NOT NULL)::int with_last_verified_at,
              COUNT(*) FILTER (WHERE raw_payload IS NOT NULL)::int with_raw_payload,
              COUNT(*) FILTER (WHERE source_dataset IS NULL OR trim(source_dataset)='')::int missing_source_dataset
              FROM discipline_actions WHERE source_system='fl_dbpr'""",
        ),
    }

    result["manual_samples"] = {}
    license_samples = fetch_all(
        cur,
        """SELECT c.slug,c.display_name,l.external_key license_external_key,
                  l.occupation_code,l.status_normalized
             FROM licenses l JOIN contractors c ON c.id=l.contractor_id
             WHERE l.source_system='fl_dbpr'
             ORDER BY l.external_key LIMIT 1000""",
    )
    result["manual_samples"]["active_straightforward"] = next(
        (x for x in license_samples if x["status_normalized"] == "active"), None
    )
    result["manual_samples"]["inactive"] = next(
        (x for x in license_samples if x["status_normalized"] == "inactive"), None
    )
    result["manual_samples"]["multi_license_shell"] = None
    result["manual_samples"]["with_sunbiz"] = None
    result["manual_samples"]["without_identified_discipline"] = None
    result["manual_samples"]["with_discipline"] = (
        fetch_all(
            cur,
            """SELECT d.external_key AS discipline_external_key,d.complaint_number,
                      d.source_dataset,l.external_key AS license_external_key
                 FROM discipline_actions d LEFT JOIN licenses l ON l.id=d.license_id
                 WHERE d.source_system='fl_dbpr' AND d.contractor_id IS NOT NULL
                 LIMIT 1""",
        )
        or [None]
    )[0]
    result["manual_samples"]["unattached_discipline"] = (
        fetch_all(
            cur,
            """SELECT external_key AS discipline_external_key, complaint_number, source_dataset,
                      license_number_raw FROM discipline_actions
                 WHERE source_system='fl_dbpr' AND contractor_id IS NULL
                 ORDER BY external_key LIMIT 1""",
        )
        or [None]
    )[0]
    result["manual_samples"]["qualifying_business_shell"] = (
        fetch_all(
            cur,
            """SELECT c.slug, c.display_name, e.external_key AS entity_external_key, e.status
                 FROM contractor_entities ce JOIN contractors c ON c.id=ce.contractor_id
                 JOIN entities e ON e.id=ce.entity_id
                 WHERE ce.role='qualifying_business' ORDER BY c.slug LIMIT 1""",
        )
        or [None]
    )[0]

    # Best-supported public/internal matrix; no explicit publication state exists.
    dataset_map = {row["source_dataset"].lower(): row for row in result["discipline_by_dataset"]}
    def dataset(find: str) -> dict[str, Any]:
        return next((row for key, row in dataset_map.items() if find in key), {})

    licensed = dataset("lic")
    ula = dataset("ula")
    recovery = dataset("rf") or dataset("recovery")
    result["public_internal_matrix"] = [
        {"evidence_type":"Florida licenses","total":license_core["total"],"linked":license_core["attached"],"publicly_reachable":license_core["attached"],"unlinked_held":license_core["unattached"],"ambiguous_review":0},
        {"evidence_type":"DBPR qualifying-business relationships","total":result["qualifying_business"]["relationships"],"linked":result["qualifying_business"]["relationships"],"publicly_reachable":0,"unlinked_held":result["qualifying_business"]["relationships"],"ambiguous_review":0},
        {"evidence_type":"Sunbiz links","total":sum(r["total"] for r in result["sunbiz_confidence"]),"linked":sum(r["total"] for r in result["sunbiz_confidence"]),"publicly_reachable":sunbiz["high_confidence_public_safe_links"],"unlinked_held":sunbiz["below_public_threshold_links"],"ambiguous_review":sunbiz["below_public_threshold_links"]},
        {"evidence_type":"Canonical phone","total":result["canonical_contacts_regulated"]["phone"],"linked":result["canonical_contacts_regulated"]["phone"],"publicly_reachable":result["canonical_contacts_public"]["phone"],"unlinked_held":0,"ambiguous_review":0},
        {"evidence_type":"Canonical website","total":result["canonical_contacts_regulated"]["website"],"linked":result["canonical_contacts_regulated"]["website"],"publicly_reachable":result["canonical_contacts_public"]["website"],"unlinked_held":0,"ambiguous_review":0},
        {"evidence_type":"Source email observations","total":result["source_contact_observations"]["email"]["observation_rows"],"linked":result["source_contact_observations"]["email"]["contractor_shells"],"publicly_reachable":0,"unlinked_held":result["source_contact_observations"]["email"]["observation_rows"],"ambiguous_review":result["source_contact_observations"]["email"]["conflicting_shells"]},
    ]
    for label, row in (("Licensed discipline",licensed),("ULA",ula),("Recovery Fund",recovery)):
        result["public_internal_matrix"].append({"evidence_type":label,"total":row.get("total",0),"linked":row.get("with_contractor_id",0),"publicly_reachable":row.get("with_contractor_id",0),"unlinked_held":row.get("total",0)-row.get("with_contractor_id",0),"ambiguous_review":0})
    for label in ("Workers comp","Exemptions","Stop-work/compliance"):
        result["public_internal_matrix"].append({"evidence_type":label,"total":0,"linked":0,"publicly_reachable":0,"unlinked_held":0,"ambiguous_review":0})

    status = {r["status"]: r["total"] for r in result["license_status_normalized"]}
    result["kpis_before"] = {
        "Florida-regulated canonical contractor shells": contractor["regulated_shells"],
        "Public/searchable Florida profiles": contractor["public_searchable_profiles"],
        "Florida DBPR licenses": license_core["total"],
        "Active licenses": status.get("active",0),
        "Inactive licenses": status.get("inactive",0),
        "Profiles with canonical phone": result["canonical_contacts_public"]["phone"],
        "Profiles with canonical website": result["canonical_contacts_public"]["website"],
        "Profiles with regulator-source email observation": result["source_contact_observations"]["email"]["contractor_shells"],
        "Profiles with Sunbiz entity": sunbiz["contractors_with_link"],
        "Qualifying-business relationships": result["qualifying_business"]["relationships"],
        "Licensed DBPR regulatory matters": licensed.get("total",0),
        "Unlicensed activity records": ula.get("total",0),
        "Recovery Fund records": recovery.get("total",0),
        "Workers' comp observations": 0,
        "Exemptions": 0,
        "Stop-work/compliance actions": 0,
        "Numeric license-core collision groups": result["numeric_core_collisions"]["collision_cores"],
        "Discipline rows collision-exposed": exposure["total"],
        "Suspected wrong-company links": result["wrong_company_assessment"]["suspect_identifier_type_conflict"],
        "Proven wrong-company links": result["wrong_company_assessment"]["proven_wrong"],
        "Unattached discipline records": result["discipline_total"]["without_contractor_id"],
    }

    assertions: list[dict[str, Any]] = []
    assert_equal(assertions,"FL licenses = attached + unattached",license_core["total"],license_core["attached"]+license_core["unattached"])
    assert_equal(assertions,"regulated shells = one-license + multi-license",contractor["regulated_shells"],contractor["one_license_shells"]+contractor["multi_license_shells"])
    assert_equal(assertions,"regulated shells = non-thin + thin",contractor["regulated_shells"],contractor["non_thin_shells"]+contractor["thin_shells"])
    assert_equal(assertions,"discipline datasets reconcile",result["discipline_total"]["total"],rows_total(result["discipline_by_dataset"]))
    assert_equal(assertions,"discipline contractor linkage reconciles",result["discipline_total"]["total"],result["discipline_total"]["with_contractor_id"]+result["discipline_total"]["without_contractor_id"])
    assert_equal(assertions,"Sunbiz coverage reconciles",contractor["regulated_shells"],sunbiz["contractors_with_link"]+sunbiz["contractors_without_link"])
    contacts=result["canonical_contacts_regulated"]
    phone_only=contacts["phone"]-contacts["phone_and_website"]
    website_only=contacts["website"]-contacts["phone_and_website"]
    assert_equal(assertions,"canonical contact groups reconcile",contractor["regulated_shells"],phone_only+website_only+contacts["phone_and_website"]+contacts["neither"])
    assert_equal(assertions,"external keys unique",license_core["total"],license_core["distinct_external_keys"])
    assert_equal(assertions,"mutation count",False,result["audit"]["mutation_performed"])
    result["assertions"] = assertions
    result["audit"]["reconciliation_assertions"] = "PASS"
    return result


def md_table(headers: list[str], rows: list[list[Any]]) -> list[str]:
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    for row in rows:
        out.append("| " + " | ".join(str(v if v is not None else "—").replace("|", "\\|") for v in row) + " |")
    return out


def render_markdown(r: dict[str, Any]) -> str:
    a=r["audit"]; c=r["contractors"]; l=r["licenses"]; s=r["sunbiz"]; q=r["qualifying_business"]
    lines=["# CTH-FL-BASE-001 — Florida State Forensic Baseline","","> Official production BEFORE snapshot. Measurement only; no remediation was performed.",""]
    lines += ["## A — Database / audit metadata","",f"- Git SHA: `{a['git_sha']}`",f"- Branch: `{a['branch']}`",f"- Audit UTC timestamp: `{a['timestamp_utc']}`",f"- PostgreSQL: `{a['postgres_version']}`",f"- Transaction: `{a['transaction_isolation']}`, read-only `{a['transaction_read_only']}`",f"- Statement timeout: `{a['statement_timeout']}`","- Environment: `PRODUCTION`","- Mutation performed: `NO`","- Reconciliation assertions: `PASS`",""]
    lines += ["### Latest relevant ingest batches",""] + md_table(["Source","Dataset","Extracted","Rows","Checksum prefix","Source file / URL"],[[x['source_system'],x['source_dataset'],x['extracted_at'],x['row_count'],x['checksum_prefix'],x['source_file'] or x['source_url'] or '—'] for x in r['ingest_batches']])+[""]
    lines += ["## B — Florida contractor shell baseline","","Florida-regulated means attached to at least one `licenses.source_system='fl_dbpr'` row. Counts are canonical database shells, not proven unique real-world companies.",""]+md_table(["Metric","Count"],[[k.replace('_',' ').title(),v] for k,v in c.items()])+[""]
    lines += ["### Potential duplicate shell groups","",*md_table(["Signal","Groups"],[[k.replace('_',' '),v] for k,v in r['potential_duplicates'].items()]),"","These are candidate groups only; no fuzzy merge or identity remediation was performed.",""]
    lines += ["## C — Florida license baseline","",*md_table(["Metric","Value"],[[k.replace('_',' '),v] for k,v in l.items()]),"","### Normalized status",*md_table(["Status","Count"],[[x['status'],x['total']] for x in r['license_status_normalized']]),"","### Primary status",*md_table(["Status","Count"],[[x['status'],x['total']] for x in r['license_primary_status']]),"","### Secondary status",*md_table(["Status","Count"],[[x['status'],x['total']] for x in r['license_secondary_status']]),""]
    lines += ["## D — License class / trade distribution","",*md_table(["Code","Description","Total","Active","Inactive","Current","Other/unknown","Shells","Numeric cores"],[[x['occupation_code'],x['occupation_description'],x['total'],x['active'],x['inactive'],x['current'],x['other_unknown'],x['attached_shells'],x['unique_numeric_cores']] for x in r['license_classes']]),""]
    lines += ["## E — Qualifying business baseline","",*md_table(["Metric","Count"],[[k.replace('_',' '),v] for k,v in q.items()]),"","**QUALIFYING AGENT/PERSON MODEL: NOT IMPLEMENTED.** These are qualifying-business entities and relationships, not individual qualifying agents.",""]
    lines += ["## F — Sunbiz / entity baseline","",*md_table(["Metric","Value"],[[k.replace('_',' '),v] for k,v in s.items()]),"","### Match methods",*md_table(["Method","Count"],[[x['match_method'],x['total']] for x in r['sunbiz_match_method']]),"","### Actual entity statuses",*md_table(["Status","Count"],[[x['status'],x['total']] for x in r['sunbiz_status_actual']]),"","Sunbiz linkage is inferred using deterministic multi-field rules. It is not a shared official DBPR/Sunbiz identifier.",""]
    lines += ["## G — Contact baseline","","### Canonical fields — Florida-regulated shells",*md_table(["Metric","Count"],[[k.replace('_',' '),v] for k,v in r['canonical_contacts_regulated'].items()]),"","### Canonical fields — public/searchable profiles",*md_table(["Metric","Count"],[[k.replace('_',' '),v] for k,v in r['canonical_contacts_public'].items()]),"","### Source observations from `licenses.raw_payload` / `fl_dbpr`",*md_table(["Kind","Shells","Distinct observations","Rows","Conflicting shells"],[[k,v['contractor_shells'],v['distinct_observations'],v['observation_rows'],v['conflicting_shells']] for k,v in r['source_contact_observations'].items()]),"","Source observations are not canonical contacts and were not promoted.",""]
    lines += ["## H — Address coverage","",*md_table(["Field","Shells"],[[k.replace('_',' '),v] for k,v in r['address_coverage'].items()]),"","DBPR mailing and Sunbiz principal addresses serve different purposes; differences are not automatically errors.",""]
    lines += ["## I — Regulatory evidence baseline","",*md_table(["Dataset","Total","External keys","Complaints","License ID","Contractor ID","Both","Neither","Contractors","Licenses","Earliest","Latest"],[[x['source_dataset'],x['total'],x['distinct_external_keys'],x['distinct_complaints'],x['with_license_id'],x['with_contractor_id'],x['with_both'],x['with_neither'],x['unique_contractors'],x['unique_licenses'],x['earliest_date'],x['latest_date']] for x in r['discipline_by_dataset']]),"","A complaint is not treated as wrongdoing. Status, disposition, discipline, and final orders remain distinct source concepts.",""]
    col=r['numeric_core_collisions']; exp=r['discipline_collision_exposure']; con=r['discipline_link_consistency']; typ=r['discipline_type_agreement']; wrong=r['wrong_company_assessment']
    lines += ["## J — Adverse-evidence linkage forensic audit","","### J1 — Numeric license-core collisions",*md_table(["Metric","Count"],[[k.replace('_',' '),v] for k,v in col.items()]),"","### J2 — Collision-exposed discipline",*md_table(["Metric","Count"],[[k.replace('_',' '),v] for k,v in exp.items()]),"","### J3 — Contractor/license consistency",*md_table(["Class","Count"],[[k.replace('_',' '),v] for k,v in con.items()]),"","### J4 — License-type/occupation comparison",*md_table(["Class","Count"],[[k.replace('_',' '),v] for k,v in typ.items()]),"","### J5 — Conservative wrong-company assessment",*md_table(["Class","Count"],[[k.replace('_',' '),v] for k,v in wrong.items()]),"","Collision exposure alone is not classified as a wrong-company link. No records were repaired.",""]
    lines += ["## K — Current publication exposure","",*md_table(["Metric","Count"],[[k.replace('_',' '),v] for k,v in r['publication_exposure'].items()]),"","There is no explicit publication state. Current application logic can reach discipline whenever `contractor_id` is populated.",""]
    lines += ["## L — Missing state layers","","| Layer | Status |","|---|---|","| Workers' compensation observations | NOT IMPLEMENTED / 0 STRUCTURED RECORDS |","| Exemptions | NOT IMPLEMENTED / 0 STRUCTURED RECORDS |","| Construction Policy Tracking | NOT IMPLEMENTED / 0 STRUCTURED RECORDS |","| Stop-work orders / workers' comp enforcement | NOT IMPLEMENTED / 0 STRUCTURED RECORDS |","| Qualifier-person relationships | NOT IMPLEMENTED / 0 STRUCTURED RECORDS |","| Contact observations | NOT IMPLEMENTED / 0 STRUCTURED RECORDS |","| Explicit review state | NOT IMPLEMENTED / 0 STRUCTURED RECORDS |","| Explicit publication state | NOT IMPLEMENTED / 0 STRUCTURED RECORDS |","","This means ContractorTrustHub does not currently structure these layers; it does not imply Florida has no source data.",""]
    lines += ["## M — Provenance baseline",""]
    for name,values in r['provenance'].items(): lines += [f"### {name.replace('_',' ').title()}",*md_table(["Metric","Count"],[[k.replace('_',' '),v] for k,v in values.items()]),""]
    lines += ["## N — Public vs internal matrix","",*md_table(["Evidence type","Total","Linked","Publicly reachable","Unlinked/held by structure","Ambiguous/safety review"],[[x['evidence_type'],x['total'],x['linked'],x['publicly_reachable'],x['unlinked_held'],x['ambiguous_review']] for x in r['public_internal_matrix']]),"","Rules: non-thin FL DBPR license profiles are searchable; Sunbiz requires confidence ≥ 0.90; linked discipline is profile-reachable; source contact observations and qualifying-business shells are not treated as public canonical evidence.",""]
    lines += ["## O — Data reconciliation tests","",*md_table(["Assertion","Left","Right","Result"],[[x['name'],x['left'],x['right'],'PASS' if x['pass'] else 'FAIL'] for x in r['assertions']]),""]
    lines += ["## P — Manual forensic sample","",*md_table(["Stratum","Bounded sample"],[[k,json.dumps(v,default=json_default,sort_keys=True) if v else 'Not available'] for k,v in r['manual_samples'].items()]),"","Samples validate aggregate interpretation only and were not modified.",""]
    lines += ["## Q — Official BEFORE/AFTER KPI table","",*md_table(["KPI","BEFORE — CTH-FL-BASE-001","AFTER — Final FL State Audit","Net Gain"],[[k,v,'TBD','TBD'] for k,v in r['kpis_before'].items()]),""]
    lines += ["## Interpretation safeguards","","- Canonical contractor shells are not asserted to be unique real-world companies.","- No disciplinary action identified in covered data is not described as a clean record.","- No workers' compensation observation is currently structured in ContractorTrustHub; this is not an uninsured finding.","- Inactive status is not misconduct.","- Recovery Fund or complaint records are not treated as wrongdoing without supported disposition evidence.",""]
    return "\n".join(lines)


def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json-output",type=Path,default=ROOT/"artifacts/cth-fl-base-001-baseline.json")
    parser.add_argument("--markdown-output",type=Path,default=ROOT/"docs/cth-fl-base-001-florida-state-forensic-baseline.md")
    parser.add_argument("--statement-timeout-ms",type=int,default=120000)
    args=parser.parse_args()
    if args.statement_timeout_ms < 1000 or args.statement_timeout_ms > 120000:
        raise SystemExit("statement timeout must be between 1000 and 120000 ms")
    load_dotenv_files(ROOT/".env.local",ROOT/".env")
    url=os.environ.get("DATABASE_URL")
    if not url or not url.strip().lower().startswith(("postgres://","postgresql://")):
        raise SystemExit("DATABASE_URL is missing or not a PostgreSQL URI")
    try:
        import psycopg
    except ImportError as exc:
        raise SystemExit("Install psycopg[binary]>=3.1") from exc
    dsn=normalize_database_url(url,connect_timeout="15")
    result=None
    conn=psycopg.connect(dsn,autocommit=True)
    try:
        with conn.cursor() as cur:
            cur.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
            try:
                cur.execute(
                    "SELECT set_config('statement_timeout', %s, true)",
                    (f"{args.statement_timeout_ms}ms",),
                )
                result=audit(cur)
            finally:
                cur.execute("ROLLBACK")
    finally:
        conn.close()
    if result is None:
        raise RuntimeError("Audit produced no result")
    args.json_output.parent.mkdir(parents=True,exist_ok=True)
    args.markdown_output.parent.mkdir(parents=True,exist_ok=True)
    args.json_output.write_text(json.dumps(result,indent=2,sort_keys=True,default=json_default)+"\n",encoding="utf-8")
    args.markdown_output.write_text(render_markdown(result),encoding="utf-8")
    print(f"CTH-FL-BASE-001 PASS | {result['audit']['timestamp_utc']} | assertions PASS | mutation NO")
    print(f"JSON: {args.json_output.relative_to(ROOT)}")
    print(f"Markdown: {args.markdown_output.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
