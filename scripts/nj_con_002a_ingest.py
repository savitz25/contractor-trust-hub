#!/usr/bin/env python3
"""NJ-CON-002A dry-run ingest: specialty lists + Safe House/OCP enforcement.

Persists through official_source_* (not licenses, not discipline_actions).
Unacquired families emit coverage records only — never zero-valued observations.
Default is dry-run. --execute requires an authorized database session.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ingest.adapters.nj_con_002a import (  # noqa: E402
    FAMILY_COVERAGE,
    coverage_record,
    observations_allowed,
    parse_ascm_text,
    parse_fire_text,
    parse_lead_text,
    parse_ocp_csv,
    parse_safe_house_csv,
    related_docket_links,
)
from ingest.adapters.nj_public_works import (  # noqa: E402
    SOURCE_COVERAGE_NOT_ACQUIRED,
    SOURCE_COVERAGE_PARTIAL,
)
from ingest.env import load_dotenv_files, normalize_database_url  # noqa: E402
from ingest.nj_identity_match import apply_matches, build_license_index, load_license_csv  # noqa: E402
from ingest.official_source_persist import persist_official_source  # noqa: E402

RAW = ROOT / "data" / "raw" / "nj_con_002a"
SAMPLES = ROOT / "data" / "samples" / "nj_con_002a"
OUT = ROOT / "data" / "staging" / "nj_con_002a"
ART = ROOT / "artifacts"


def _text(pdf_stem: str) -> str:
    txt = RAW / f"{pdf_stem}.txt"
    if txt.exists():
        return txt.read_text(encoding="utf-8")
    return ""


def connect():
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        return None
    url = normalize_database_url(url)
    try:
        import psycopg
    except ImportError:
        return None
    try:
        return psycopg.connect(url, connect_timeout=10)
    except Exception:
        return None


def load_acquired_rows() -> dict[str, list[dict[str, Any]]]:
    families: dict[str, list[dict[str, Any]]] = {}
    eval_txt = _text("ld_eval_contrs.pdf")
    abate_txt = _text("ld_abat_c.pdf")
    ascm_txt = _text("asmlist_list.pdf")
    fire_txt = _text("fire_protection_permitted_business.pdf")
    families["NJ_LEAD_EVALUATION"] = (
        parse_lead_text(eval_txt, source_family="NJ_LEAD_EVALUATION", source_date="2026-08-11") if eval_txt else []
    )
    families["NJ_LEAD_ABATEMENT"] = (
        parse_lead_text(abate_txt, source_family="NJ_LEAD_ABATEMENT", source_date="2026-07-15") if abate_txt else []
    )
    families["NJ_ASCM_AUTHORIZATION"] = parse_ascm_text(ascm_txt, source_date="2026-07-30") if ascm_txt else []
    families["NJ_FIRE_PROTECTION_PERMIT"] = parse_fire_text(fire_txt, source_date="2026-07-02") if fire_txt else []
    families["NJ_OPERATION_SAFE_HOUSE"] = parse_safe_house_csv(SAMPLES / "safe_house_hic.csv")
    families["NJ_OCP_LEGAL_FILING"] = parse_ocp_csv(SAMPLES / "ocp_filings_sample.csv")
    return families


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--licenses-csv", default="")
    args = parser.parse_args(argv)
    dry_run = not args.execute

    OUT.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)

    acquired = load_acquired_rows()
    lic_path = Path(args.licenses_csv) if args.licenses_csv else Path(
        r"C:\Users\Michael.Savitsky\contractor-trust-hub\data\staging\nj_mylicense_sample\nj_mylicense_db_only.csv"
    )
    licenses = load_license_csv(lic_path) if lic_path.exists() else load_license_csv(ROOT / "data/samples/nj_dca_hic_sample.csv")
    index = build_license_index(licenses)
    conn = connect()
    db_blocker = None
    if conn is None:
        db_blocker = (
            "No authorized database session (DATABASE_URL missing or connection failed). "
            "Code/migrations/tests complete; production ingest not executed."
        )

    summary: dict[str, Any] = {
        "ticket": "NJ-CON-002A",
        "license_index_size": index.size,
        "publication_status": "internal_only",
        "existing_nj_dca_credentials_reingested": False,
        "families": {},
        "source_coverage": {},
        "blockers": [],
    }

    for fam, meta in FAMILY_COVERAGE.items():
        rec = coverage_record(fam)
        if not observations_allowed(fam):
            rec["parsed"] = None
            rec["exact"] = None
            rec["high_confidence"] = None
            rec["review_required"] = None
            rec["conflicts"] = None
            rec["unresolved"] = None
            rec["observations_written"] = 0
            rec["jsonl_written"] = False
            persist_official_source(
                conn,
                fam,
                {
                    fam: {
                        "agency": meta.get("agency"),
                        "url": meta.get("url"),
                        "page": meta.get("url"),
                        "source_as_of": meta.get("source_as_of"),
                        "sha256": None,
                        "barrier": meta.get("barrier"),
                        "source_coverage": SOURCE_COVERAGE_NOT_ACQUIRED,
                        "schema_fingerprint": "source_not_acquired",
                    }
                },
                [],
                dry_run=dry_run,
                source_system="nj_con_002a",
                notes=meta.get("barrier") or "SOURCE_NOT_ACQUIRED",
                source_coverage=SOURCE_COVERAGE_NOT_ACQUIRED,
            )
            summary["families"][fam] = rec
            summary["source_coverage"][fam] = rec["source_coverage"]
            continue

        rows = acquired.get(fam) or []
        ledgers = apply_matches(rows, index) if rows else {
            k: [] for k in ("exact", "high_confidence", "review_required", "conflict", "unresolved")
        }
        rec.update(
            {
                "parsed": len(rows),
                "distinct_ids": len({r.get("certificate_or_vendor_id") or r["source_observation_key"] for r in rows}),
                "exact": len(ledgers["exact"]),
                "high_confidence": len(ledgers["high_confidence"]),
                "review_required": len(ledgers["review_required"]),
                "conflicts": len(ledgers["conflict"]),
                "unresolved": len(ledgers["unresolved"]),
                "observations_written": len(rows),
                "jsonl_written": True,
                "public_eligibility_status": "internal_only",
                "persisted_to_licenses": False,
                "persisted_to_discipline_actions": False,
                "production_table": "official_source_observations",
            }
        )
        (OUT / f"{fam.lower()}_normalized.jsonl").write_text(
            "\n".join(json.dumps(r, default=str) for r in rows), encoding="utf-8"
        )
        persist_official_source(
            conn,
            fam,
            {
                fam: {
                    "agency": meta.get("agency"),
                    "url": meta.get("url"),
                    "page": meta.get("url"),
                    "source_as_of": meta.get("source_as_of"),
                    "sha256": None,
                    "local_raw_path": None,
                    "schema_fingerprint": hashlib.sha256(fam.encode()).hexdigest(),
                    "source_coverage": meta["coverage"],
                }
            },
            rows,
            dry_run=dry_run,
            source_system="nj_con_002a",
            notes=meta.get("note") or fam,
            source_coverage=meta["coverage"],
        )
        summary["families"][fam] = rec
        summary["source_coverage"][fam] = rec["source_coverage"]

    ocp_rows = acquired.get("NJ_OCP_LEGAL_FILING") or []
    summary["ocp_related_dockets"] = related_docket_links(ocp_rows)
    summary["ocp_cannot_support_absence_claim"] = True
    summary["blockers"] = [
        FAMILY_COVERAGE["NJ_NEW_HOME_BUILDER"]["barrier"],
        FAMILY_COVERAGE["NJ_HEC_REGISTRATION"]["barrier"],
        FAMILY_COVERAGE["NJ_BOARD_ACTION"]["barrier"],
        FAMILY_COVERAGE["NJ_PWCR_REGISTRATION"]["barrier"],
        FAMILY_COVERAGE["NJ_PREVAILING_WAGE_DEBARMENT"]["barrier"],
    ]
    if db_blocker:
        summary["blockers"].append(db_blocker)
        summary["production_ingest_status"] = "pending"
    else:
        summary["production_ingest_status"] = "executed" if args.execute else "dry_run"
    hashes = {}
    if RAW.exists():
        for p in RAW.glob("*.pdf"):
            hashes[p.name] = {"sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "bytes": p.stat().st_size}
    summary["source_files"] = hashes
    (ART / "nj-con-002a-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    parsed_view = {
        k: (v.get("parsed") if v.get("source_coverage") != SOURCE_COVERAGE_NOT_ACQUIRED else "SOURCE_NOT_ACQUIRED")
        for k, v in summary["families"].items()
    }
    print(json.dumps(parsed_view, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
