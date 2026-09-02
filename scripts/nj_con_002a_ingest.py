#!/usr/bin/env python3
"""NJ-CON-002A dry-run ingest: specialty lists + Safe House/OCP enforcement."""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ingest.adapters.nj_con_002a import (  # noqa: E402
    parse_ascm_text,
    parse_fire_text,
    parse_lead_text,
    parse_ocp_csv,
    parse_safe_house_csv,
    related_docket_links,
    sha256_file,
)
from ingest.nj_identity_match import apply_matches, build_license_index, load_license_csv  # noqa: E402

RAW = ROOT / "data" / "raw" / "nj_con_002a"
SAMPLES = ROOT / "data" / "samples" / "nj_con_002a"
OUT = ROOT / "data" / "staging" / "nj_con_002a"
ART = ROOT / "artifacts"


def _text(pdf_stem: str) -> str:
    txt = RAW / f"{pdf_stem}.txt"
    if txt.exists():
        return txt.read_text(encoding="utf-8")
    return ""


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    families = {}

    eval_txt = _text("ld_eval_contrs.pdf")
    abate_txt = _text("ld_abat_c.pdf")
    ascm_txt = _text("asmlist_list.pdf")
    fire_txt = _text("fire_protection_permitted_business.pdf")

    families["NJ_LEAD_EVALUATION"] = parse_lead_text(eval_txt, source_family="NJ_LEAD_EVALUATION", source_date="2026-08-11") if eval_txt else []
    families["NJ_LEAD_ABATEMENT"] = parse_lead_text(abate_txt, source_family="NJ_LEAD_ABATEMENT", source_date="2026-07-15") if abate_txt else []
    families["NJ_ASCM_AUTHORIZATION"] = parse_ascm_text(ascm_txt, source_date="2026-07-30") if ascm_txt else []
    families["NJ_FIRE_PROTECTION_PERMIT"] = parse_fire_text(fire_txt, source_date="2026-07-02") if fire_txt else []
    families["NJ_OPERATION_SAFE_HOUSE"] = parse_safe_house_csv(SAMPLES / "safe_house_hic.csv")
    families["NJ_OCP_LEGAL_FILING"] = parse_ocp_csv(SAMPLES / "ocp_filings_sample.csv")
    families["NJ_NEW_HOME_BUILDER"] = []
    families["NJ_HEC_REGISTRATION"] = []
    families["NJ_BOARD_ACTION"] = []

    lic_path = Path(r"C:\Users\Michael.Savitsky\contractor-trust-hub\data\staging\nj_mylicense_sample\nj_mylicense_db_only.csv")
    licenses = load_license_csv(lic_path) if lic_path.exists() else load_license_csv(ROOT / "data/samples/nj_dca_hic_sample.csv")
    index = build_license_index(licenses)

    summary = {"ticket": "NJ-CON-002A", "license_index_size": index.size, "families": {}, "blockers": []}
    for fam, rows in families.items():
        ledgers = apply_matches(rows, index) if rows else {k: [] for k in ("exact", "high_confidence", "review_required", "conflict", "unresolved")}
        summary["families"][fam] = {
            "parsed": len(rows),
            "distinct_ids": len({r.get("certificate_or_vendor_id") or r["source_observation_key"] for r in rows}),
            "exact": len(ledgers["exact"]),
            "high_confidence": len(ledgers["high_confidence"]),
            "review_required": len(ledgers["review_required"]),
            "conflicts": len(ledgers["conflict"]),
            "unresolved": len(ledgers["unresolved"]),
        }
        (OUT / f"{fam.lower()}_normalized.jsonl").write_text(
            "\n".join(json.dumps(r, default=str) for r in rows), encoding="utf-8"
        )
    summary["ocp_related_dockets"] = related_docket_links(families["NJ_OCP_LEGAL_FILING"])
    summary["blockers"] = [
        "NJ_NEW_HOME_BUILDER: official list now a DCA Service Portal lookup (https://serviceportal.dca.nj.gov/ultra-bhp-home/bhp-home-builder-search/), brlist.pdf 404. No deterministic full-file export.",
        "NJ_HEC_REGISTRATION: not present in the 87,355 nj_dca credential dump; no current official standalone HEC roster acquired (disaster-recovery program lists are not the HEC registration export).",
        "NJ_BOARD_ACTION: no official bulk contractor-board action index acquired; OCP legal filings indexed from published PDFs only.",
        "Production database execution pending (no authorized session).",
    ]
    hashes = {}
    for p in RAW.glob("*.pdf"):
        hashes[p.name] = {"sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "bytes": p.stat().st_size}
    summary["source_files"] = hashes
    (ART / "nj-con-002a-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps({k: v["parsed"] for k, v in summary["families"].items()}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
