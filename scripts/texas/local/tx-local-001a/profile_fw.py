"""Profile acquired Fort Worth development-permits CSV. No contractor fields expected."""
from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

csv.field_size_limit(min(2**31 - 1, 128 * 1024 * 1024))
CSV = Path(r"S:\ath-raw\tx-con-local-001a\fort-worth-tarrant\cfw-development-permits.csv")
OUT = Path(__file__).resolve().parents[4] / "data" / "texas" / "local" / "fort-worth-tarrant" / "permit-profile.json"
FIX = Path(__file__).resolve().parents[4] / "data" / "texas" / "local" / "fort-worth-tarrant" / "fixtures"


def g(row, *names):
    for n in names:
        if row.get(n):
            return str(row[n]).strip()
    return ""


def main() -> None:
    rows = 0
    types = Counter()
    status = Counter()
    with_addr = 0
    with_zip = 0
    with_value = 0
    with_legal = 0
    with_owner = 0
    permits = set()
    fixture = []
    h = hashlib.sha256()
    with CSV.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    sha = h.hexdigest()
    with CSV.open(newline="", encoding="utf-8", errors="replace") as fh:
        reader = csv.DictReader(fh)
        fields = reader.fieldnames or []
        for row in reader:
            rows += 1
            types[g(row, "Permit_Type") or "(blank)"] += 1
            status[g(row, "Current_Status") or "(blank)"] += 1
            if g(row, "Full_Street_Address"):
                with_addr += 1
            if g(row, "Zip_Code"):
                with_zip += 1
            if g(row, "JobValue"):
                with_value += 1
            if g(row, "B1_LEGAL_DESC"):
                with_legal += 1
            if g(row, "Owner_Full_Name"):
                with_owner += 1
            pno = g(row, "Permit_No")
            if pno:
                permits.add(pno)
            if len(fixture) < 8:
                fixture.append({k: g(row, k) for k in ("Permit_No", "Permit_Type", "Current_Status", "Full_Street_Address", "JobValue")})
            if rows % 250000 == 0:
                print("fw", rows, flush=True)
    FIX.mkdir(parents=True, exist_ok=True)
    import csv as csvmod
    with (FIX / "fort-worth-permits-sample.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csvmod.DictWriter(fh, fieldnames=list(fixture[0].keys()))
        w.writeheader()
        w.writerows(fixture)
    out = {
        "rows": rows,
        "bytes": CSV.stat().st_size,
        "sha256": sha,
        "fields": fields,
        "distinct_permit_numbers": len(permits),
        "rows_with_street_address": with_addr,
        "rows_with_zip": with_zip,
        "rows_with_job_value": with_value,
        "rows_with_legal_description": with_legal,
        "rows_with_owner_full_name": with_owner,
        "permit_types": types.most_common(20),
        "status_mix": status.most_common(),
        "contractor_company_field": any("contractor" in f.lower() for f in fields),
        "parcel_account_field": any(x in ",".join(fields).lower() for x in ("account", "taxpin", "parcel", "prop_id")),
        "owner_full_name_is_not_contractor": True,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: out[k] for k in ("rows", "distinct_permit_numbers", "rows_with_street_address", "rows_with_job_value", "contractor_company_field", "sha256")}, indent=2))


if __name__ == "__main__":
    main()
