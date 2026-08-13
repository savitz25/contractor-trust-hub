"""
Convert official NJ DCA MLO Standard Files (%-delimited) into adapter-ready CSV.

Sources (Box Standard Files — free official bulk):
  - Facilities active: HIC (not present in facilities all-status file)
  - Facilities all-status: Electrical business classes (Active + Expired/Inactive/…)
  - Individuals all-status: Electrical Contractor, Master Plumber, Master HVACR,
    alarm / locksmith person licenses, Master Hearth (Active + non-active)

Does not invent statewide GC coverage. Skips apprentices, CE sponsors, and
non-construction boards.
"""

from __future__ import annotations

import argparse
import csv
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

RAW = Path("data/raw/nj_dca")

OUT_FIELDS = [
    "registration_number",
    "license_number",
    "credential_type",
    "license_type",
    "business_name",
    "owner_name",
    "status",
    "expiration_date",
    "issue_date",
    "address_line1",
    "address_line2",
    "city",
    "state",
    "postal_code",
    "county",
    "phone",
    "email",
    "profession_name",
    "source_file",
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

DISCIPLINE_FLAG_DESC = (
    "DCA Standard Files bulk extract marks this registration with a public discipline flag. "
    "Case detail, disposition text, and dates are not published in this file. "
    "Confirm full enforcement history on the official DCA / MyLicense site. "
    "Absence of a flag is not a clearance."
)

# Prefer latest-dated file matching pattern
def _pick(pattern: str) -> Path | None:
    matches = sorted(RAW.glob(pattern), key=lambda p: p.name)
    return matches[-1] if matches else None


def parse_oracle_date(s: str) -> str:
    s = (s or "").strip()
    if not s:
        return ""
    for fmt in ("%d-%b-%y", "%d-%b-%Y", "%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return s


def pad(cols: list[str], n: int = 25) -> list[str]:
    if len(cols) < n:
        return cols + [""] * (n - len(cols))
    return cols[:n]


def map_facility(profession: str, license_type: str, *, hic_only: bool = False) -> str | None:
    """Map facility board rows to product occupation codes."""
    p, t = profession.strip().upper(), license_type.strip().upper()
    t = re.sub(r"\s+", " ", t).strip()

    if "HOME IMPROVEMENT" in p:
        # HIC board family (business contr + elevation)
        return "HIC"
    if hic_only:
        return None

    if "ELECTRICAL" in p:
        if "ELECTRICAL BUSINESS" in t:
            return "ELE"
        if "TELECOM CONTRACTOR" in t:
            return "TEL"  # Telecom contractor (facility)
        if "BURGLAR ALARM BUSINESS" in t or "FIRE ALARM BUSINESS" in t:
            return "ALM"
        if "LOCKSMITH BUSINESS" in t:
            return "LCK"
        if "BA AND FA BUSINESS" in t or "BA AND LS BUSINESS" in t or "FA AND LS BUSINESS" in t:
            return "ALM"
        if "FBL BUSINESS" in t:
            return "ALM"
        # Skip CE sponsors, premises-only, etc.
        return None
    return None


def map_individual(profession: str, license_type: str) -> str | None:
    """Map individual contractor-facing credentials (not apprentices / CE sponsors)."""
    p, t = profession.strip().upper(), license_type.strip().upper()
    t = re.sub(r"\s+", " ", t).strip()

    if "MASTER PLUMB" in p and t == "MASTER PLUMBER":
        return "PLB"
    if "HVACR" in p and "MASTER HVACR" in t:
        return "HVAC"
    if "ELECTRICAL" in p and t == "ELECTRICAL CONTRACTOR":
        return "ELE"
    if "ELECTRICAL" in p and (
        "BURGLAR ALARM LICENSE" in t or "FIRE ALARM LICENSE" in t
    ):
        return "ALM"
    if "ELECTRICAL" in p and "LOCKSMITH LICENSE" in t:
        return "LCK"
    if "MASTER HEARTH" in p and "MASTER HEARTH" in t:
        return "HRT"
    # Skip journeyman, apprentice, wireman, CE sponsor, medical gas (optional later)
    return None


def row_from_cols(cols: list[str], cred: str, source: str, kind: str) -> dict[str, str] | None:
    cols = pad(cols, 25)
    lic = cols[2].strip()
    if not lic:
        return None
    if kind == "facility":
        name = cols[13].strip()
        owner = " ".join(p for p in [cols[9].strip(), cols[11].strip()] if p)
        if not name:
            name = owner
        addr1, addr2 = cols[14].strip(), cols[15].strip()
        # Facilities active has 25 cols (phone at 24); all-status often 24 (no phone)
        phone = cols[24].strip() if len(cols) > 24 else ""
        email = cols[23].strip() if len(cols) > 23 else ""
    else:
        name = cols[13].strip() or " ".join(
            p for p in [cols[9], cols[10], cols[11]] if p.strip()
        )
        owner = " ".join(
            p
            for p in [
                cols[9].strip(),
                cols[10].strip(),
                cols[11].strip(),
                cols[12].strip(),
            ]
            if p
        )
        addr1, addr2 = cols[14].strip(), cols[15].strip()
        phone = ""
        email = cols[23].strip() if len(cols) > 23 else ""
    if not name:
        return None
    return {
        "registration_number": lic,
        "license_number": lic,
        "credential_type": cred,
        "license_type": cols[1].strip() or cols[0].strip(),
        "business_name": name,
        "owner_name": owner,
        "status": cols[3].strip(),
        "expiration_date": parse_oracle_date(cols[5]),
        "issue_date": parse_oracle_date(cols[4]),
        "address_line1": addr1,
        "address_line2": addr2,
        "city": cols[18].strip(),
        "state": (cols[19].strip() or "NJ")[:2].upper(),
        "postal_code": re.sub(r"[^0-9A-Za-z-]", "", cols[20].strip())[:10],
        "county": cols[21].strip(),
        "phone": phone,
        "email": email,
        "profession_name": cols[0].strip(),
        "source_file": source,
    }


def iter_mlo(path: Path):
    with path.open("r", encoding="utf-8", errors="replace") as f:
        next(f, None)
        for line in f:
            yield line.rstrip("\n\r").split("%")


def _add_row(
    rows: list[dict[str, str]],
    seen: set[str],
    stats: Counter[str],
    rec: dict[str, str],
) -> None:
    key = f"{rec['credential_type']}:{rec['license_number']}"
    if key in seen:
        stats["dup"] += 1
        return
    # Prefer active over non-active when duplicate keys appear across files
    seen.add(key)
    rows.append(rec)
    stats[f"included_{rec['credential_type']}"] += 1
    stats[f"status_{rec['status'] or 'blank'}"] += 1
    stats[f"type_{rec['license_type']}"] += 1


def convert(
    facilities_active: Path | None,
    facilities_all: Path | None,
    individuals_all: Path | None,
    out: Path,
) -> dict:
    stats: Counter[str] = Counter()
    rows: list[dict[str, str]] = []
    # key -> index for upgrade-to-active preference
    index_by_key: dict[str, int] = {}

    def ingest(
        path: Path | None,
        kind: str,
        mapper,
        *,
        mapper_kwargs: dict | None = None,
    ) -> None:
        if not path or not path.is_file():
            return
        kwargs = mapper_kwargs or {}
        for cols in iter_mlo(path):
            if len(cols) < 14:
                stats[f"{kind}_short"] += 1
                continue
            cred = mapper(cols[0], cols[1] if len(cols) > 1 else "", **kwargs)
            if not cred:
                stats[f"{kind}_skipped"] += 1
                continue
            rec = row_from_cols(cols, cred, path.name, kind)
            if not rec:
                stats[f"{kind}_bad"] += 1
                continue
            key = f"{cred}:{rec['license_number']}"
            if key in index_by_key:
                stats["dup"] += 1
                # Upgrade: if existing is non-active and new is Active, replace
                prev = rows[index_by_key[key]]
                prev_active = (prev.get("status") or "").lower() == "active"
                new_active = (rec.get("status") or "").lower() == "active"
                if new_active and not prev_active:
                    rows[index_by_key[key]] = rec
                    stats["upgraded_to_active"] += 1
                continue
            index_by_key[key] = len(rows)
            rows.append(rec)
            stats[f"included_{cred}"] += 1
            stats[f"status_{rec['status'] or 'blank'}"] += 1
            stats[f"type_{rec['license_type']}"] += 1

    # 1) HIC from facilities active only (HIC absent from facilities all-status extract)
    ingest(facilities_active, "facility", map_facility, mapper_kwargs={"hic_only": True})
    # 2) Electrical + alarm/lock business from facilities all-status (includes Expired/Inactive)
    ingest(facilities_all, "facility", map_facility, mapper_kwargs={"hic_only": False})
    # Fallback: if all-status facilities missing, use active facilities non-HIC
    if not facilities_all or not facilities_all.is_file():
        ingest(
            facilities_active,
            "facility",
            map_facility,
            mapper_kwargs={"hic_only": False},
        )
    # 3) Individuals all-status specialty depth
    ingest(individuals_all, "individual", map_individual)

    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=OUT_FIELDS)
        w.writeheader()
        w.writerows(rows)

    # Discipline flags from all-status files (trailing Y/N column) for mapped credentials only
    enf_rows, enf_stats = extract_discipline_flags(facilities_all, individuals_all)
    # Prefer staging next to licenses when out is under data/raw; also write staging path
    staging_dir = Path("data/staging/nj_dca")
    staging_dir.mkdir(parents=True, exist_ok=True)
    enf_out = staging_dir / "enforcement_normalized.csv"
    with enf_out.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=ENFORCEMENT_OUT_FIELDS)
        w.writeheader()
        w.writerows(enf_rows)
    # Mirror under raw for provenance
    raw_enf = out.parent / "enforcement_from_mlo.csv"
    with raw_enf.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=ENFORCEMENT_OUT_FIELDS)
        w.writeheader()
        w.writerows(enf_rows)

    # Summary rollups for ops
    by_cred_status: Counter[str] = Counter()
    for r in rows:
        by_cred_status[f"{r['credential_type']}|{r['status'] or 'blank'}"] += 1

    return {
        "out": str(out),
        "rows": len(rows),
        "stats": dict(stats),
        "by_cred_status": dict(by_cred_status),
        "enforcement_out": str(enf_out),
        "enforcement_rows": len(enf_rows),
        "enforcement_stats": dict(enf_stats),
        "sources": {
            "facilities_active": str(facilities_active) if facilities_active else None,
            "facilities_all": str(facilities_all) if facilities_all else None,
            "individuals_all": str(individuals_all) if individuals_all else None,
        },
        "notes": (
            "HIC from facilities active only (not in facilities all-status file). "
            "Specialty + inactive/expired from all-status extracts where present. "
            "Discipline: public Y/N flag only — no case detail in bulk file."
        ),
    }


def extract_discipline_flags(
    facilities_all: Path | None,
    individuals_all: Path | None,
) -> tuple[list[dict[str, str]], Counter[str]]:
    """Map Standard Files trailing discipline flag (Y) into enforcement rows."""
    import json

    stats: Counter[str] = Counter()
    rows: list[dict[str, str]] = []
    seen: set[str] = set()

    def ingest(path: Path | None, kind: str) -> None:
        if not path or not path.is_file():
            return
        for cols in iter_mlo(path):
            if len(cols) < 24:
                continue
            flag = cols[23].strip().upper()
            if flag != "Y":
                continue
            if kind == "facility":
                cred = map_facility(cols[0], cols[1] if len(cols) > 1 else "", hic_only=False)
            else:
                cred = map_individual(cols[0], cols[1] if len(cols) > 1 else "")
            if not cred:
                stats["skipped_unmapped"] += 1
                continue
            lic = cols[2].strip()
            if not lic:
                stats["skipped_no_lic"] += 1
                continue
            ekey = f"NJ-ENF:FLAG:{lic.upper()}"
            if ekey in seen:
                stats["dup"] += 1
                continue
            seen.add(ekey)
            if kind == "facility":
                name = cols[13].strip() or " ".join(
                    p for p in [cols[9].strip(), cols[11].strip()] if p
                )
            else:
                name = cols[13].strip() or " ".join(
                    p for p in [cols[9], cols[10], cols[11]] if p.strip()
                )
            if not name:
                stats["skipped_no_name"] += 1
                continue
            stats[f"included_{cred}"] += 1
            stats[f"status_{cols[3].strip() or 'blank'}"] += 1
            rows.append(
                {
                    "source_system": "nj_enforcement",
                    "source_dataset": "dca_standard_files_discipline_flag",
                    "external_key": ekey,
                    "complaint_number": f"FLAG-{lic}",
                    "license_type": cols[1].strip() or cols[0].strip(),
                    "license_number_raw": lic,
                    "respondent_name": name,
                    "classification": "public_discipline_flag",
                    "entered_date": "",
                    "disposition": "Discipline flag present in DCA Standard Files extract",
                    "disposition_date": "",
                    "discipline_description": DISCIPLINE_FLAG_DESC,
                    "violation_code": "",
                    "city": cols[18].strip(),
                    "state": (cols[19].strip() or "NJ")[:2].upper(),
                    "postal_code": re.sub(r"[^0-9A-Za-z-]", "", cols[20].strip())[:10],
                    "county_name": cols[21].strip(),
                    "contractor_slug": "",
                    "raw_payload_json": json.dumps(
                        {
                            "profession": cols[0].strip(),
                            "license_type": cols[1].strip(),
                            "license_no": lic,
                            "status": cols[3].strip(),
                            "discipline_flag": "Y",
                            "source_file": path.name,
                            "credential_code": cred,
                        },
                        ensure_ascii=False,
                    ),
                }
            )

    ingest(facilities_all, "facility")
    ingest(individuals_all, "individual")
    return rows, stats


def main() -> int:
    ap = argparse.ArgumentParser(description="Convert NJ MLO Standard Files to adapter CSV")
    ap.add_argument(
        "--facilities-active",
        type=Path,
        default=_pick("MLO_Facilities_active_statuses_*.txt"),
    )
    ap.add_argument(
        "--facilities-all",
        type=Path,
        default=_pick("MLO_Facilities_all_statuses_with_discipline_*.txt"),
    )
    ap.add_argument(
        "--individuals-all",
        type=Path,
        default=_pick("MLO_Individuals_all_statuses_with_discipline_*.txt"),
    )
    ap.add_argument(
        "--out",
        type=Path,
        default=RAW / "hic_and_specialty_from_mlo.csv",
    )
    ap.add_argument(
        "--no-individuals",
        action="store_true",
        help="Skip individuals file (facilities only)",
    )
    args = ap.parse_args()
    result = convert(
        args.facilities_active if args.facilities_active and args.facilities_active.exists() else None,
        args.facilities_all if args.facilities_all and args.facilities_all.exists() else None,
        None
        if args.no_individuals
        else (
            args.individuals_all
            if args.individuals_all and args.individuals_all.exists()
            else None
        ),
        args.out,
    )
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
