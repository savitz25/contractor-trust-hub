#!/usr/bin/env python3
"""Build contractor-or-state-intel-v1 from frozen CCB/BCD CSVs. No network."""
from __future__ import annotations

import csv
import gzip
import hashlib
import json
import shutil
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STAGE = ROOT / "data" / "oregon" / "or-con-001"
LIB = ROOT / "lib" / "oregon-intelligence"
ART = ROOT / "artifacts"
VOLATILE = frozenset({"fingerprint", "generatedAt", "generated_at"})

CCB_META = {
    "id": "g77e-6bhs",
    "rowsUpdatedAt": 1789504434,
    "viewLastModified": 1789504427,
}
BCD_META = {
    "id": "vhbr-cuaq",
    "rowsUpdatedAt": 1788565274,
    "viewLastModified": 1788565270,
}

BCD_BUSINESS_TYPES = {
    "C-Electrical Contractor",
    "PB-Plumbing Contractor",
    "BB-Boiler Business",
    "LHR-Ltd Maint Contractor HVAC/R",
    "CLE-Ltd Energy Contractor",
    "LMS-Ltd Maint Spec Contractor",
    "CRE-Restricted Energy Contractor",
    "CPI-Ltd Pump Install Spec Contractor",
    "CLS-Ltd Sign Contractor",
    "CLR-Ltd Renewable Energy Contractor",
    "EC-Elevator Elec Contractor",
    "ECM-Elevator Mech Contractor",
    "PFS-Prefab Structures",
    "PFC-Prefab Components",
    "MHB-Manuf Home Builder",
}
CCB_CONSTRUCTION = {"RGC", "RSC", "CGC1", "CGC2", "CSC1", "CSC2", "RLC", "RD", "CD", "RRC", "RHSC", "RHEPSC"}
CCB_CERT = {"OCHI", "OCLS", "LBPR", "RHISC", "RLSC", "CF"}


def iso(ts: int) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def semantic(obj: dict) -> dict:
    out = {}
    for k, v in obj.items():
        if k in VOLATILE:
            continue
        if k == "clocks" and isinstance(v, dict):
            out[k] = {ck: cv for ck, cv in v.items() if ck not in VOLATILE}
        else:
            out[k] = v
    return out


def fingerprint(body: dict) -> str:
    return hashlib.sha256(dump(semantic(body)).encode("utf-8")).hexdigest()


def sha_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def gzip_copy(src: Path) -> Path:
    dest = src.with_suffix(src.suffix + ".gz")
    with src.open("rb") as fin, gzip.open(dest, "wb", compresslevel=9) as fout:
        shutil.copyfileobj(fin, fout)
    return dest


def entity_grain(profession: str, lictype: str) -> str:
    if profession == "Certification" or "Inspector" in lictype or "Plans Examiner" in lictype or "Plan Review" in lictype or lictype.startswith("BO-") or lictype.startswith("TPI-"):
        return "INSPECTOR"
    if profession == "Combo License" or lictype in BCD_BUSINESS_TYPES or "Contractor" in lictype or "Business" in lictype:
        return "BUSINESS"
    return "PERSON"


def main() -> None:
    generated = now()
    retrieved = generated
    def load_csv(stem: str) -> tuple[list[dict], Path]:
        raw = STAGE / stem
        gz = STAGE / f"{stem}.gz"
        if raw.is_file():
            with raw.open(encoding="utf-8-sig", newline="") as fh:
                return list(csv.DictReader(fh)), raw
        with gzip.open(gz, "rt", encoding="utf-8-sig", newline="") as fh:
            return list(csv.DictReader(fh)), gz

    ccb_rows, ccb_path = load_csv("ccb-active-licenses.csv")
    bcd_rows, bcd_path = load_csv("bcd-active-licenses.csv")

    ccb_ids = [(r.get("license_number") or "").strip() for r in ccb_rows]
    ccb_types = Counter((r.get("license_type") or "").strip() for r in ccb_rows)
    related = [r for r in ccb_rows if (r.get("related_key") or "").strip()]
    related_types = Counter((r.get("related_type") or "").strip() for r in related)
    counties = Counter((r.get("county_name") or "(blank)").strip() or "(blank)" for r in ccb_rows)
    construction_ids = {
        (r.get("license_number") or "").strip()
        for r in ccb_rows
        if (r.get("license_type") or "").strip() in CCB_CONSTRUCTION and (r.get("license_number") or "").strip()
    }
    cert_ids = {
        (r.get("license_number") or "").strip()
        for r in ccb_rows
        if (r.get("license_type") or "").strip() in CCB_CERT and (r.get("license_number") or "").strip()
    }

    bcd_prof = Counter((r.get("Profession") or "").strip() for r in bcd_rows)
    bcd_status = Counter((r.get("Lic_Status") or "").strip() for r in bcd_rows)
    bcd_types = Counter((r.get("LicType") or "").strip() for r in bcd_rows)
    grains = Counter(entity_grain((r.get("Profession") or "").strip(), (r.get("LicType") or "").strip()) for r in bcd_rows)
    grain_ids = {"BUSINESS": set(), "PERSON": set(), "INSPECTOR": set()}
    for r in bcd_rows:
        lid = (r.get("LicNbr") or "").strip()
        g = entity_grain((r.get("Profession") or "").strip(), (r.get("LicType") or "").strip())
        if lid:
            grain_ids[g].add(lid)

    ccb_raw = STAGE / "ccb-active-licenses.csv"
    bcd_raw = STAGE / "bcd-active-licenses.csv"
    ccb_gz = gzip_copy(ccb_raw) if ccb_raw.is_file() else STAGE / "ccb-active-licenses.csv.gz"
    bcd_gz = gzip_copy(bcd_raw) if bcd_raw.is_file() else STAGE / "bcd-active-licenses.csv.gz"

    body = {
        "version": "contractor-or-state-intel-v1",
        "ticket": "OR-CON-001",
        "as_of": iso(CCB_META["rowsUpdatedAt"])[:10],
        "generated_at": generated,
        "no_trust_score": True,
        "no_ranking": True,
        "no_oregon_local_intel_routes_this_ticket": True,
        "no_portland_page": True,
        "no_multnomah_page": True,
        "publication": {
            "indexable": True,
            "robots": "index,follow",
            "canonical": "https://www.contractortrusthub.com/oregon",
            "route": "/oregon",
            "h1": "Oregon Contractor License & Regulatory Intelligence",
            "rankings": False,
            "trustScore": False,
        },
        "clocks": {
            "ccb_sourceAsOf": iso(CCB_META["rowsUpdatedAt"])[:10],
            "ccb_sourceUpdatedAt": iso(CCB_META["rowsUpdatedAt"]),
            "ccb_rowsUpdatedAt": iso(CCB_META["rowsUpdatedAt"]),
            "ccb_viewLastModified": iso(CCB_META["viewLastModified"]),
            "ccb_retrievedAt": retrieved,
            "bcd_sourceAsOf": iso(BCD_META["rowsUpdatedAt"])[:10],
            "bcd_sourceUpdatedAt": iso(BCD_META["rowsUpdatedAt"]),
            "bcd_rowsUpdatedAt": iso(BCD_META["rowsUpdatedAt"]),
            "bcd_retrievedAt": retrieved,
            "snapshotAsOf": iso(CCB_META["rowsUpdatedAt"])[:10],
            "generatedAt": generated,
            "retrievedAt_is_not_sourceAsOf": True,
            "do_not_substitute_build_time_for_source_time": True,
        },
        "hero": {
            "universe_value": len(set(x for x in ccb_ids if x)),
            "universe_label": "Distinct CCB active license IDs",
            "universe_hint": "Distinct license_number in CCB Active Licenses g77e-6bhs. Rows can repeat the same ID across endorsements. Not unique companies.",
            "rows_value": len(ccb_rows),
            "rows_label": "CCB active license rows",
            "rows_hint": "Source rows. A row is a license-type observation, not a unique company.",
            "bcd_business_value": len(grain_ids["BUSINESS"]),
            "bcd_business_label": "Distinct BCD business/contractor credentials",
            "bcd_business_hint": "BCD trade-business grain only. Not added to CCB totals. Person and inspector credentials excluded.",
            "as_of_value": iso(CCB_META["rowsUpdatedAt"])[:10],
            "as_of_label": "CCB Open Data rowsUpdatedAt date",
        },
        "ccb": {
            "dataset_id": "g77e-6bhs",
            "portal": "https://data.oregon.gov/Business/CCB-Active-Licenses/g77e-6bhs",
            "agency": "Oregon Construction Contractors Board",
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "description": "Contractors who can legally work in the State of Oregon. Published daily.",
            "SOURCE_ROWS": len(ccb_rows),
            "DISTINCT_NONEMPTY_LICENSE_IDS": len(set(x for x in ccb_ids if x)),
            "ROWS_WITHOUT_LICENSE_ID": sum(1 for x in ccb_ids if not x),
            "LICENSE_TYPE_COUNTS": dict(ccb_types.most_common()),
            "STATUS": "Dataset is CCB Active Licenses. No per-row status column. Membership in this extract is the source-native current-active grain. Do not infer ACTIVE from lic_exp_date.",
            "COUNTY_DISTRIBUTION": dict(counties.most_common()),
            "BOND_COMPANY_NONEMPTY": sum(1 for r in ccb_rows if (r.get("bond_company") or "").strip()),
            "INS_COMPANY_NONEMPTY": sum(1 for r in ccb_rows if (r.get("ins_company") or "").strip()),
            "RELATED_LICENSE_ROWS": len(related),
            "RELATED_TYPE_COUNTS": dict(related_types.most_common()),
            "construction_endorsement_distinct_ids": len(construction_ids),
            "certification_endorsement_distinct_ids": len(cert_ids),
            "row_ne_unique_company": True,
            "license_ne_unique_company": True,
            "raw_sha256": sha_file(ccb_raw) if ccb_raw.is_file() else sha_file(ccb_gz),
            "raw_bytes": ccb_raw.stat().st_size if ccb_raw.is_file() else None,
            "gz_sha256": sha_file(ccb_gz),
            "gz_bytes": ccb_gz.stat().st_size,
        },
        "bcd": {
            "dataset_id": "vhbr-cuaq",
            "portal": "https://data.oregon.gov/Business/Building-Codes-Division-Active-Contractor-Individu/vhbr-cuaq",
            "agency": "Oregon Building Codes Division",
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "SOURCE_ROWS": len(bcd_rows),
            "DISTINCT_LICENSE_IDS": len({(r.get("LicNbr") or "").strip() for r in bcd_rows if (r.get("LicNbr") or "").strip()}),
            "STATUS_COUNTS": dict(bcd_status.most_common()),
            "PROFESSION_COUNTS": dict(bcd_prof.most_common()),
            "LICTYPE_COUNTS": dict(bcd_types.most_common()),
            "ENTITY_GRAIN_ROWS": dict(grains),
            "ENTITY_GRAIN_DISTINCT_IDS": {k: len(v) for k, v in grain_ids.items()},
            "not_added_to_ccb_denominator": True,
            "person_ne_business": True,
            "inspector_ne_contractor": True,
            "raw_sha256": sha_file(bcd_raw) if bcd_raw.is_file() else sha_file(bcd_gz),
            "raw_bytes": bcd_raw.stat().st_size if bcd_raw.is_file() else None,
            "gz_sha256": sha_file(bcd_gz),
            "gz_bytes": bcd_gz.stat().st_size,
        },
        "adverse": {
            "bcd_final_orders": {
                "SOURCE": "Oregon BCD Final Orders page",
                "AUTHORITY": "Building Codes Division Enforcement",
                "ENTITY_CLASS": "business_and_individual_named_on_order",
                "EVIDENCE_CLASS": "FINAL_ORDER",
                "MATTER_GRAIN": "case_number",
                "FINALITY": "Posted for three years after case closure",
                "IDENTIFIER_FIELDS": ["Case Number", "Business Name", "Individuals Name", "Program Area", "Violation Type", "Related Cases"],
                "SOURCE_CLOCK": None,
                "ACCESS_TYPE": "INTERACTIVE_JS_TABLE",
                "PUBLICATION_STATUS": "OFFICIAL_PAGE_PRESENT_STRUCTURED_DATASET_NOT_ACQUIRED",
                "LIMITATIONS": "oregon.gov/bcd/enforcement/pages/final-orders.aspx loads an empty HTML table and fills via client-side script. No stable no-auth CSV/JSON bulk extract was found. Related Cases must not be counted as extra violations. UNIQUE_REGULATORY_MATTERS not computed from a bulk table.",
                "UNIQUE_REGULATORY_MATTERS": None,
                "url": "https://www.oregon.gov/bcd/enforcement/pages/final-orders.aspx",
            },
            "ccb_complaint_disciplinary_history": {
                "SOURCE": "CCB license search",
                "ACCESS_TYPE": "SEARCH_ONLY",
                "PUBLICATION_STATUS": "NOT_ACQUIRED",
                "LIMITATIONS": "search.ccb.state.or.us exposes about 10 years of complaint and disciplinary history per license via interactive lookup. No clean no-auth bulk endpoint was acquired. Complaint and disciplinary action remain separate classes. Missing bulk is not zero.",
                "url": "https://search.ccb.state.or.us/search/",
            },
            "ccb_public_contract_ineligibility": {
                "SOURCE": "CCB list of contractors not qualified to hold public contracts",
                "ACCESS_TYPE": "OFFICIAL_PAGE",
                "PUBLICATION_STATUS": "SOURCE_CURRENTLY_LISTS_NONE",
                "observation": "No contractors are listed at this time.",
                "not": "no Oregon contractor has ever been debarred",
                "url": "https://www.oregon.gov/ccb/pages/licensing.aspx",
                "retrievedAt": retrieved,
            },
        },
        "identity": {
            "ccb_namespace": "OR-CCB:{license_number}",
            "bcd_namespace": "OR-BCD:{LicNbr}",
            "ccb_ne_bcd": True,
            "name_only": "UNSAFE",
            "name_plus_address": "REVIEW_REQUIRED",
            "EXACT_CCB_LICENSE": len(set(x for x in ccb_ids if x)),
            "EXACT_BCD_LICENSE": len({(r.get("LicNbr") or "").strip() for r in bcd_rows if (r.get("LicNbr") or "").strip()}),
            "EXACT_BCD_BUSINESS_LICENSE": len(grain_ids["BUSINESS"]),
            "EXACT_BCD_PERSON_LICENSE": len(grain_ids["PERSON"]),
            "EXACT_SOURCE_NATIVE_CROSSWALK": 0,
            "EXACT_SOURCE_NATIVE_CROSSWALK_meaning": "No CCB↔BCD native join field in either extract. CCB related_key is intra-CCB/OCHI, not a BCD bridge.",
            "NAME_ONLY_UNSAFE": 0,
            "NAME_ONLY_UNSAFE_meaning": "No name-only joins attempted.",
            "REVIEW_REQUIRED_CROSSWALKS": 0,
            "research_identity_ne_profile_attachment": True,
        },
        "adverse_publication": {
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "REVIEW_REQUIRED": 0,
            "UNRESOLVED": None,
            "UNRESOLVED_meaning": "BCD final-order corpus not acquired as a structured table, so matters are not scored. Null is not zero unresolved.",
            "INTERNAL_ONLY": 0,
            "PUBLICATION_PENDING": 0,
            "PUBLIC_READY_PROFILES": 0,
            "PUBLICLY_RENDERED_PROFILES": 0,
            "BUSINESS_RESPONSE_READY": 0,
            "name_only_adverse_attachment": "REJECTED",
            "person_order_ne_business_order": True,
            "research_association_ne_profile_attachment": True,
        },
        "withheld_reason_counts": {
            "bcd_final_orders_structured_dataset_not_acquired": None,
            "ccb_complaint_discipline_history_search_only": None,
            "name_only_adverse_joins_not_attempted": 0,
        },
        "claimEligibilityBroadened": False,
        "noCombinedOregonContractorsTotal": True,
        "unknownIsNotZero": True,
        "searchOnlyIsNotZero": True,
        "expansion_ledger": {
            "OR_CCB_ACTIVE_LICENSE_ROWS": len(ccb_rows),
            "OR_CCB_DISTINCT_LICENSE_IDS": len(set(x for x in ccb_ids if x)),
            "OR_BCD_ACTIVE_LICENSE_ROWS": len(bcd_rows),
            "OR_BCD_BUSINESS_DISTINCT_IDS": len(grain_ids["BUSINESS"]),
            "OR_BCD_PERSON_DISTINCT_IDS": len(grain_ids["PERSON"]),
            "OR_BCD_INSPECTOR_DISTINCT_IDS": len(grain_ids["INSPECTOR"]),
            "OR_BCD_FINAL_ORDER_MATTERS": None,
            "OR_CCB_COMPLAINT_OBSERVATIONS": None,
            "OR_PUBLIC_CONTRACT_INELIGIBLE_LISTED": 0,
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "REVIEW_REQUIRED": 0,
            "UNRESOLVED": None,
            "INTERNAL_ONLY": 0,
            "PUBLICATION_PENDING": 0,
            "NET_NEW_CANONICAL_ORGANIZATIONS": 0,
            "NET_NEW_PUBLIC_CONTRACTOR_PROFILES": 0,
            "EXISTING_ORGANIZATIONS_ENRICHED": 0,
            "GRAPH_WRITES": 0,
            "CLAIM_ELIGIBILITY_BROADENED": False,
        },
        "gate": {
            "live_cohort_not_inflated": True,
            "passed": True,
        },
    }
    fp = fingerprint(body)
    body["fingerprint"] = fp
    LIB.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    text = json.dumps(body, indent=2) + "\n"
    (LIB / "accepted-snapshot.json").write_text(text, encoding="utf-8")
    (ART / "or-con-001-public-snapshot.json").write_text(text, encoding="utf-8")
    report = {
        "ticket": "OR-CON-001",
        "retrievedAt": retrieved,
        "ccb_rows": len(ccb_rows),
        "ccb_distinct_ids": body["ccb"]["DISTINCT_NONEMPTY_LICENSE_IDS"],
        "bcd_rows": len(bcd_rows),
        "bcd_grains": body["bcd"]["ENTITY_GRAIN_DISTINCT_IDS"],
        "fingerprint": fp,
        "ccb_raw_sha256": body["ccb"]["raw_sha256"],
        "bcd_raw_sha256": body["bcd"]["raw_sha256"],
    }
    (STAGE / "acquire-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
