"""Profile last-acquired AZ ROC All Current file. Do not invent additive C/R/D totals."""
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(r"C:\Users\Michael.Savitsky\contractor-trust-hub\data\raw\az_roc\roc_all_current.csv")
OUT = ROOT / "data" / "arizona" / "az-con-001"
OUT.mkdir(parents=True, exist_ok=True)

CATEGORY = {
    "GENERAL RESIDENTIAL": "Residential",
    "SPECIALTY RESIDENTIAL": "Residential",
    "GENERAL COMMERCIAL": "Commercial",
    "SPECIALTY COMMERCIAL": "Commercial",
    "GENERAL DUAL": "Dual",
    "SPECIALTY DUAL": "Dual",
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    raw = SRC.read_bytes()
    text = raw.decode("utf-8", "replace")
    lines = text.splitlines()
    title = lines[0] if lines else ""
    m = re.search(r"File created:\s*([A-Za-z]+ \d+, \d+)\s*-\s*(\d+)\s*Records", title)
    header_i = 1
    reader = csv.DictReader(lines[header_i:])
    fields = reader.fieldnames or []
    rows = []
    skipped = 0
    for row in reader:
        lic = (row.get("License No") or "").strip()
        if not lic or not re.search(r"\d", lic):
            skipped += 1
            continue
        rows.append(row)

    licenses = [(r.get("License No") or "").strip() for r in rows]
    distinct_lic = set(licenses)
    names = [(r.get("Business Name") or "").strip().upper() for r in rows]
    dbas = [(r.get("Doing Business As") or "").strip().upper() for r in rows]
    addrs = [
        (
            (r.get("Business Name") or "").strip().upper(),
            (r.get("Address") or "").strip().upper(),
            (r.get("City") or "").strip().upper(),
            (r.get("Zip") or "").strip()[:5],
        )
        for r in rows
    ]
    class_types = Counter((r.get("Class Type") or "").strip() for r in rows)
    classes = Counter((r.get("Class") or "").strip() for r in rows)
    statuses = Counter((r.get("Status") or "").strip() for r in rows)
    cats = Counter()
    for r in rows:
        ct = (r.get("Class Type") or "").strip().upper()
        cats[CATEGORY.get(ct, "UNKNOWN")] += 1

    qp_vals = [(r.get("Qualifying Party") or "").strip() for r in rows]
    qp_blank = sum(1 for v in qp_vals if not v)
    qp_exempt = sum(1 for v in qp_vals if v.upper() == "QP EXEMPT")
    qp_named = len(qp_vals) - qp_blank - qp_exempt
    phones = sum(1 for r in rows if (r.get("Phone") or r.get("Business Phone") or "").strip())
    emails = sum(1 for r in rows if (r.get("Email") or "").strip())
    websites = sum(1 for r in rows if (r.get("Website") or r.get("Web") or "").strip())
    addrs_n = sum(1 for r in rows if (r.get("Address") or "").strip())

    # one business name may hold many licenses
    from collections import defaultdict

    by_name = defaultdict(set)
    for r in rows:
        by_name[(r.get("Business Name") or "").strip().upper()].add((r.get("License No") or "").strip())
    multi_lic_names = sum(1 for s in by_name.values() if len(s) > 1)

    report = {
        "source_path": str(SRC),
        "bytes": len(raw),
        "sha256": sha256(SRC),
        "title": title.strip('"'),
        "file_created": m.group(1) if m else None,
        "title_record_claim": int(m.group(2)) if m else None,
        "fields": fields,
        "data_rows": len(rows),
        "skipped": skipped,
        "distinct_license_numbers": len(distinct_lic),
        "duplicate_license_rows": len(licenses) - len(distinct_lic),
        "distinct_normalized_business_names": len({n for n in names if n}),
        "distinct_business_plus_address": len(set(addrs)),
        "business_names_with_multiple_licenses": multi_lic_names,
        "grain": "one data row = one ROC license number (License No)",
        "status_counts": dict(statuses),
        "class_type_counts": dict(class_types),
        "category_counts": dict(cats),
        "category_sum": sum(cats.values()),
        "top_classes": classes.most_common(40),
        "distinct_class_codes": len([c for c in classes if c]),
        "qualifying_party": {
            "named": qp_named,
            "qp_exempt": qp_exempt,
            "blank": qp_blank,
            "id_field_present": "Qualifying Party ID" in fields or "QP ID" in fields,
            "start_end_association_present": False,
        },
        "contacts": {
            "address": addrs_n,
            "phone": phones,
            "email": emails,
            "website": websites,
            "fields_present": fields,
        },
        "posting_list_header_2026_09_02": {
            "all_current": 57886,
            "commercial": 46913,
            "dual": 36285,
            "residential": 47258,
            "note": "Official roc.az.gov/posting-list table retrieved 2026-09-04. Commercial/Residential/Dual files overlap; Dual licenses appear in the commercial and residential posting files. Do not add.",
        },
        "pre_ingest_graph": {
            "az_roc_licenses_in_network_metrics": 58408,
            "az_roc_discipline_rows_in_network_metrics": 459,
            "metrics_generated_at": "2026-09-03T21:22:06.870Z",
            "note": "Committed contractor-network-metrics-v1. Refreshed identities are not net-new companies.",
        },
    }
    (OUT / "profile-all-current.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in report if k != "top_classes"}, indent=2)[:4000])
    print("top_classes", report["top_classes"][:15])


if __name__ == "__main__":
    main()
