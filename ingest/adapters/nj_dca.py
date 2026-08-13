"""
New Jersey DCA / Home Improvement Contractor (HIC) + specialty board adapter.

Normalizes official bulk registration extracts into the shared Trust Hub license schema.
Does NOT force Florida DBPR field semantics. Prefer free DCA Standard Files / MyLicense
bulk CSVs — do not scrape the interactive verification portal.

NJ reality:
  - No single statewide general contractor license
  - Home Improvement Contractor (HIC) is the primary residential consumer credential
  - Specialty boards (Electrical, Plumbing, HVACR, etc.) are separate when bulk exists
  - Business entity linkage is high-confidence only (not name-only)

Usage:
  python scripts/download_nj_dca.py --from-file path/to/official_bulk.csv
  python -m ingest.adapters.nj_dca --input data/samples/nj_dca_hic_sample.csv
  python -m ingest.adapters.nj_dca --input data/raw/nj_dca/registrations.csv --out-dir data/staging/nj_dca

Source matrix (ops):
  - Primary: NJ DCA free bulk / Standard Files (HIC first)
  - Specialty: Electrical, Plumbing, HVAC when clean bulk files exist
  - Entity: NJ business records (optional high-confidence only)
  - Enforcement: flag fields when present; full case files may lag

Docs: docs/DATA_SOURCES_NJ.md · docs/NEW_JERSEY_VERIFY_V1.md
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

SOURCE_SYSTEM = "nj_dca"
SOURCE_BOARD = "NJ_DCA"
SOURCE_URL = "https://www.njconsumeraffairs.gov/"
SOURCE_DATASET = "contractor_hic_registration"

LICENSE_OUT_FIELDS = [
    "source_system",
    "source_board",
    "external_key",
    "occupation_code",
    "occupation_description",
    "license_number",
    "class_code",
    "licensee_name_raw",
    "dba_name_raw",
    "primary_status",
    "secondary_status",
    "status_normalized",
    "original_licensure_date",
    "effective_date",
    "expiration_date",
    "address_line_1",
    "address_line_2",
    "address_line_3",
    "city",
    "state",
    "postal_code",
    "county_code",
    "county_name",
    "board_number",
    "raw_payload_json",
]

CONTRACTOR_SEED_FIELDS = [
    "slug",
    "display_name",
    "legal_name",
    "dba_name",
    "home_state",
    "primary_city",
    "primary_county",
    "license_external_key",
    "owner_name",
]

ENTITY_OUT_FIELDS = [
    "source_system",
    "external_key",
    "legal_name",
    "name_normalized",
    "entity_type",
    "status",
    "formation_date",
    "principal_address",
    "city",
    "state",
    "postal_code",
    "county_name",
    "registered_agent_name",
    "officers_json",
    "contractor_slug",
    "match_method",
    "confidence",
    "role",
]

ENFORCEMENT_OUT_FIELDS = [
    "source_system",
    "source_dataset",
    "external_key",
    "complaint_number",
    "license_type",
    "license_number_raw",
    "respondent_name",
    "classification",
    "entered_date",
    "disposition",
    "disposition_date",
    "discipline_description",
    "violation_code",
    "city",
    "state",
    "postal_code",
    "county_name",
    "contractor_slug",
    "raw_payload_json",
]

OCCUPATION_MAP = {
    "HIC": ("HIC", "Home Improvement Contractor"),
    "HOME IMPROVEMENT CONTRACTOR": ("HIC", "Home Improvement Contractor"),
    "HOME IMPROVEMENT": ("HIC", "Home Improvement Contractor"),
    "HOME IMPROVEMENT CONTRACTOR REGISTRATION": ("HIC", "Home Improvement Contractor"),
    "HOME IMPROVEMENT BUSINESS CONTR": ("HIC", "Home Improvement Contractor"),
    "HOME ELEVATION BUSINESS CONTR": ("HIC", "Home Elevation Contractor (NJ)"),
    "ELE": ("ELE", "Electrical Contractor (NJ)"),
    "ELECTRICAL": ("ELE", "Electrical Contractor (NJ)"),
    "ELECTRICAL CONTRACTOR": ("ELE", "Electrical Contractor (NJ)"),
    "ELECTRICAL BUSINESS PERMIT": ("ELE", "Electrical Business Permit (NJ)"),
    "TEL": ("TEL", "Telecom Contractor (NJ)"),
    "TELECOM": ("TEL", "Telecom Contractor (NJ)"),
    "TELECOM CONTRACTOR": ("TEL", "Telecom Contractor (NJ)"),
    "ALM": ("ALM", "Alarm Contractor (NJ)"),
    "ALARM": ("ALM", "Alarm Contractor (NJ)"),
    "BURGLAR ALARM": ("ALM", "Alarm Contractor (NJ)"),
    "FIRE ALARM": ("ALM", "Alarm Contractor (NJ)"),
    "LCK": ("LCK", "Locksmith (NJ)"),
    "LOCKSMITH": ("LCK", "Locksmith (NJ)"),
    "PLB": ("PLB", "Master Plumber (NJ)"),
    "PLUMBING": ("PLB", "Master Plumber (NJ)"),
    "PLUMBING CONTRACTOR": ("PLB", "Master Plumber (NJ)"),
    "MASTER PLUMBER": ("PLB", "Master Plumber (NJ)"),
    "HVAC": ("HVAC", "Master HVACR Contractor (NJ)"),
    "HVACR": ("HVAC", "Master HVACR Contractor (NJ)"),
    "MASTER HVACR": ("HVAC", "Master HVACR Contractor (NJ)"),
    "MECHANICAL": ("HVAC", "Master HVACR Contractor (NJ)"),
    "HEATING": ("HVAC", "Master HVACR Contractor (NJ)"),
    "HRT": ("HRT", "Master Hearth Specialist (NJ)"),
    "HEARTH": ("HRT", "Master Hearth Specialist (NJ)"),
    "MASTER HEARTH": ("HRT", "Master Hearth Specialist (NJ)"),
    "GEN": ("GEN", "General contractor registration (NJ)"),
    "GENERAL": ("GEN", "General contractor registration (NJ)"),
}

# Official bulk exports often use Title Case / spaced headers.
# Map normalized header → canonical snake keys used in transform_row.
HEADER_ALIASES: dict[str, str] = {
    "registration_number": "registration_number",
    "registration number": "registration_number",
    "registration_no": "registration_number",
    "registration no": "registration_number",
    "reg_number": "registration_number",
    "reg number": "registration_number",
    "license_number": "license_number",
    "license number": "license_number",
    "license_no": "license_number",
    "license no": "license_number",
    "licensenumber": "license_number",
    "lic #": "license_number",
    "lic#": "license_number",
    "external_key": "external_key",
    "credential_type": "credential_type",
    "credential type": "credential_type",
    "license_type": "license_type",
    "license type": "license_type",
    "license type name": "license_type",
    "profession": "license_type",
    "board": "license_type",
    "business_name": "business_name",
    "business name": "business_name",
    "company_name": "business_name",
    "company name": "business_name",
    "organization_name": "business_name",
    "organization name": "business_name",
    "dba": "business_name",
    "dba name": "business_name",
    "licensee_name": "business_name",
    "licensee name": "business_name",
    "name": "business_name",
    "owner_name": "owner_name",
    "owner name": "owner_name",
    "principal_name": "owner_name",
    "principal name": "owner_name",
    "contact_name": "owner_name",
    "contact name": "owner_name",
    "first_name": "first_name",
    "first name": "first_name",
    "last_name": "last_name",
    "last name": "last_name",
    "status": "status",
    "license_status": "status",
    "license status": "status",
    "registration_status": "status",
    "registration status": "status",
    "expiration_date": "expiration_date",
    "expiration date": "expiration_date",
    "license_expiration_date": "expiration_date",
    "license expiration date": "expiration_date",
    "exp_date": "expiration_date",
    "exp date": "expiration_date",
    "address_line1": "address_line1",
    "address_line_1": "address_line1",
    "address line 1": "address_line1",
    "address1": "address_line1",
    "street_address": "address_line1",
    "street address": "address_line1",
    "address": "address_line1",
    "address_line2": "address_line2",
    "address_line_2": "address_line2",
    "address line 2": "address_line2",
    "address2": "address_line2",
    "city": "city",
    "state": "state",
    "postal_code": "postal_code",
    "zip": "postal_code",
    "zip_code": "postal_code",
    "zip code": "postal_code",
    "zipcode": "postal_code",
    "county": "county",
    "county_name": "county",
    "county name": "county",
    "phone": "phone",
    "telephone": "phone",
    "business_phone": "phone",
    "business phone": "phone",
    "enforcement_flag": "enforcement_flag",
    "enforcement flag": "enforcement_flag",
    "entity_key": "entity_key",
    "entity key": "entity_key",
    "entity_name": "entity_name",
    "entity name": "entity_name",
    "entity_status": "entity_status",
    "entity status": "entity_status",
    "entity_formation_date": "entity_formation_date",
    "entity formation date": "entity_formation_date",
    "principal_title": "principal_title",
    "principal title": "principal_title",
    "enforcement_case": "enforcement_case",
    "enforcement case": "enforcement_case",
    "enforcement_disposition": "enforcement_disposition",
    "enforcement disposition": "enforcement_disposition",
    "enforcement_date": "enforcement_date",
    "enforcement date": "enforcement_date",
    "enforcement_summary": "enforcement_summary",
    "enforcement summary": "enforcement_summary",
}


def _clean(value: str | None) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_header(name: str) -> str:
    h = _clean(name).lower()
    h = re.sub(r"[\s_]+", " ", h).strip()
    return HEADER_ALIASES.get(h, h.replace(" ", "_"))


def _canonicalize_row(raw: dict[str, str]) -> dict[str, str]:
    """Map bulk-export headers (Title Case, spaces) to snake_case keys."""
    out: dict[str, str] = {}
    for k, v in raw.items():
        if k is None:
            continue
        key = _normalize_header(str(k))
        val = _clean(v) if isinstance(v, str) else _clean(str(v) if v is not None else "")
        # Prefer first non-empty value if duplicate aliases map to same key
        if key in out and out[key] and not val:
            continue
        if key in out and out[key] and val:
            continue
        out[key] = val
    # Compose owner from first/last when owner_name empty
    if not out.get("owner_name"):
        first = out.get("first_name") or ""
        last = out.get("last_name") or ""
        composed = " ".join(p for p in (first, last) if p).strip()
        if composed:
            out["owner_name"] = composed
    return out


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def slugify(*parts: str) -> str:
    raw = "-".join(p for p in parts if p)
    s = re.sub(r"[^a-zA-Z0-9]+", "-", raw.lower()).strip("-")
    return s[:120] if s else "unknown"


def normalize_status(raw: str) -> str:
    """Map board status text → product status_normalized.

    Important: check inactive tokens before 'active' so 'Inactive' is not
    misclassified (substring of 'active').
    """
    h = _clean(raw).lower()
    if not h:
        return "unknown"
    # Non-active / caution first (substring-safe ordering)
    inactive_tokens = (
        "inactive",
        "expired",
        "lapsed",
        "suspended",
        "revoked",
        "cancelled",
        "canceled",
        "closed",
        "deceased",
        "retired",
        "out of business",
        "voluntary surrender",
        "terminated",
        "surrender",
        "dissolved",
    )
    if any(tok in h for tok in inactive_tokens):
        return "inactive"
    if h in {"active", "current", "valid", "registered"} or h.startswith("active "):
        return "active"
    if "pending" in h:
        return "unknown"
    if h == "active" or h.startswith("active"):
        return "active"
    return "unknown"


def occupation_for(credential_type: str) -> tuple[str, str]:
    key = _clean(credential_type).upper()
    if key in OCCUPATION_MAP:
        return OCCUPATION_MAP[key]
    # free text contains
    for k, v in OCCUPATION_MAP.items():
        if k in key:
            return v
    return ("GEN", credential_type or "New Jersey contractor registration")


def compose_external_key(registration_number: str, occupation_code: str) -> str | None:
    num = re.sub(r"[^A-Za-z0-9-]", "", _clean(registration_number).upper())
    if not num:
        return None
    if num.startswith("NJ-"):
        return num
    return f"NJ-{occupation_code}:{num}"


def transform_row(raw_in: dict[str, str]) -> dict[str, Any] | None:
    raw = _canonicalize_row(raw_in)
    reg = (
        _clean(raw.get("registration_number"))
        or _clean(raw.get("license_number"))
        or _clean(raw.get("external_key"))
    )
    credential_type = _clean(raw.get("credential_type")) or _clean(raw.get("license_type")) or "HIC"
    occ_code, occ_desc = occupation_for(credential_type)
    external_key = compose_external_key(reg, occ_code)
    if not external_key:
        return None

    business = _clean(raw.get("business_name"))
    owner = _clean(raw.get("owner_name"))
    licensee = business or owner
    if not licensee:
        return None

    status_raw = _clean(raw.get("status"))
    status = normalize_status(status_raw)
    city = _clean(raw.get("city"))
    county = _clean(raw.get("county"))
    display = business or owner
    slug = slugify("nj", external_key, display)

    exp = _clean(raw.get("expiration_date"))
    # normalize M/D/Y if needed
    if exp and "/" in exp:
        for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
            try:
                exp = datetime.strptime(exp, fmt).date().isoformat()
                break
            except ValueError:
                continue

    enforcement = _clean(raw.get("enforcement_flag")).upper() in {"Y", "YES", "1", "TRUE"}
    # Search blob includes business + principal so name search finds either
    name_blob = " ".join(p for p in (business, owner) if p).strip() or licensee
    addr1 = _clean(raw.get("address_line1") or raw.get("address_line_1"))
    postal = _clean(raw.get("postal_code") or raw.get("zip"))[:10]
    state_code = (_clean(raw.get("state")) or "NJ")[:2].upper()
    principal_title = _clean(raw.get("principal_title")) or "Principal"

    entity_key = _clean(raw.get("entity_key"))
    entity_name = _clean(raw.get("entity_name")) or business
    entity_status = _clean(raw.get("entity_status")) or ""
    entity_formation = _clean(raw.get("entity_formation_date"))

    enf_case = _clean(raw.get("enforcement_case"))
    enf_disp = _clean(raw.get("enforcement_disposition"))
    enf_date = _clean(raw.get("enforcement_date"))
    enf_summary = _clean(raw.get("enforcement_summary"))

    return {
        "source_system": SOURCE_SYSTEM,
        "source_board": SOURCE_BOARD,
        "external_key": external_key,
        "occupation_code": occ_code,
        "occupation_description": occ_desc,
        "license_number": reg,
        "class_code": credential_type,
        # Include owner so name search matches principals without weak fuzzy logic
        "licensee_name_raw": name_blob,
        "dba_name_raw": owner if owner and owner != business else "",
        "display_name": display,
        "slug": slug,
        "primary_status": status_raw or status,
        "secondary_status": "enforcement_flag" if enforcement else "",
        "status_normalized": status,
        "original_licensure_date": "",
        "effective_date": "",
        "expiration_date": exp,
        "address_line_1": addr1,
        "address_line_2": _clean(raw.get("address_line2") or raw.get("address_line_2")),
        "address_line_3": "",
        "city": city,
        "state": state_code,
        "postal_code": postal,
        "county_code": "",
        "county_name": county,
        "board_number": SOURCE_BOARD,
        "raw_payload_json": json.dumps(raw, ensure_ascii=False),
        "enforcement_flag": enforcement,
        "home_state": "NJ",
        "primary_city": city,
        "primary_county": county,
        "license_external_key": external_key,
        "legal_name": business or owner,
        "dba_name": owner if owner and owner != business else "",
        "owner_name": owner,
        # Entity seed (high-confidence only when keys present)
        "entity_key": entity_key,
        "entity_name": entity_name if entity_key else "",
        "entity_status": entity_status,
        "entity_formation_date": entity_formation,
        "principal_title": principal_title,
        "principal_address": addr1,
        # Enforcement
        "enforcement_case": enf_case,
        "enforcement_disposition": enf_disp,
        "enforcement_date": enf_date,
        "enforcement_summary": enf_summary,
    }


def iter_csv(path: Path) -> Iterator[dict[str, str]]:
    # utf-8-sig strips Excel/PowerShell BOM so first header still maps
    with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield {
                (k or ""): (v or "").strip() if isinstance(v, str) else ""
                for k, v in row.items()
                if k is not None
            }


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})


def run(input_path: Path, out_dir: Path, limit: int | None = None) -> dict[str, Any]:
    rows_in = list(iter_csv(input_path))
    if limit:
        rows_in = rows_in[:limit]

    licenses: list[dict[str, Any]] = []
    seeds: list[dict[str, Any]] = []
    entities: list[dict[str, Any]] = []
    enforcement: list[dict[str, Any]] = []
    seen_keys: set[str] = set()

    for raw in rows_in:
        t = transform_row(raw)
        if not t:
            continue
        key = t["external_key"]
        if key in seen_keys:
            continue
        seen_keys.add(key)
        licenses.append(t)
        seeds.append({k: t.get(k, "") for k in CONTRACTOR_SEED_FIELDS})

        # High-confidence entity only when stable entity_key present
        if t.get("entity_key") and t.get("entity_name"):
            officers = []
            if t.get("owner_name"):
                officers.append(
                    {
                        "title": t.get("principal_title") or "Principal",
                        "name": t["owner_name"],
                        "city": t.get("city") or "",
                        "state": t.get("state") or "NJ",
                    }
                )
            name_norm = re.sub(r"[^A-Z0-9 ]", "", t["entity_name"].upper())
            name_norm = re.sub(r"\s+", " ", name_norm).strip()
            entities.append(
                {
                    "source_system": "nj_sos",
                    "external_key": t["entity_key"],
                    "legal_name": t["entity_name"],
                    "name_normalized": name_norm,
                    "entity_type": "business",
                    "status": t.get("entity_status") or "unknown",
                    "formation_date": t.get("entity_formation_date") or "",
                    "principal_address": t.get("principal_address") or t.get("address_line_1") or "",
                    "city": t.get("city") or "",
                    "state": t.get("state") or "NJ",
                    "postal_code": t.get("postal_code") or "",
                    "county_name": t.get("county_name") or "",
                    "registered_agent_name": "",
                    "officers_json": json.dumps(officers, ensure_ascii=False),
                    "contractor_slug": t["slug"],
                    "match_method": "exact_registration_entity_key",
                    "confidence": "0.95",
                    "role": "linked",
                }
            )

        if t.get("enforcement_flag") and (t.get("enforcement_case") or t.get("enforcement_disposition")):
            enf_key = t.get("enforcement_case") or f"ENF-{t['external_key']}"
            enforcement.append(
                {
                    "source_system": "nj_enforcement",
                    "source_dataset": "public_actions",
                    "external_key": enf_key,
                    "complaint_number": t.get("enforcement_case") or "",
                    "license_type": t.get("occupation_code") or "",
                    "license_number_raw": t.get("license_number") or "",
                    "respondent_name": t.get("display_name") or "",
                    "classification": "public_action",
                    "entered_date": t.get("enforcement_date") or "",
                    "disposition": t.get("enforcement_disposition") or "",
                    "disposition_date": t.get("enforcement_date") or "",
                    "discipline_description": t.get("enforcement_summary")
                    or "Public enforcement record present in extract.",
                    "violation_code": "",
                    "city": t.get("city") or "",
                    "state": t.get("state") or "NJ",
                    "postal_code": t.get("postal_code") or "",
                    "county_name": t.get("county_name") or "",
                    "contractor_slug": t["slug"],
                    "raw_payload_json": json.dumps(
                        {
                            "case": t.get("enforcement_case"),
                            "disposition": t.get("enforcement_disposition"),
                            "date": t.get("enforcement_date"),
                            "summary": t.get("enforcement_summary"),
                        },
                        ensure_ascii=False,
                    ),
                }
            )

    out_dir.mkdir(parents=True, exist_ok=True)
    lic_path = out_dir / "licenses_normalized.csv"
    seed_path = out_dir / "contractor_seeds.csv"
    ent_path = out_dir / "entities_normalized.csv"
    enf_path = out_dir / "enforcement_normalized.csv"
    write_csv(lic_path, LICENSE_OUT_FIELDS, licenses)
    write_csv(seed_path, CONTRACTOR_SEED_FIELDS, seeds)
    write_csv(ent_path, ENTITY_OUT_FIELDS, entities)
    write_csv(enf_path, ENFORCEMENT_OUT_FIELDS, enforcement)

    manifest = {
        "source_system": SOURCE_SYSTEM,
        "source_dataset": SOURCE_DATASET,
        "source_url": SOURCE_URL,
        "source_file": str(input_path),
        "checksum_sha256": _sha256_file(input_path),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "row_count": len(licenses),
        "entity_count": len(entities),
        "enforcement_count": len(enforcement),
        "notes": (
            "NJ DCA HIC + specialty boards — no statewide GC. "
            "Registration + optional high-confidence entity/enforcement."
        ),
        "field_gaps": [
            "No single statewide general contractor license in New Jersey",
            "Entity links only when entity_key present (no name-only joins)",
            "Enforcement is extract-level factual rows — not full case files",
            "Municipal-only credentials may be absent",
            "Permit/activity history out of scope for NJ Verify v1",
            "Specialty board coverage depends on available free bulk files",
        ],
        "matching_strategy": "exact registration/license key first; entity exact key only; no name-only auto-join",
        "coverage": "HIC primary; ELE/PLB/HVAC when present in extract",
    }
    (out_dir / "batch_manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    return manifest


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Normalize NJ DCA / HIC registration extracts")
    p.add_argument("--input", required=True, type=Path)
    p.add_argument("--out-dir", type=Path, default=Path("data/staging/nj_dca"))
    p.add_argument("--limit", type=int, default=None)
    args = p.parse_args(argv)

    if not args.input.exists():
        print(f"Input not found: {args.input}", file=sys.stderr)
        return 1

    manifest = run(args.input, args.out_dir, args.limit)
    print(f"Wrote {manifest['row_count']} licenses → {args.out_dir}")
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
