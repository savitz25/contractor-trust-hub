#!/usr/bin/env python3
"""
High-confidence linker: DBPR contractors (+ licenses) → fl_sunbiz entities.

Match methods (strict only — no fuzzy):
  1. exact_name_address  (name_normalized + address line + zip5)  confidence 0.98
  2. exact_name_zip5     (name_normalized + zip5)                 confidence 0.95
  3. exact_name_city     (name_normalized + city)                 confidence 0.92
  4. officer_name_zip    (officer person name + zip5)             confidence 0.90

Rules:
  - Prefer highest confidence unique match per contractor.
  - If two different Sunbiz entities tie at best confidence → skip (ambiguous).
  - Writes contractor_entities role='sunbiz_entity' with match_method, confidence, evidence, linked_at.
  - Idempotent upserts on (contractor_id, entity_id, role).

Usage:
  python scripts/link_dbpr_to_sunbiz.py
  python scripts/link_dbpr_to_sunbiz.py --min-confidence 0.92
  python scripts/link_dbpr_to_sunbiz.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingest.env import load_dotenv_files, normalize_database_url  # noqa: E402
from ingest.normalize import (  # noqa: E402
    normalize_address_line,
    normalize_city,
    normalize_entity_name,
    normalize_person_name,
    zip5,
)

log = logging.getLogger("link_dbpr_sunbiz")

ROLE = "sunbiz_entity"
SOURCE_SUNBIZ = "fl_sunbiz"

# Confidence thresholds by method
METHOD_CONFIDENCE = {
    "exact_name_address": 0.98,
    "exact_name_zip5": 0.95,
    "exact_name_city": 0.92,
    "officer_name_zip": 0.90,
}


@dataclass
class Candidate:
    contractor_id: str
    entity_id: str
    method: str
    confidence: float
    evidence: dict[str, Any] = field(default_factory=dict)


def connect_dsn() -> str:
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise SystemExit("DATABASE_URL not set")
    return normalize_database_url(url, connect_timeout=os.environ.get("PGCONNECT_TIMEOUT", "30"))


def ensure_columns(conn) -> None:
    mig = ROOT / "schema" / "migrations" / "001_sunbiz_linker.sql"
    if mig.exists():
        with conn.cursor() as cur:
            cur.execute(mig.read_text(encoding="utf-8"))
        conn.commit()


def load_sunbiz_index(conn) -> tuple[
    dict[str, list[dict[str, Any]]],
    dict[str, list[dict[str, Any]]],
    dict[str, list[dict[str, Any]]],
    dict[str, list[dict[str, Any]]],
]:
    """
    Indexes:
      by_name_zip: (name_norm|zip5) -> [entity...]
      by_name_city: (name_norm|city) -> [entity...]
      by_name_addr_zip: (name_norm|addr|zip5) -> [entity...]
      by_officer_zip: (person_norm|zip5) -> [entity...]
    """
    by_name_zip: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_name_city: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_name_addr_zip: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_officer_zip: dict[str, list[dict[str, Any]]] = defaultdict(list)

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, external_key, legal_name, name_normalized, status,
                   principal_address, city, state, postal_code, officers, fei_number
            FROM entities
            WHERE source_system = %s
            """,
            (SOURCE_SUNBIZ,),
        )
        rows = cur.fetchall()

    for r in rows:
        (
            eid,
            ext,
            legal,
            name_norm,
            status,
            addr,
            city,
            state,
            postal,
            officers,
            fei,
        ) = r
        name_norm = name_norm or normalize_entity_name(legal)
        if not name_norm:
            continue
        z = zip5(postal)
        c = normalize_city(city)
        a = normalize_address_line(addr)
        ent = {
            "id": str(eid),
            "external_key": ext,
            "legal_name": legal,
            "name_normalized": name_norm,
            "status": status,
            "city": c,
            "zip5": z,
            "address": a,
            "fei": fei or "",
        }
        if z:
            by_name_zip[f"{name_norm}|{z}"].append(ent)
        if c:
            by_name_city[f"{name_norm}|{c}"].append(ent)
        if a and z:
            by_name_addr_zip[f"{name_norm}|{a}|{z}"].append(ent)

        # Officers
        offs = officers if isinstance(officers, list) else []
        for off in offs:
            if not isinstance(off, dict):
                continue
            pn = normalize_person_name(off.get("name"))
            oz = zip5(off.get("postal_code")) or z
            if pn and oz:
                by_officer_zip[f"{pn}|{oz}"].append(ent)

    log.info(
        "Sunbiz index: entities=%s name_zip_keys=%s name_city_keys=%s addr_keys=%s officer_keys=%s",
        len(rows),
        len(by_name_zip),
        len(by_name_city),
        len(by_name_addr_zip),
        len(by_officer_zip),
    )
    return by_name_zip, by_name_city, by_name_addr_zip, by_officer_zip


def contractor_name_variants(display: str, legal: str, dba: str) -> set[str]:
    names = set()
    for n in (display, legal, dba):
        nn = normalize_entity_name(n)
        if nn:
            names.add(nn)
    return names


def pick_unique(ents: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Return entity only if all candidates share the same entity id."""
    if not ents:
        return None
    ids = {e["id"] for e in ents}
    if len(ids) != 1:
        return None
    return ents[0]


def generate_candidates(
    conn,
    indexes: tuple,
    *,
    min_confidence: float,
    allow_officer_links: bool = False,
) -> list[Candidate]:
    by_name_zip, by_name_city, by_name_addr_zip, by_officer_zip = indexes
    candidates: list[Candidate] = []

    with conn.cursor() as cur:
        # Contractors with optional primary license address
        cur.execute(
            """
            SELECT
              c.id,
              c.display_name,
              c.legal_name,
              c.dba_name,
              c.primary_city,
              c.home_state,
              l.address_line_1,
              l.city,
              l.postal_code,
              l.licensee_name_raw,
              l.dba_name_raw,
              l.external_key
            FROM contractors c
            LEFT JOIN LATERAL (
              SELECT address_line_1, city, postal_code, licensee_name_raw, dba_name_raw, external_key
              FROM licenses
              WHERE contractor_id = c.id
              ORDER BY
                CASE status_normalized WHEN 'active' THEN 0 WHEN 'current' THEN 1 ELSE 2 END,
                updated_at DESC NULLS LAST
              LIMIT 1
            ) l ON TRUE
            """
        )
        rows = cur.fetchall()

    log.info("Scanning %s contractors for high-confidence Sunbiz matches…", len(rows))

    for r in rows:
        (
            cid,
            display,
            legal,
            dba,
            primary_city,
            home_state,
            lic_addr,
            lic_city,
            lic_postal,
            licensee_raw,
            dba_raw,
            lic_ext,
        ) = r
        cid = str(cid)
        names = contractor_name_variants(display or "", legal or "", dba or "")
        if dba_raw:
            names |= contractor_name_variants(dba_raw, "", "")
        if not names:
            continue

        city = normalize_city(lic_city or primary_city)
        z = zip5(lic_postal)
        addr = normalize_address_line(lic_addr)

        best_for_contractor: list[Candidate] = []

        for name in names:
            # 1) name + address + zip
            if addr and z:
                key = f"{name}|{addr}|{z}"
                ent = pick_unique(by_name_addr_zip.get(key, []))
                if ent:
                    conf = METHOD_CONFIDENCE["exact_name_address"]
                    if conf >= min_confidence:
                        best_for_contractor.append(
                            Candidate(
                                cid,
                                ent["id"],
                                "exact_name_address",
                                conf,
                                {
                                    "name_normalized": name,
                                    "address": addr,
                                    "zip5": z,
                                    "sunbiz_document_number": ent["external_key"],
                                    "sunbiz_legal_name": ent["legal_name"],
                                    "license_external_key": lic_ext,
                                },
                            )
                        )

            # 2) name + zip5
            if z:
                key = f"{name}|{z}"
                ent = pick_unique(by_name_zip.get(key, []))
                if ent:
                    conf = METHOD_CONFIDENCE["exact_name_zip5"]
                    if conf >= min_confidence:
                        best_for_contractor.append(
                            Candidate(
                                cid,
                                ent["id"],
                                "exact_name_zip5",
                                conf,
                                {
                                    "name_normalized": name,
                                    "zip5": z,
                                    "sunbiz_document_number": ent["external_key"],
                                    "sunbiz_legal_name": ent["legal_name"],
                                    "license_external_key": lic_ext,
                                },
                            )
                        )

            # 3) name + city
            if city:
                key = f"{name}|{city}"
                ent = pick_unique(by_name_city.get(key, []))
                if ent:
                    conf = METHOD_CONFIDENCE["exact_name_city"]
                    if conf >= min_confidence:
                        best_for_contractor.append(
                            Candidate(
                                cid,
                                ent["id"],
                                "exact_name_city",
                                conf,
                                {
                                    "name_normalized": name,
                                    "city": city,
                                    "sunbiz_document_number": ent["external_key"],
                                    "sunbiz_legal_name": ent["legal_name"],
                                    "license_external_key": lic_ext,
                                },
                            )
                        )

        # 4) officer path — OFF by default (same person can manage unrelated LLCs)
        if allow_officer_links and z and city and addr and licensee_raw:
            pn = normalize_person_name(licensee_raw)
            parts = pn.split()
            if len(parts) >= 2:
                person_keys = {pn, " ".join(parts[1:] + parts[:1])}
                for pk in person_keys:
                    if not pk or len(pk) < 5:
                        continue
                    # Require officer zip + city + same normalized street address
                    hits = [
                        e
                        for e in by_officer_zip.get(f"{pk}|{z}", [])
                        if e.get("city") == city and e.get("address") == addr
                    ]
                    ent = pick_unique(hits)
                    if ent:
                        conf = METHOD_CONFIDENCE["officer_name_zip"]
                        if conf >= min_confidence:
                            best_for_contractor.append(
                                Candidate(
                                    cid,
                                    ent["id"],
                                    "officer_name_zip",
                                    conf,
                                    {
                                        "person_normalized": pk,
                                        "zip5": z,
                                        "city": city,
                                        "address": addr,
                                        "licensee_name_raw": licensee_raw,
                                        "sunbiz_document_number": ent["external_key"],
                                        "sunbiz_legal_name": ent["legal_name"],
                                        "license_external_key": lic_ext,
                                    },
                                )
                            )

        if not best_for_contractor:
            continue

        # Keep highest confidence; skip ties across different entity ids
        best_for_contractor.sort(key=lambda c: c.confidence, reverse=True)
        top = best_for_contractor[0].confidence
        tops = [c for c in best_for_contractor if c.confidence == top]
        entity_ids = {c.entity_id for c in tops}
        if len(entity_ids) != 1:
            continue  # ambiguous
        # Prefer strongest method among tied entity
        winner = max(tops, key=lambda c: (c.confidence, c.method))
        candidates.append(winner)

    return candidates


def write_links(
    conn,
    candidates: list[Candidate],
    *,
    dry_run: bool,
    Jsonb,
    replace_role: bool = True,
) -> int:
    if dry_run:
        log.info("Dry-run: would write %s links", len(candidates))
        return 0

    now = datetime.now(timezone.utc)
    with conn.cursor() as cur:
        # Replace prior automated sunbiz links so tightened rules take effect
        if replace_role:
            cur.execute(
                "DELETE FROM contractor_entities WHERE role = %s AND match_method IS NOT NULL",
                (ROLE,),
            )
            log.info("Cleared prior %s automated links", ROLE)

        sql = """
            INSERT INTO contractor_entities (
              contractor_id, entity_id, role, confidence, match_method, evidence, linked_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (contractor_id, entity_id, role) DO UPDATE SET
              confidence = EXCLUDED.confidence,
              match_method = EXCLUDED.match_method,
              evidence = EXCLUDED.evidence,
              linked_at = EXCLUDED.linked_at
        """
        written = 0
        for i, c in enumerate(candidates, 1):
            cur.execute(
                sql,
                (
                    c.contractor_id,
                    c.entity_id,
                    ROLE,
                    c.confidence,
                    c.method,
                    Jsonb(c.evidence),
                    now,
                ),
            )
            written += 1
            if i % 500 == 0:
                conn.commit()
                log.info("  links written: %s", i)
    conn.commit()
    return written


def report(conn) -> dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM entities WHERE source_system = %s", (SOURCE_SUNBIZ,)
        )
        sunbiz_n = cur.fetchone()[0]
        cur.execute(
            """
            SELECT COUNT(*) FROM contractor_entities
            WHERE role = %s AND match_method IS NOT NULL
            """,
            (ROLE,),
        )
        links_n = cur.fetchone()[0]
        cur.execute(
            """
            SELECT match_method, COUNT(*), ROUND(AVG(confidence)::numeric, 3)
            FROM contractor_entities
            WHERE role = %s AND match_method IS NOT NULL
            GROUP BY 1 ORDER BY 2 DESC
            """,
            (ROLE,),
        )
        by_method = cur.fetchall()
        cur.execute(
            """
            SELECT c.display_name, e.legal_name, e.external_key, ce.match_method,
                   ce.confidence, c.primary_city
            FROM contractor_entities ce
            JOIN contractors c ON c.id = ce.contractor_id
            JOIN entities e ON e.id = ce.entity_id
            WHERE ce.role = %s
            ORDER BY ce.confidence DESC NULLS LAST, ce.linked_at DESC NULLS LAST
            LIMIT 15
            """,
            (ROLE,),
        )
        samples = cur.fetchall()
    return {
        "sunbiz_entities": sunbiz_n,
        "high_confidence_links": links_n,
        "by_method": by_method,
        "samples": samples,
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="High-confidence DBPR → Sunbiz linker")
    p.add_argument("--min-confidence", type=float, default=0.90)
    p.add_argument(
        "--allow-officer-links",
        action="store_true",
        help="Enable officer_name_zip method (off by default — too many false company links)",
    )
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    try:
        import psycopg
        from psycopg.types.json import Jsonb
    except ImportError as exc:
        raise SystemExit("pip install 'psycopg[binary]>=3.1'") from exc

    dsn = connect_dsn()
    log.info("Connecting…")
    with psycopg.connect(dsn) as conn:
        ensure_columns(conn)
        indexes = load_sunbiz_index(conn)
        if sum(len(x) for x in indexes) == 0:
            log.error("No fl_sunbiz entities loaded. Run load_sunbiz_to_postgres.py first.")
            return 1

        candidates = generate_candidates(
            conn,
            indexes,
            min_confidence=args.min_confidence,
            allow_officer_links=args.allow_officer_links,
        )
        log.info("High-confidence unique candidates: %s", len(candidates))

        # Method breakdown before write
        method_counts: dict[str, int] = defaultdict(int)
        for c in candidates:
            method_counts[c.method] += 1
        log.info("Candidate methods: %s", dict(method_counts))

        written = write_links(conn, candidates, dry_run=args.dry_run, Jsonb=Jsonb)
        log.info("Links written: %s", written)

        stats = report(conn)
        log.info("Sunbiz entities in DB: %s", stats["sunbiz_entities"])
        log.info("High-confidence links: %s", stats["high_confidence_links"])
        log.info("By method: %s", stats["by_method"])
        log.info("Sample links:")
        for s in stats["samples"][:10]:
            log.info(
                "  %s ↔ %s (%s) method=%s conf=%s city=%s",
                s[0],
                s[1],
                s[2],
                s[3],
                s[4],
                s[5],
            )

        out = ROOT / "data" / "staging" / "fl_sunbiz" / "link_summary.json"
        try:
            out.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "min_confidence": args.min_confidence,
                "dry_run": args.dry_run,
                "candidates": len(candidates),
                "written": written,
                "method_counts": dict(method_counts),
                "db": {
                    "sunbiz_entities": stats["sunbiz_entities"],
                    "high_confidence_links": stats["high_confidence_links"],
                    "by_method": [
                        {"method": m, "count": n, "avg_confidence": float(a or 0)}
                        for m, n, a in stats["by_method"]
                    ],
                    "samples": [
                        {
                            "contractor": s[0],
                            "sunbiz_name": s[1],
                            "document_number": s[2],
                            "method": s[3],
                            "confidence": float(s[4] or 0),
                            "city": s[5],
                        }
                        for s in stats["samples"]
                    ],
                },
            }
            out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
            log.info("Wrote %s", out)
        except OSError as exc:
            log.warning("Could not write link summary: %s", exc)

    log.info("Link complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
