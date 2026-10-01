"""Generate six local-only credential lookup examples from frozen certified sources."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / "data/staging/th_enrich_b1"
OUT = ROOT / "data/preview/contractor-credential-lookup.json"
MANIFEST = json.loads((ROOT / "docs/TH-ENRICH-2026-09-30-B1-source-manifest.json").read_text())
SOURCES = {item["id"]: item for item in MANIFEST["sources"]}


def staged(dataset: str):
    with (STAGE / f"{dataset}.jsonl").open(encoding="utf-8") as stream:
        yield from (json.loads(line) for line in stream)


def select(dataset: str, predicate):
    return next(row for row in staged(dataset) if predicate(row))


def record(dataset: str, row: dict, *, label: str, jurisdiction: str,
           status: str, holder: str, number: str, grain: str, credential_type: str) -> dict:
    source = SOURCES[dataset]
    return {
        "id": f"{dataset}:{row['native_key']}",
        "dataset": dataset,
        "label": label,
        "jurisdiction": jurisdiction,
        "regulator": source["authority"],
        "credential_type": credential_type,
        "native_id": number,
        "holder_text": holder,
        "registrant_text": None,
        "source_status": status,
        "source_date": source.get("as_of") or source["retrieved_at"][:10],
        "source_date_basis": "Official PDF date" if source.get("as_of") else "Snapshot retrieval date",
        "source_url": source["official_url"],
        "source_sha256": source["sha256"],
        "grain": grain,
        "canonical_business_id": None,
        "contractor_id": None,
    }


def build() -> list[dict]:
    gc = select("nyc_dob_license_info", lambda r: r["credential_class"] == "GENERAL CONTRACTOR"
                and r["raw"]["license_status"] == "ACTIVE")
    mold_active = select("ny_dol_mold", lambda r: r["raw"]["license_status"] == "Active")
    mold_expired = select("ny_dol_mold", lambda r: r["raw"]["license_status"] == "Expired")
    elevator = select("ny_elevator", lambda r: r["raw"]["license_status"] == "Active")
    elevator_expired = select("ny_elevator", lambda r: r["raw"]["license_status"] == "Expired")
    za = select("fl_dbpr_asbestos_59", lambda r: r["credential_class"] == "ZA" and
                r["raw"]["primary_status"] == "C" and r["raw"]["secondary_status"] == "A")
    nj = select("nj_dfs_fire_business", lambda r: True)
    gc_record = record("nyc_dob_license_info", gc, label="NYC General Contractor License",
               jurisdiction="New York City", status="Active", holder=gc["raw"]["business_name"],
               number=gc["native_license_number"], grain="Credential record",
               credential_type="GENERAL CONTRACTOR")
    gc_record["registrant_text"] = f"{gc['raw']['first_name']} {gc['raw']['last_name']}".strip()
    return [
        gc_record,
        *[record("ny_dol_mold", row, label="New York Mold License", jurisdiction="New York State",
                 status=row["raw"]["license_status"], holder=row["raw"]["business_name"],
                 number=row["native_license_number"], grain="Credential record",
                 credential_type=row["credential_class"]) for row in (mold_active, mold_expired)],
        record("ny_elevator", elevator, label="New York Elevator Contractor License",
               jurisdiction="New York State", status="Active", holder=elevator["raw"]["business_name"],
               number=elevator["native_license_number"], grain="Credential record",
               credential_type=elevator["credential_class"]),
        record("ny_elevator", elevator_expired, label="New York Elevator Contractor License",
               jurisdiction="New York State", status="Expired", holder=elevator_expired["raw"]["business_name"],
               number=elevator_expired["native_license_number"], grain="Credential record",
               credential_type=elevator_expired["credential_class"]),
        record("fl_dbpr_asbestos_59", za, label="Florida Asbestos Business License",
               jurisdiction="Florida", status="Current; Active reported",
               holder=za["raw"]["licensee_name"], number=za["native_license_number"],
               grain="Source-native business license", credential_type="ZA — Asbestos Business"),
        record("nj_dfs_fire_business", nj, label="NJ Fire Protection Permit",
               jurisdiction="New Jersey", status="Current status not established",
               holder=nj["business_name_raw"], number=nj["native_permit_number"],
               grain="Permit evidence", credential_type="Fire protection equipment business permit"),
    ]


if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(build(), indent=2) + "\n", encoding="utf-8")
    print(OUT)
