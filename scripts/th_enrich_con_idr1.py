"""Read-only, source-grain Contractor holder reconciliation from frozen B1 snapshots."""

from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / "data/staging/th_enrich_b1"
RAW = ROOT / "data/raw/th_enrich_b1"
OUT = ROOT / "docs/TH-ENRICH-CON-2026-09-30-IDR1"
MANIFEST = json.loads((ROOT / "docs/TH-ENRICH-2026-09-30-B1-source-manifest.json").read_text())
SOURCE_HASHES = {s["id"]: s["sha256"] for s in MANIFEST["sources"]}

PERSON_DOB_TYPES = {
    "ELECTRICAL CONTRACTOR", "FILING REPRESENTATIVE", "FIRE SUPPRESSION CONTRACTOR",
    "HOIST MACHINE OPERATOR", "JOURNEYMAN", "MASTER PLUMBER", "OIL BURNER INSTALLER",
    "RIGGER", "SIGN HANGER", "SITE SAFETY", "STATIONARY / PORTABLE ENGINEER",
    "SUPERINTENDENT OF CONSTRUCTION", "TOWER CRANE RIGGER", "WELDER",
}
FL_ASBESTOS_PERSON = {"AX", "CJC", "AF", "DD", "EA", "IA"}
FIELDS = ["source_dataset", "source_row", "native_key", "native_holder_or_license_id",
          "credential_class", "source_status", "is_current_active", "holder_name_raw",
          "associated_business_name_raw", "holder_authority_code", "classification",
          "existing_business_id", "new_business_candidate_key", "reason_code"]
CODEBOOK = {"holder_authority": {}, "reason": {}}


def staged(dataset: str):
    with (STAGE / f"{dataset}.jsonl").open(encoding="utf-8") as stream:
        yield from (json.loads(line) for line in stream)


def row(dataset, line, key, holder_id, kind, status, current, holder, business,
        authority, classification, reason, candidate=""):
    authority_code = hashlib.sha256(authority.encode()).hexdigest()[:10]
    reason_code = hashlib.sha256(reason.encode()).hexdigest()[:10]
    CODEBOOK["holder_authority"][authority_code] = authority
    CODEBOOK["reason"][reason_code] = reason
    return dict(zip(FIELDS, (dataset, line, key, holder_id, kind, status,
                             "YES" if current else "NO", holder, business, authority_code,
                             classification, "", candidate, reason_code)))


def florida_asbestos():
    for s in staged("fl_dbpr_asbestos_59"):
        raw = s["raw"]
        kind = s["credential_class"]
        status = f"{raw['primary_status'] or '-'}|{raw['secondary_status'] or '-'}"
        if kind == "ZA":
            classification = "NEW_BUSINESS_WITH_AUTHORITATIVE_ID"
            authority = "DBPR board 59 occupation ZA: Asbestos Business license, unique ZA number"
            candidate = f"FL|DBPR|59|ZA|{s['native_license_number']}"
            reason = "Regulator directly licenses the named business; no exact owned ZA source/entity key. Secondary status blank on 172 rows, so active status is not inferred."
        elif kind in FL_ASBESTOS_PERSON:
            classification, authority, candidate = "PERSON", "DBPR individual asbestos credential", ""
            reason = "Individual contractor/consultant credential; not a business holder ID."
        else:
            classification, authority, candidate = "EVIDENCE_ONLY", "DBPR officer/course/provider record", ""
            reason = "Financial officer or education record; no contractor-business creation."
        yield row(s["source_dataset"], s["source_line"], s["native_key"],
                  s["native_license_number"], kind, status,
                  raw["primary_status"] == "C" and raw["secondary_status"] == "A",
                  raw["licensee_name"], raw["dba_name"], authority, classification, reason, candidate)


def florida_electrical():
    rows = list(staged("fl_dbpr_eclb_08"))
    repeated = {k for k, n in Counter(s["native_key"] for s in rows).items() if n > 1}
    for s in rows:
        raw, kind = s["raw"], s["credential_class"]
        status = f"{raw['primary_status'] or '-'}|{raw['secondary_status'] or '-'}"
        if s["native_key"] in repeated:
            classification, reason = "AMBIGUOUS", "Repeated source-native education key; collision held."
        elif s["identity_eligible"]:
            classification, reason = "PERSON", "Board 08 contractor license belongs to an individual; DBA is an associated qualified business name without a separate business ID in this extract."
        else:
            classification, reason = "EVIDENCE_ONLY", "Course/provider/other non-contractor record."
        yield row(s["source_dataset"], s["source_line"], s["native_key"],
                  s["native_license_number"], kind, status,
                  raw["primary_status"] == "C" and raw["secondary_status"] == "A",
                  raw["licensee_name"], raw["dba_name"],
                  "DBPR board 08 individual contractor credential; DBA text is qualifier association",
                  classification, reason)


def ny_business(dataset: str):
    for s in staged(dataset):
        raw = s["raw"]
        status = raw["license_status"].strip()
        yield row(dataset, s["source_line"], s["native_key"], s["native_license_number"],
                  s["credential_class"], status, status == "Active", raw["business_name"], "",
                  "NYS DOL business license; extract has license number and business name but no reusable legal-entity/holder ID",
                  "CREDENTIAL_ONLY", "License number identifies a credential; multiple license types may attach to one business. Name or address alone cannot establish canonical identity.")


def nyc_dob():
    source = RAW / "t8hj-ruu2.csv"
    with source.open(newline="", encoding="utf-8-sig", errors="replace") as stream:
        raw_rows = list(csv.DictReader(stream))
    keys = Counter(f"{r['license_type'].strip()}:{r['license_number'].strip()}" for r in raw_rows
                   if r["license_type"].strip() and r["license_number"].strip())
    for line, raw in enumerate(raw_rows, 2):
        kind = raw["license_type"].strip()
        number = raw["license_number"].strip()
        key = f"{kind}:{number}" if kind and number else ""
        status = raw["license_status"].strip()
        person = " ".join(x for x in (raw["first_name"].strip(), raw["last_name"].strip()) if x)
        business = raw["business_name"].strip()
        if not key or keys[key] > 1 or (status.isdecimal() and len(status) >= 7):
            classification, reason = "AMBIGUOUS", "Missing/duplicated native key or malformed status; held."
        elif kind == "GENERAL CONTRACTOR" and status == "ACTIVE":
            classification, reason = "CREDENTIAL_ONLY", "GC record names both individual registrant and business but exposes no business registration/EIN or other holder ID; license number is a credential."
        elif kind in PERSON_DOB_TYPES:
            classification, reason = "PERSON", "DOB profession record identifies an individual; no business identity authority."
        else:
            classification, reason = "HELD", "Other DOB license type or non-active GC outside this business-resolution pass."
        yield row("nyc_dob_license_info", line, key, number, kind, status,
                  status == "ACTIVE", person, business,
                  "DOB license serial/number identifies a licensee record; business-name field is not legal registration ID",
                  classification, reason)


def nj_fire():
    for s in staged("nj_dfs_fire_business"):
        yield row("nj_dfs_fire_business", f"PDF p{s['source_page']}", s["native_key"],
                  s["native_permit_number"], "NJ_FIRE_PROTECTION_BUSINESS_PERMIT",
                  f"lapse={s['lapse_date_raw']}; current_unproven", False,
                  s["business_name_raw"], "", "NJ DFS permit number identifies permit only",
                  "HELD", "Official PDF contains 542 unique primary permit IDs. Permit presence and lapse date do not prove current status or a distinct canonical business.")


def person_hold_from_other_sources():
    for dataset in ("fl_dbpr_mold_07", "fl_dbpr_home_04"):
        for s in staged(dataset):
            if not s["identity_eligible"]:
                continue
            raw = s["raw"]
            yield row(dataset, s["source_line"], s["native_key"], s["native_license_number"],
                      s["credential_class"], f"{raw['primary_status'] or '-'}|{raw['secondary_status'] or '-'}",
                      raw["primary_status"] == "C" and raw["secondary_status"] == "A",
                      raw["licensee_name"], raw["dba_name"], "DBPR individual professional credential",
                      "PERSON", "PERSON_CREDENTIAL_HOLD: product model deferred.")


def write_csv(path: Path, rows):
    counts = Counter()
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS)
        writer.writeheader()
        for value in rows:
            writer.writerow(value)
            counts[value["classification"]] += 1
    return dict(counts)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sources = {
        "fl_dbpr_asbestos_59": florida_asbestos(),
        "nyc_dob_license_info": nyc_dob(),
        "ny_dol_mold": ny_business("ny_dol_mold"),
        "ny_elevator": ny_business("ny_elevator"),
        "fl_dbpr_eclb_08": florida_electrical(),
        "nj_dfs_fire_business": nj_fire(),
    }
    summary = {name: write_csv(OUT / f"{name}-reconciliation.csv", rows) for name, rows in sources.items()}
    person_files = [OUT / f"{name}-reconciliation.csv" for name in sources]
    def held_people():
        for path in person_files:
            with path.open(newline="", encoding="utf-8") as stream:
                yield from (r for r in csv.DictReader(stream) if r["classification"] == "PERSON")
        yield from person_hold_from_other_sources()
    hold_fields = ["source_dataset", "native_key", "credential_class", "source_status",
                   "is_current_active", "holder_name_raw", "associated_business_name_raw",
                   "holder_authority_code", "reason_code"]
    hold_count = 0
    with (OUT / "person-credential-hold.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=hold_fields)
        writer.writeheader()
        for person in held_people():
            writer.writerow({key: person[key] for key in hold_fields})
            hold_count += 1
    summary["PERSON_CREDENTIAL_HOLD"] = {"PERSON": hold_count}
    (OUT / "classification-codebook.json").write_text(json.dumps(CODEBOOK, indent=2) + "\n", encoding="utf-8")
    summary["source_hashes"] = {s: SOURCE_HASHES[s] for s in sources}
    summary["nj_evidence_baseline"] = 542
    summary["nj_pdf_entry_count"] = 542
    (OUT / "classification-counts.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
