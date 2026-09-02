"""NJ-CON-002A specialty credentials and OCP/Safe House enforcement parsers.

Credentials stay out of discipline. NOVs are not final orders.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from pathlib import Path
from typing import Any

from ingest.adapters.nj_public_works import _base_observation, canonical_value, parse_date, split_us_address
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
        out.append(obs)
    return out


def parse_safe_house_csv(path: Path) -> list[dict[str, Any]]:
    rows = list(csv.DictReader(path.open(encoding="utf-8-sig", newline="")))
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
            "raw_payload": {**row, "allegation": allegation, "disposition": "NOV_ISSUED_NOT_FINAL_ADJUDICATION", "penalty_proposed": row.get("penalty")},
        }
        obs = _base_observation("NJ_OPERATION_SAFE_HOUSE", raw, key)
        obs["source_record_locator"] = f"row:{i}"
        out.append(obs)
    return out


def parse_ocp_csv(path: Path) -> list[dict[str, Any]]:
    rows = list(csv.DictReader(path.open(encoding="utf-8-sig", newline="")))
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
            "raw_payload": {**row, "nov_is_not_final_order": doc == "NOV"},
        }
        obs = _base_observation("NJ_OCP_LEGAL_FILING", raw, key)
        obs["source_record_locator"] = f"row:{i}"
        out.append(obs)
    return out


def related_docket_links(filings: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Link filings that share an official docket or NOV number. Name-only is not a link."""
    by_id: dict[str, list[str]] = {}
    for f in filings:
        payload = f.get("raw_payload") or {}
        for ident in (payload.get("docket"), payload.get("nov_number"), f.get("certificate_or_vendor_id")):
            ident = canonical_value(ident)
            if ident:
                by_id.setdefault(ident, []).append(f["source_observation_key"])
    links = []
    for ident, keys in by_id.items():
        uniq = sorted(set(keys))
        if len(uniq) > 1:
            links.append({"identifier": ident, "observation_keys": uniq, "relation": "same_official_docket_or_nov"})
    return links
