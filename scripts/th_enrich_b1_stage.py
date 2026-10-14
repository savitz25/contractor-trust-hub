"""Stage B1 contractor snapshots without database writes or cross-source merges."""
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw/th_enrich_b1"
STAGE = ROOT / "data/staging/th_enrich_b1"
REPORT = ROOT / "docs/TH-ENRICH-2026-09-30-B1-qa.json"
AUDIT_PATH = ROOT / "docs/TH-ENRICH-2026-09-30-B1-rest-audit.json"
FL_FILES = {
    "lic08el.csv": ("fl_dbpr_eclb_08", "08", "electrical"),
    "lic07mold.csv": ("fl_dbpr_mold_07", "07", "mold"),
    "lic59asb.csv": ("fl_dbpr_asbestos_59", "59", "asbestos"),
    "lic04home.csv": ("fl_dbpr_home_04", "04", "home_inspector"),
}
NY_FILES = {
    "t8hj-ruu2.csv": ("nyc_dob_license_info", "New York City", "DOB license"),
    "ikqx-ispy.csv": ("ny_dol_mold", "New York State", "mold contractor"),
    "jrac-r9vc.csv": ("ny_elevator", "New York State", "elevator contractor"),
}
NYC_BUSINESS_TYPES = {"GENERAL CONTRACTOR", "ELECTRICAL FIRM", "SPECIAL INSPECTION AGENCY",
                      "FIRE SUPPRESSION CONTRACTOR"}
FL_FIELDS = ("board_number", "occupation_code", "licensee_name", "dba_name",
             "class_code", "address_1", "address_2", "address_3", "city", "state",
             "postal_code", "county_code", "license_number_core", "primary_status",
             "secondary_status", "original_licensure_date", "effective_date",
             "expiration_date", "unknown_18", "unknown_19", "alternate_license_number", "ce_note")
FL_IDENTITY_CLASSES = {
    "08": {"EC", "EF", "EG", "ES", "ER", "EY", "EZ", "ET", "EH", "EI", "EJ"},
    "07": {"MRSA", "MRSR"},
    "59": {"AX", "CJC", "ZA", "AF", "DD", "EA", "IA"},
    "04": {"HI"},
}
PERMIT = re.compile(r"\b(P\d{5})\b")
LAPSE = re.compile(r"\b(\d{1,2}/\d{1,2}/\d{4})\b")


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def save(dataset: str, rows: list[dict], source: Path, *, raw_count: int, failures: list,
         status: Counter, jurisdiction: str, target: str, native_key: str,
         denominator: str, extra: dict | None = None) -> dict:
    keys = [r["native_key"] for r in rows if r.get("native_key")]
    counts = Counter(keys)
    identity_keys = {r["native_key"] for r in rows if r.get("identity_eligible")}
    audit = json.loads(AUDIT_PATH.read_text(encoding="utf-8")) if AUDIT_PATH.exists() else None
    if audit and audit.get("live_ownership_verified"):
        if dataset.startswith("fl_dbpr_"):
            board = dataset.rsplit("_", 1)[-1]
            live_existing = audit["fl_dbpr_board_counts"][board]
        else:
            system = "nyc_dob" if dataset.startswith("nyc_") else "ny_dol" if dataset.startswith("ny_") else "nj_dfs"
            live_existing = audit["source_counts"][system]
    else:
        live_existing = None
    collisions = {k: n for k, n in counts.items() if n > 1}
    path = STAGE / f"{dataset}.jsonl"
    with path.open("w", encoding="utf-8") as stream:
        for record in rows:
            stream.write(json.dumps(record, ensure_ascii=False) + "\n")
    return {
        "dataset": dataset, "official_source_file": source.name, "sha256": sha(source),
        "raw_rows": raw_count, "parsed_rows": len(rows), "unique_native_keys": len(counts),
        "duplicate_native_keys": sum(v - 1 for v in counts.values() if v > 1),
        "collision_key_count": len(collisions), "collision_sample": dict(list(collisions.items())[:20]),
        "parse_failures": len(failures), "failure_sample": failures[:20],
        "local_inventory_existing_same_source": 0,
        "live_existing_source_records": live_existing,
        "candidate_new_source_records": len(counts),
        "verified_new_source_records": len(counts) if live_existing == 0 else None,
        "identity_eligible_native_keys": len(identity_keys),
        "source_rows_not_identity_eligible": sum(not r.get("identity_eligible") for r in rows),
        "exact_existing_entity_bridges": 0,
        "unresolved_entity_keys": len(identity_keys),
        "identity_note": "No cross-regulator deterministic identifier is present in this snapshot; entity attachments remain pending.",
        "status_distribution": dict(status), "issuing_jurisdiction": jurisdiction,
        "address_state_rule": "mailing/business address state is not the issuing jurisdiction",
        "target_class": target, "native_key_rule": native_key,
        "publication_denominator_rule": denominator,
        "staged_file": str(path.relative_to(ROOT)).replace("\\", "/"),
        "production_changed": False, **(extra or {})}


def florida(filename: str, dataset: str, board: str, target: str) -> dict:
    path = RAW / filename
    rows, failures = [], []
    statuses = Counter()
    occupations = Counter()
    identity_classes = Counter()
    eligible_active = Counter()
    with path.open(newline="", encoding="utf-8-sig", errors="replace") as stream:
        for line_no, values in enumerate(csv.reader(stream), 1):
            if len(values) != len(FL_FIELDS):
                failures.append({"line": line_no, "reason": "width", "actual": len(values)})
                continue
            raw = dict(zip(FL_FIELDS, values))
            if raw["board_number"] != board:
                failures.append({"line": line_no, "reason": "board mismatch", "value": raw["board_number"]})
                continue
            native = raw["alternate_license_number"].strip() or (
                raw["occupation_code"].strip() + raw["license_number_core"].strip())
            if not native:
                failures.append({"line": line_no, "reason": "missing native identifier"})
                continue
            key = f"{board}:{raw['occupation_code'].strip()}:{native}"
            occupations[raw["occupation_code"]] += 1
            if raw["occupation_code"] in FL_IDENTITY_CLASSES[board]:
                identity_classes[raw["occupation_code"]] += 1
                if raw["primary_status"] == "C" and raw["secondary_status"] == "A":
                    eligible_active[raw["occupation_code"]] += 1
            statuses[f"{raw['primary_status'] or '-'}|{raw['secondary_status'] or '-'}"] += 1
            rows.append({"source_system": "fl_dbpr", "source_dataset": dataset,
                         "source_line": line_no, "native_key": key, "native_license_number": native,
                         "board_number": board, "credential_class": raw["occupation_code"],
                         "record_grain": "board credential" if raw["occupation_code"] in FL_IDENTITY_CLASSES[board] else "board course/provider/officer record",
                         "identity_eligible": raw["occupation_code"] in FL_IDENTITY_CLASSES[board], "raw": raw})
    return save(dataset, rows, path, raw_count=len(rows) + len(failures), failures=failures,
                status=statuses, jurisdiction="Florida DBPR board " + board,
                target=target, native_key="board + occupation code + regulator license number",
                denominator="Credential count by board and occupation; active only after board status code mapping; do not add to general contractor count.",
                extra={"occupation_distribution": dict(occupations),
                       "identity_eligible_class_rows": dict(identity_classes),
                       "identity_eligible_current_active_rows": dict(eligible_active),
                       "excluded_course_provider_officer_rows": len(rows) - sum(identity_classes.values()),
                       "class_source": "https://www2.myfloridalicense.com/about-us/understanding-dbpr-codes/"})


def ny_csv(filename: str, dataset: str, jurisdiction: str, target: str) -> dict:
    path = RAW / filename
    rows, failures = [], []
    statuses, kinds = Counter(), Counter()
    anomalies = []
    with path.open(newline="", encoding="utf-8-sig", errors="replace") as stream:
        for line_no, raw in enumerate(csv.DictReader(stream), 2):
            number = (raw.get("license_number") or "").strip()
            kind = (raw.get("license_type") or "").strip()
            if not number or not kind:
                failures.append({"line": line_no, "reason": "missing license number/type"})
                continue
            key = f"{kind}:{number}"
            raw_status = (raw.get("license_status") or "").strip()
            statuses[raw_status] += 1
            if raw_status.isdecimal() and len(raw_status) >= 7:
                anomalies.append({"line": line_no, "reason": "status contains phone-like value", "source_row_id": raw.get("license_sl_no")})
            kinds[kind] += 1
            eligible = (kind in NYC_BUSINESS_TYPES and bool((raw.get("business_name") or "").strip())) if dataset.startswith("nyc_") else bool((raw.get("business_name") or "").strip())
            rows.append({"source_system": "nyc_dob" if dataset.startswith("nyc_") else "ny_dol",
                         "source_dataset": dataset, "source_line": line_no,
                         "native_key": key, "native_license_number": number,
                         "credential_class": kind, "record_grain": "regulator license record",
                         "identity_eligible": eligible, "raw": raw})
    active_gc = sum(r["credential_class"] == "GENERAL CONTRACTOR" and
                    r["raw"].get("license_status") == "ACTIVE" for r in rows)
    return save(dataset, rows, path, raw_count=len(rows) + len(failures), failures=failures,
                status=statuses, jurisdiction=jurisdiction, target=target,
                native_key="license type + license number within source dataset",
                denominator="Only source status ACTIVE; NYC DOB GC is a city credential. Other types and statuses remain separate.",
                extra={"credential_type_distribution": dict(kinds), "active_general_contractor_rows": active_gc,
                       "status_anomalies": anomalies})


def nj_fire() -> dict:
    path = RAW / "nj_fire_permitted_business_2026.pdf"
    rows, failures, statuses = [], [], Counter()
    with pdfplumber.open(path) as pdf:
        for page_no, page in enumerate(pdf.pages, 1):
            for line in (page.extract_text() or "").splitlines():
                permits = PERMIT.findall(line)
                if not permits:
                    continue
                if len(permits) > 1 and "REPLACE PER" not in line:
                    failures.append({"page": page_no, "reason": "multiple permits", "line": line})
                    continue
                number = permits[0]
                name = line.split(number, 1)[0].strip()
                rest = line.split(number, 1)[1].strip()
                lapse = LAPSE.search(rest)
                if not name or not lapse:
                    failures.append({"page": page_no, "reason": "name/lapse parse", "line": line})
                    continue
                expiry = datetime.strptime(lapse.group(1), "%m/%d/%Y").date()
                statuses["lapse_before_retrieval" if expiry < date.today() else "lapse_on_or_after_retrieval"] += 1
                rows.append({"source_system": "nj_dfs", "source_dataset": "nj_dfs_fire_business",
                             "source_page": page_no, "native_key": number,
                             "native_permit_number": number, "business_name_raw": name,
                             "lapse_date_raw": lapse.group(1), "remaining_raw": rest,
                             "replacement_reference": permits[1] if len(permits) > 1 else None,
                             "record_grain": "fire protection equipment business permit",
                             "identity_eligible": True})
    return save("nj_dfs_fire_business", rows, path,
                raw_count=len(rows) + len(failures), failures=failures, status=statuses,
                jurisdiction="New Jersey DCA Division of Fire Safety",
                target="NJ fire protection equipment permitted business",
                native_key="P##### permit", denominator="Permit count as of PDF date (2026-03-19); do not infer current status today from roster presence; not HIC/fire-alarm count.",
                extra={"pdf_as_of": "2026-03-19"})


if __name__ == "__main__":
    STAGE.mkdir(parents=True, exist_ok=True)
    result = [florida(name, *spec) for name, spec in FL_FILES.items()]
    result += [ny_csv(name, *spec) for name, spec in NY_FILES.items()]
    result.append(nj_fire())
    packet = {"ticket": "TH-ENRICH-2026-09-30-B1", "generated_at": datetime.now(timezone.utc).isoformat(),
              "datasets": result, "production_changed": False}
    REPORT.write_text(json.dumps(packet, indent=2), encoding="utf-8")
    print(json.dumps([{k: d[k] for k in ("dataset", "raw_rows", "parsed_rows", "unique_native_keys", "duplicate_native_keys", "parse_failures")} for d in result], indent=2))
