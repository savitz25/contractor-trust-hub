"""
Convert official NJ DCA MLO Standard Files (%-delimited) into adapter-ready CSV.

Sources (Box Standard Files, free official bulk):
  - MLO Facilities active — HIC business + Electrical Business Permit
  - MLO Individuals active — Master Plumber + Master HVACR Contractor

Does not invent statewide GC coverage.
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


def map_facility(profession: str, license_type: str) -> str | None:
    p, t = profession.strip().upper(), license_type.strip().upper()
    if "HOME IMPROVEMENT" in p:
        return "HIC"
    if "ELECTRICAL" in p and "ELECTRICAL BUSINESS" in t:
        return "ELE"
    return None


def map_individual(profession: str, license_type: str) -> str | None:
    p, t = profession.strip().upper(), license_type.strip().upper()
    if "MASTER PLUMB" in p and "MASTER PLUMBER" in t:
        return "PLB"
    if "HVACR" in p and "MASTER HVACR" in t:
        return "HVAC"
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
        phone = cols[24].strip() if len(cols) > 24 else ""
        email = cols[23].strip()
    else:
        # Individuals: col 13 is display name; address at 14+
        name = cols[13].strip() or " ".join(p for p in [cols[9], cols[10], cols[11]] if p.strip())
        owner = " ".join(p for p in [cols[9].strip(), cols[10].strip(), cols[11].strip(), cols[12].strip()] if p)
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


def convert(
    facilities: Path | None,
    individuals: Path | None,
    out: Path,
) -> dict:
    stats: Counter[str] = Counter()
    rows: list[dict[str, str]] = []
    seen: set[str] = set()

    if facilities and facilities.is_file():
        for cols in iter_mlo(facilities):
            if len(cols) < 14:
                stats["facility_short"] += 1
                continue
            cred = map_facility(cols[0], cols[1] if len(cols) > 1 else "")
            if not cred:
                stats["facility_skipped"] += 1
                continue
            rec = row_from_cols(cols, cred, facilities.name, "facility")
            if not rec:
                stats["facility_bad"] += 1
                continue
            key = f"{cred}:{rec['license_number']}"
            if key in seen:
                stats["dup"] += 1
                continue
            seen.add(key)
            rows.append(rec)
            stats[f"included_{cred}"] += 1
            stats[f"status_{rec['status']}"] += 1

    if individuals and individuals.is_file():
        for cols in iter_mlo(individuals):
            if len(cols) < 14:
                stats["indiv_short"] += 1
                continue
            cred = map_individual(cols[0], cols[1] if len(cols) > 1 else "")
            if not cred:
                stats["indiv_skipped"] += 1
                continue
            rec = row_from_cols(cols, cred, individuals.name, "individual")
            if not rec:
                stats["indiv_bad"] += 1
                continue
            key = f"{cred}:{rec['license_number']}"
            if key in seen:
                stats["dup"] += 1
                continue
            seen.add(key)
            rows.append(rec)
            stats[f"included_{cred}"] += 1
            stats[f"status_{rec['status']}"] += 1

    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=OUT_FIELDS)
        w.writeheader()
        w.writerows(rows)
    return {"out": str(out), "rows": len(rows), "stats": dict(stats)}


def main() -> int:
    ap = argparse.ArgumentParser(description="Convert NJ MLO Standard Files to adapter CSV")
    ap.add_argument(
        "--facilities",
        type=Path,
        default=RAW / "MLO_Facilities_active_statuses_08-03-2026.txt",
    )
    ap.add_argument(
        "--individuals",
        type=Path,
        default=RAW / "MLO_Individuals_active_statuses_08-03-2026.txt",
    )
    ap.add_argument(
        "--out",
        type=Path,
        default=RAW / "hic_and_specialty_from_mlo_active.csv",
    )
    ap.add_argument("--no-individuals", action="store_true")
    args = ap.parse_args()
    result = convert(
        args.facilities if args.facilities.exists() else None,
        None if args.no_individuals else (args.individuals if args.individuals.exists() else None),
        args.out,
    )
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
