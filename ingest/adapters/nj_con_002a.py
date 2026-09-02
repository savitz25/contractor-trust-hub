"""NJ-CON-002A specialty credentials and OCP/Safe House enforcement parsers.

Credentials stay out of discipline. NOVs are not final orders.
Unacquired sources are SOURCE_NOT_ACQUIRED, never a zero-observation scan.
OCP filings are PARTIAL_SOURCE_COVERAGE: four indexed PDFs are not a complete
contractor-enforcement corpus and cannot support "no other record found."
"""
from __future__ import annotations

import csv
import hashlib
import re
from pathlib import Path
from typing import Any

from ingest.adapters.nj_public_works import (
    SOURCE_COVERAGE_ACQUIRED,
    SOURCE_COVERAGE_NOT_ACQUIRED,
    SOURCE_COVERAGE_PARTIAL,
    _base_observation,
    canonical_value,
)

# Repeatable complete files vs partial index vs not acquired.
# PWCR / prevailing-wage remain SOURCE_NOT_ACQUIRED from NJ-CON-001 (OPRA).
FAMILY_COVERAGE: dict[str, dict[str, Any]] = {
    "NJ_LEAD_EVALUATION": {
        "coverage": SOURCE_COVERAGE_ACQUIRED,
        "repeatable": True,
        "evidence_class": "specialty_credential",
        "source_as_of": "2026-08-11",
        "agency": "NJ DCA Lead Hazard Control",
        "url": "https://www.nj.gov/dca/codes/lhi/lead_eval_contrs.shtml",
        "note": "Official current lead-evaluation contractor certification list.",
    },
    "NJ_LEAD_ABATEMENT": {
        "coverage": SOURCE_COVERAGE_ACQUIRED,
        "repeatable": True,
        "evidence_class": "specialty_credential",
        "source_as_of": "2026-07-15",
        "agency": "NJ DCA Lead Hazard Control",
        "url": "https://www.nj.gov/dca/codes/lhi/ld_abat_c.shtml",
        "note": "Official current lead-abatement contractor certification list. Distinct from lead evaluation.",
    },
    "NJ_ASCM_AUTHORIZATION": {
        "coverage": SOURCE_COVERAGE_ACQUIRED,
        "repeatable": True,
        "evidence_class": "specialty_credential",
        "source_as_of": "2026-07-30",
        "agency": "NJ DCA Codes and Standards",
        "url": "https://www.nj.gov/dca/codes/lhi/asmlist.shtml",
        "note": "Asbestos Safety Control Monitoring authorization. Not a DOL asbestos-abatement-contractor license.",
    },
    "NJ_FIRE_PROTECTION_PERMIT": {
        "coverage": SOURCE_COVERAGE_ACQUIRED,
        "repeatable": True,
        "evidence_class": "specialty_credential",
        "source_as_of": "2026-07-02",
        "agency": "NJ DFS Fire Protection",
        "url": "https://www.nj.gov/dca/dfs/",
        "note": "Current Fire Protection Equipment Contractor permitted-business list. Classes C1–C6 preserved separately.",
    },
    "NJ_OPERATION_SAFE_HOUSE": {
        "coverage": SOURCE_COVERAGE_ACQUIRED,
        "repeatable": True,
        "evidence_class": "regulatory_event",
        "source_as_of": "2025-12-01",
        "agency": "NJ Division of Consumer Affairs",
        "url": "https://www.njoag.gov/division-of-consumer-affairs-undercover-enforcement-operations-result-in-notices-of-violations-against-18-unregistered-home-improvement-contractor-businesses-and-11-unlicensed-moving-companies/",
        "note": "Operation Safe House HIC NOVs. Notices of Violation and proposed penalties, not final orders or paid fines.",
    },
    "NJ_OCP_LEGAL_FILING": {
        "coverage": SOURCE_COVERAGE_PARTIAL,
        "repeatable": True,
        "evidence_class": "regulatory_event",
        "source_as_of": "2025-06-27",
        "agency": "NJ Division of Consumer Affairs Office of Consumer Protection",
        "url": "https://www.njconsumeraffairs.gov/ocp/Pages/LegalFilings.aspx",
        "note": (
            "PARTIAL_SOURCE_COVERAGE: four published OCP PDFs were indexed. "
            "This is not a complete historical contractor-enforcement corpus. "
            "These four documents cannot support a public statement such as "
            "'No other enforcement record found.'"
        ),
        "acquired_document_count": 4,
        "corpus_complete": False,
    },
    "NJ_NEW_HOME_BUILDER": {
        "coverage": SOURCE_COVERAGE_NOT_ACQUIRED,
        "repeatable": False,
        "evidence_class": "specialty_credential",
        "agency": "NJ DCA New Home Warranty Program",
        "url": "https://serviceportal.dca.nj.gov/ultra-bhp-home/bhp-home-builder-search/",
        "barrier": "Official list is a DCA Service Portal lookup; brlist.pdf 404. No deterministic full-file export. Not merged with HIC.",
    },
    "NJ_HEC_REGISTRATION": {
        "coverage": SOURCE_COVERAGE_NOT_ACQUIRED,
        "repeatable": False,
        "evidence_class": "specialty_credential",
        "agency": "NJ DCA",
        "url": "https://www.nj.gov/dca/",
        "barrier": "No official standalone Home Elevation Contractor roster acquired. Disaster-recovery program lists are not the HEC registration export. Not flattened into HIC.",
    },
    "NJ_BOARD_ACTION": {
        "coverage": SOURCE_COVERAGE_NOT_ACQUIRED,
        "repeatable": False,
        "evidence_class": "regulatory_event",
        "agency": "NJ Division of Consumer Affairs contractor boards",
        "url": "https://www.njconsumeraffairs.gov/",
        "barrier": "No official bulk contractor-board action index acquired. OCP legal filings are a separate partial family.",
    },
    "NJ_PWCR_REGISTRATION": {
        "coverage": SOURCE_COVERAGE_NOT_ACQUIRED,
        "repeatable": False,
        "evidence_class": "registration_roster",
        "agency": "NJDOL Division of Wage and Hour Compliance",
        "url": "https://www.nj.gov/labor/wageandhour/registration-permits/register/publicworksregistration.shtml",
        "barrier": "Official roster is a Power BI interactive view. OPRA preserved. Do not wait on OPRA for this ticket.",
    },
    "NJ_PREVAILING_WAGE_DEBARMENT": {
        "coverage": SOURCE_COVERAGE_NOT_ACQUIRED,
        "repeatable": False,
        "evidence_class": "exclusion_list",
        "agency": "NJDOL Division of Wage and Hour Compliance",
        "url": "https://www.nj.gov/labor/wageandhour/registration-permits/register/debarmentlist.shtml",
        "barrier": "Official list is a Power BI interactive view. OPRA preserved. Do not wait on OPRA for this ticket.",
    },
}

SPECIALTY_FAMILIES = (
    "NJ_LEAD_EVALUATION",
    "NJ_LEAD_ABATEMENT",
    "NJ_ASCM_AUTHORIZATION",
    "NJ_FIRE_PROTECTION_PERMIT",
)
REGULATORY_FAMILIES = (
    "NJ_OPERATION_SAFE_HOUSE",
    "NJ_OCP_LEGAL_FILING",
    "NJ_BOARD_ACTION",
)
UNACQUIRED_FAMILIES = tuple(
    fam for fam, meta in FAMILY_COVERAGE.items() if meta["coverage"] == SOURCE_COVERAGE_NOT_ACQUIRED
)
from ingest.nj_identity_match import apply_matches, build_license_index, load_license_csv

LEAD_LINE = re.compile(
    r"^(?P<cert>\d{5})\s+(?P<rest>.+?)\s+(?P<st>NJ|NY|PA|TX|FL|DE|CT|MD)\s+(?P<zip>\d{5})\s+(?P<tail>.+)$"
)
PHONE = re.compile(r"(\d{3}-\d{3}-\d{4}|\d{3}-\d{7})")
SPEC = re.compile(r"(RS\s*/\s*PB|CB\s*/\s*SS)")
EXP = re.compile(r"(\d{1,2}/\d{1,2}/\d{4})\s*$")
ASCM_AUTH = re.compile(r"\s(\d{1,3})\s*$")
FIRE_PERMIT = re.compile(r"^P\d{5}$")
FIRE_CLASS = re.compile(r"^C[1-6]$")
FIRE_DATE = re.compile(r"^\d{2}/\d{2}/\d{4}$")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def parse_lead_text(text: str, *, source_family: str, source_date: str | None) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for i, line in enumerate(text.splitlines(), start=1):
        line = canonical_value(line)
        m = LEAD_LINE.match(line)
        if not m:
            continue
        rest = m.group("rest")
        spec_m = SPEC.search(m.group("tail"))
        exp_m = EXP.search(m.group("tail"))
        phone_m = PHONE.search(m.group("tail"))
        specialties = []
        if spec_m:
            specialties.append(re.sub(r"\s+", "", spec_m.group(1).upper()))
            if "CB" in m.group("tail").upper() and "CB/SS" not in ",".join(specialties):
                if "CB / SS" in m.group("tail") or "CB/SS" in m.group("tail").replace(" ", ""):
                    if "CB/SS" not in specialties:
                        specialties.append("CB/SS")
        name = rest
        # Company is start of rest; address is mixed. Keep rest as name+address blob.
        key = {
            "cert": m.group("cert"),
            "name": name,
            "zip": m.group("zip"),
            "exp": exp_m.group(1) if exp_m else "",
            "family": source_family,
        }
        raw = {
            "official_business_name": name,
            "state": m.group("st"),
            "postal_code": m.group("zip"),
            "certificate_or_vendor_id": m.group("cert"),
            "registration_status": "CURRENT_SOURCE_LIST",
            "expiration_date": exp_m.group(1) if exp_m else None,
            "source_publication_date": source_date,
            "raw_payload": {
                "line": line,
                "specialties": specialties,
                "phone": phone_m.group(1) if phone_m else None,
                "credential_kind": "lead_evaluation" if "EVAL" in source_family else "lead_abatement",
            },
        }
        obs = _base_observation(source_family, raw, key)
        obs["source_record_locator"] = f"line:{i}"
        obs["action"] = None
        obs["source_coverage"] = SOURCE_COVERAGE_ACQUIRED
        out.append(obs)
    return out


def parse_ascm_text(text: str, *, source_date: str | None) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for i, line in enumerate(text.splitlines(), start=1):
        line = canonical_value(line)
        if not line or line.startswith("LIST OF") or line.startswith("BUSINESS NAME") or line.startswith("AUTH") or line.startswith("Updated") or "(PURSUANT" in line:
            continue
        auth_m = ASCM_AUTH.search(line)
        if not auth_m:
            continue
        auth = auth_m.group(1)
        body = line[: auth_m.start()].strip()
        st_m = re.search(r"\s(NJ|NY|PA|DE)\s+(\d{5})\s+", body)
        name = body
        city = ""
        postal = st_m.group(2) if st_m else ""
        state = st_m.group(1) if st_m else "NJ"
        if st_m:
            name = body[: st_m.start()].strip()
        key = {"auth": auth, "name": name, "zip": postal}
        raw = {
            "official_business_name": name,
            "city": city or None,
            "state": state,
            "postal_code": postal or None,
            "certificate_or_vendor_id": auth,
            "registration_status": "AUTHORIZED_SOURCE_LIST",
            "source_publication_date": source_date,
            "raw_payload": {"line": line, "credential_kind": "ascm_authorization", "not_dol_asbestos_abatement": True},
        }
        obs = _base_observation("NJ_ASCM_AUTHORIZATION", raw, key)
        obs["source_record_locator"] = f"line:{i}"
        obs["source_coverage"] = SOURCE_COVERAGE_ACQUIRED
        out.append(obs)
    return out


def parse_fire_text(text: str, *, source_date: str | None) -> list[dict[str, Any]]:
    lines = [canonical_value(x) for x in text.splitlines() if canonical_value(x)]
    records: list[list[str]] = []
    current: list[str] = []
    skip = {"Fire Protection Equipment Contractor - Permitted Business", "Business Name", "Permit", "Lapse", "Address 1", "Address 2", "City", "State", "Zipcode", "Permits"}
    for line in lines:
        if line in skip or line.startswith("Thursday") or line.startswith("Page ") or line.startswith("Key:") or line.startswith("Fire Protection Contractor"):
            continue
        if FIRE_PERMIT.match(line) and current and not any(FIRE_PERMIT.match(x) for x in current):
            current.append(line)
            continue
        if FIRE_PERMIT.match(line):
            if current:
                records.append(current)
            current = [line]
            continue
        if current:
            current.append(line)
        elif re.search(r"[A-Za-z]", line) and not FIRE_CLASS.match(line):
            if current:
                records.append(current)
            current = [line]
    if current:
        records.append(current)

    out: list[dict[str, Any]] = []
    for i, rec in enumerate(records, start=1):
        permit = next((x for x in rec if FIRE_PERMIT.match(x)), "")
        if not permit:
            continue
        lapse = next((x for x in rec if FIRE_DATE.match(x)), "")
        classes = [x for x in rec if FIRE_CLASS.match(x)]
        name = rec[0] if rec and not FIRE_PERMIT.match(rec[0]) else rec[1] if len(rec) > 1 else ""
        state = next((x for x in rec if x in {"NJ", "NY", "PA", "DE", "TX", "OH", "MD", "CT"}), "NJ")
        postal = next((x for x in rec if re.fullmatch(r"\d{5}(?:-\d{4})?", x)), "")
        key = {"permit": permit, "lapse": lapse, "classes": ",".join(classes)}
        raw = {
            "official_business_name": name,
            "state": state,
            "postal_code": postal or None,
            "certificate_or_vendor_id": permit,
            "registration_status": "CURRENT_SOURCE_LIST",
            "expiration_date": lapse or None,
            "source_publication_date": source_date,
            "raw_payload": {
                "permit_classes": classes,
                "class_meanings": {
                    "C1": "All Fire Protection Equipment Systems",
                    "C2": "Fire Sprinkler System",
                    "C3": "Special Hazard Fire Suppression System",
                    "C4": "Fire Alarm System",
                    "C5": "Portable Fire Extinguisher",
                    "C6": "Kitchen Fire Suppression System",
                },
                "lines": rec,
                "do_not_infer_all_classes": True,
            },
        }
        obs = _base_observation("NJ_FIRE_PROTECTION_PERMIT", raw, key)
        obs["source_record_locator"] = f"block:{i}"
        obs["source_coverage"] = SOURCE_COVERAGE_ACQUIRED
        out.append(obs)
    return out


def parse_safe_house_csv(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))
    out = []
    for i, row in enumerate(rows, start=2):
        violation = canonical_value(row.get("violation"))
        if "Renew" in violation:
            allegation = "failure_to_renew"
        elif "Register" in violation:
            allegation = "failure_to_register"
        else:
            allegation = "unregistered_or_expired"
        key = {k: canonical_value(v) for k, v in row.items()}
        raw = {
            "official_business_name": row.get("company"),
            "individual_name": row.get("principal"),
            "city": row.get("town"),
            "county": row.get("county"),
            "state": row.get("state") or "NJ",
            "action": "NOV",
            "reason_text": violation,
            "source_publication_date": row.get("source_date"),
            "raw_payload": {
                **row,
                "allegation": allegation,
                "disposition": "NOV_ISSUED_NOT_FINAL_ADJUDICATION",
                "penalty_proposed": row.get("penalty"),
                "penalty_is_paid_fine": False,
                "penalty_is_final_adjudication": False,
                "source_coverage": SOURCE_COVERAGE_ACQUIRED,
            },
        }
        obs = _base_observation("NJ_OPERATION_SAFE_HOUSE", raw, key)
        obs["source_record_locator"] = f"row:{i}"
        obs["source_coverage"] = SOURCE_COVERAGE_ACQUIRED
        out.append(obs)
    return out


def parse_ocp_csv(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))
    out = []
    for i, row in enumerate(rows, start=2):
        doc = canonical_value(row.get("document_type"))
        key = {k: canonical_value(v) for k, v in row.items()}
        raw = {
            "official_business_name": row.get("respondent"),
            "certificate_or_vendor_id": row.get("nov_number") or row.get("docket"),
            "action": doc,
            "effective_date": row.get("filed_date"),
            "source_publication_date": row.get("filed_date"),
            "raw_payload": {
                **row,
                "nov_is_not_final_order": doc == "NOV",
                "source_coverage": SOURCE_COVERAGE_PARTIAL,
                "corpus_complete": False,
                "absence_is_not_no_record_found": True,
            },
        }
        obs = _base_observation("NJ_OCP_LEGAL_FILING", raw, key)
        obs["source_record_locator"] = f"row:{i}"
        obs["source_coverage"] = SOURCE_COVERAGE_PARTIAL
        out.append(obs)
    return out


def related_docket_links(filings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Link filings that share an NOV, or the same docket AND the same respondent.

    OCP docket numbers are reused across unrelated respondents (e.g. Progressive
    Paving and TNT Builders both carry docket 24-013 on distinct PDFs). A shared
    docket string is not proof they are the same official case. Name-only is
    never a link.
    """
    by_nov: dict[str, list[str]] = {}
    by_docket_respondent: dict[tuple[str, str], list[str]] = {}
    for f in filings:
        payload = f.get("raw_payload") or {}
        nov = canonical_value(payload.get("nov_number"))
        docket = canonical_value(payload.get("docket"))
        respondent = canonical_value(payload.get("respondent") or f.get("official_business_name"))
        if nov:
            by_nov.setdefault(nov, []).append(f["source_observation_key"])
        if docket and respondent:
            by_docket_respondent.setdefault((docket, respondent), []).append(f["source_observation_key"])
    links: list[dict[str, Any]] = []
    for ident, keys in by_nov.items():
        uniq = sorted(set(keys))
        if len(uniq) > 1:
            links.append({"identifier": ident, "observation_keys": uniq, "relation": "same_official_nov"})
    for (docket, respondent), keys in by_docket_respondent.items():
        uniq = sorted(set(keys))
        if len(uniq) > 1:
            links.append({
                "identifier": docket,
                "respondent": respondent,
                "observation_keys": uniq,
                "relation": "same_official_docket_and_respondent",
            })
    return links


def coverage_record(family: str) -> dict[str, Any]:
    meta = FAMILY_COVERAGE[family]
    rec = {
        "source_family": family,
        "source_coverage": meta["coverage"],
        "evidence_class": meta["evidence_class"],
        "repeatable": meta["repeatable"],
        "agency": meta.get("agency"),
        "url": meta.get("url"),
        "note": meta.get("note") or meta.get("barrier"),
        "observations_written": 0,
        "zero_valued_observation": False,
    }
    if meta["coverage"] == SOURCE_COVERAGE_NOT_ACQUIRED:
        rec["barrier"] = meta.get("barrier")
        rec["clean_history_conclusion"] = False
        rec["public_absence_claim_allowed"] = False
    if meta["coverage"] == SOURCE_COVERAGE_PARTIAL:
        rec["corpus_complete"] = False
        rec["acquired_document_count"] = meta.get("acquired_document_count")
        rec["public_absence_claim_allowed"] = False
    return rec


def observations_allowed(family: str) -> bool:
    return FAMILY_COVERAGE[family]["coverage"] != SOURCE_COVERAGE_NOT_ACQUIRED
