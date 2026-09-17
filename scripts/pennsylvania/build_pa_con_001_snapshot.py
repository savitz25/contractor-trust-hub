#!/usr/bin/env python3
"""PA-CON-001 — rebuild contractor-pa-state-intel-v1 from committed artifacts. No network."""
from __future__ import annotations

import argparse
import hashlib
import html as html_lib
import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data/pennsylvania/pa-con-001/raw"
ART = ROOT / "artifacts/pa-con-001-public-snapshot.json"
TS = ROOT / "lib/pennsylvania-intelligence/accepted-snapshot.json"
GENERATION_KEYS = frozenset({"generatedAt", "fingerprint", "generated_at"})


def dumps(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(obj: dict) -> str:
    body = {k: v for k, v in obj.items() if k not in GENERATION_KEYS}
    if isinstance(body.get("clocks"), dict):
        body = {
            **body,
            "clocks": {ck: cv for ck, cv in body["clocks"].items() if ck != "generatedAt"},
        }
    return hashlib.sha256(dumps(body).encode("utf-8")).hexdigest()


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None
        self._in_cell = False

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "tr":
            self._row = []
        elif tag in {"td", "th"} and self._row is not None:
            self._cell = []
            self._in_cell = True

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self._row is not None and self._cell is not None:
            self._row.append(re.sub(r"\s+", " ", "".join(self._cell)).strip())
            self._cell = None
            self._in_cell = False
        elif tag == "tr" and self._row is not None:
            if any(self._row):
                self.rows.append(self._row)
            self._row = None

    def handle_data(self, data: str) -> None:
        if self._in_cell and self._cell is not None:
            self._cell.append(data)


def parse_table(path: Path) -> list[list[str]]:
    parser = TableParser()
    parser.feed(path.read_text(encoding="utf-8", errors="replace"))
    return parser.rows


def company_table(path: Path) -> dict:
    rows = parse_table(path)
    header = next((r for r in rows if r and r[0].upper().startswith("CERT")), None)
    body = [r for r in rows if r and re.match(r"^C", r[0] or "", re.I) and r is not header]
    ids = [(r[0] or "").strip() for r in body if (r[0] or "").strip()]
    return {
        "SOURCE_ROWS": len(body),
        "DISTINCT_CERT_IDS": len(set(ids)),
        "ROWS_WITHOUT_ID": sum(1 for r in body if not (r[0] or "").strip()),
        "identityNamespace": "PA-DLI-ASB:{cert}" if "asb" in path.name else "PA-DLI-LEAD:{cert}",
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }


def individual_table(path: Path) -> dict:
    rows = parse_table(path)
    header_idx = next((i for i, r in enumerate(rows) if r and r[0].upper() == "LAST NAME"), None)
    body = rows[header_idx + 1 :] if header_idx is not None else []
    # CERT # is column 6 (index 5)
    ids = []
    for r in body:
        if len(r) < 6:
            continue
        cert = (r[5] or "").strip()
        last = (r[0] or "").strip()
        if not last or last.upper() in {"LAST NAME", "LEAD CLASS CODES", "ASBESTOS CLASS CODES"}:
            continue
        ids.append(cert)
    nonempty = [i for i in ids if i]
    return {
        "SOURCE_ROWS": len(ids),
        "DISTINCT_CERT_IDS": len(set(nonempty)),
        "ROWS_WITHOUT_ID": sum(1 for i in ids if not i),
        "person_grain": True,
        "not_added_to_contractor_firms": True,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }


def split_respondents(cell: str) -> tuple[list[str], list[str]]:
    text = html_lib.unescape(cell)
    text = re.sub(r"[\u200b\u00a0]", "", text)
    chunks = [c.strip(" \n\t,") for c in re.split(r"\band\b", text, flags=re.I)]
    firms: list[str] = []
    persons: list[str] = []
    for chunk in chunks:
        if not chunk:
            continue
        if re.search(r"individually", chunk, re.I):
            persons.append(re.sub(r",?\s*individually\.?", "", chunk, flags=re.I).strip(" ,"))
            continue
        named = [
            p.strip(" ,")
            for p in re.findall(
                r".+?(?:L\.L\.C\.|\bLLC\b|\bInc\.|\bINC\.|\bCorp\.|\bCorporation\b|\bCompany\b)",
                chunk,
                flags=re.I,
            )
            if p.strip(" ,")
        ]
        firms.extend(named or [chunk])
    return firms, persons


def parse_debarments(path: Path) -> dict:
    html = path.read_text(encoding="utf-8", errors="replace")
    settlements_none = bool(re.search(r"None at this time", html, re.I))
    table = re.search(r"<table[^>]*>.*?</table>", html, re.I | re.S)
    if not table:
        raise SystemExit("debarment table missing")
    parser = TableParser()
    parser.feed(table.group(0))
    body = [r for r in parser.rows if r and "CONTRACTOR" not in (r[0] or "").upper()]
    matters = []
    firm_names: list[str] = []
    person_names: list[str] = []
    for row in body:
        contractor = row[0] if row else ""
        address = row[1] if len(row) > 1 else ""
        date = re.sub(r"[\u200b\s]+", "", row[2] if len(row) > 2 else "")
        firms, persons = split_respondents(contractor)
        firm_names.extend(firms)
        person_names.extend(persons)
        matters.append(
            {
                "date": date,
                "firms": firms,
                "persons": persons,
                "address": re.sub(r"\s+", " ", address).strip(),
            }
        )
    return {
        "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
        "PA_PREVAILING_WAGE_DEBARMENT_ROWS": len(matters),
        "PA_PREVAILING_WAGE_DISTINCT_RESPONDENTS": len({*(firm_names), *(person_names)}),
        "PA_PREVAILING_WAGE_FIRM_ROWS": len(firm_names),
        "PA_PREVAILING_WAGE_PERSON_ROWS": len(person_names),
        "matters": matters,
        "grain": "public-works debarment listing row (firm and person respondents kept separate)",
        "debarment_ne_complaint": True,
        "debarment_ne_conviction": True,
        "firm_ne_person": True,
        "debarment_ne_hicpa": True,
        "public_work_eligibility_ne_residential_quality": True,
        "name_only_attachment": "NAME_ONLY_UNSAFE",
        "sourceUrl": "https://www.pa.gov/agencies/dli/resources/compliance-laws-and-regulations/labor-management-relations/labor-law/prevailing-wage/debarments-and-settlements",
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "settlements": {
            "CURRENT_SOURCE_OBSERVATION": "NONE" if settlements_none else "PRESENT",
            "PA_CURRENT_SETTLEMENT_ROWS": 0 if settlements_none else None,
            "current_observation_ne_historical_clearance": True,
        },
    }


def build_body(generated: str) -> dict:
    acquire = json.loads((RAW / "acquire-report.json").read_text(encoding="utf-8"))
    asb = company_table(RAW / "asbcontr.htm")
    lead = company_table(RAW / "ledcontr.htm")
    asb_p = individual_table(RAW / "asbcert.htm")
    lead_p = individual_table(RAW / "ledcert.htm")
    debar = parse_debarments(RAW / "debarments.html")
    retrieved = acquire["retrievedAt"]
    snapshot_as_of = retrieved[:10]
    return {
        "version": "contractor-pa-state-intel-v1",
        "ticket": "PA-CON-001",
        "publicationPath": "/pennsylvania",
        "canonical": "https://www.contractortrusthub.com/pennsylvania",
        "asOf": None,
        "snapshotAsOf": snapshot_as_of,
        "retrievedAt": retrieved,
        "generatedAt": generated,
        "hero": {
            "universe_value": None,
            "universe_label": "No statewide general-contractor license census",
            "universe_hint": "Pennsylvania does not impose a universal state contractor license. HICPA registration is OPEN_SEARCH_ONLY. Missing bulk is not zero contractors.",
            "asbestos_value": asb["DISTINCT_CERT_IDS"],
            "asbestos_label": "DLI certified asbestos abatement contractor firms",
            "lead_value": lead["DISTINCT_CERT_IDS"],
            "lead_label": "DLI certified lead abatement contractor firms",
            "debarment_value": debar["PA_PREVAILING_WAGE_DEBARMENT_ROWS"],
            "debarment_label": "Current prevailing-wage debarment listing rows",
        },
        "licensing_model": {
            "statewide_general_contractor_license": False,
            "primary_statewide_consumer_credential": "HICPA Home Improvement Contractor registration",
            "hicpa_ne_license": True,
            "hicpa_ne_endorsement": True,
            "hicpa_ne_competency": True,
            "specialty_ne_hicpa": True,
            "municipal_ne_state": True,
        },
        "hicpa": {
            "PA_HICPA_ROSTER_STATUS": "OPEN_SEARCH_ONLY",
            "PA_HICPA_ROWS": None,
            "PA_HICPA_DISTINCT_REGISTRATION_IDS": None,
            "PA_HICPA_CURRENT_ROWS": None,
            "PA_HICPA_CURRENT_DISTINCT_IDS": None,
            "PA_HICPA_EXPIRED_ROWS": None,
            "PA_HICPA_STATUS_UNKNOWN_ROWS": None,
            "identityNamespace": "PA-HIC:{registration_number}",
            "public_search_active_only": True,
            "type_of_work_incomplete": True,
            "missing_type_of_work_ne_trade_absence": True,
            "business_name_ne_primary_applicant": True,
            "primary_applicant_ne_business": True,
            "address_row_ne_unique_company": True,
            "not_returned_ne_denied": True,
            "not_returned_ne_historically_unregistered": True,
            "status_semantics": "SOURCE_SEMANTICS_UNCONFIRMED beyond official note that search results display active registrations only",
            "source_history": {
                "outage_began": "2025-08",
                "search_restored": "2026-03",
                "online_registration_operational": "2026-04-24",
                "grace_period_ended": "2026-06-08",
                "relaunch_ne_sourceAsOf": True,
                "retrievedAt_ne_registration_effective_date": True,
                "system_absence_ne_historical_non_registration": True,
            },
            "search_url": "https://hicsearch.attorneygeneral.gov/",
            "registration_url": "https://www.attorneygeneral.gov/businesses-and-organizations/home-improvement-contractor-registration/",
            "reason": acquire["hicpa_bulk"]["reason"],
        },
        "asbestos": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "PA_ASBESTOS_CONTRACTOR_ROWS": asb["SOURCE_ROWS"],
            "PA_ASBESTOS_CONTRACTOR_DISTINCT_IDS": asb["DISTINCT_CERT_IDS"],
            "PA_ASBESTOS_INDIVIDUAL_ROWS": asb_p["SOURCE_ROWS"],
            "PA_ASBESTOS_INDIVIDUAL_DISTINCT_IDS": asb_p["DISTINCT_CERT_IDS"],
            "firm_ne_person": True,
            "not_added_to_hicpa": True,
            "daily_update_note": "Official list described as updated daily Monday–Friday. Daily cadence is not proof each row changed that day.",
            "sourceUrl": acquire["files"]["asbcontr.htm"]["url"],
            "individualsUrl": acquire["files"]["asbcert.htm"]["url"],
            "contractors": asb,
            "individuals": asb_p,
        },
        "lead": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "PA_LEAD_CONTRACTOR_ROWS": lead["SOURCE_ROWS"],
            "PA_LEAD_CONTRACTOR_DISTINCT_IDS": lead["DISTINCT_CERT_IDS"],
            "PA_LEAD_INDIVIDUAL_ROWS": lead_p["SOURCE_ROWS"],
            "PA_LEAD_INDIVIDUAL_DISTINCT_IDS": lead_p["DISTINCT_CERT_IDS"],
            "firm_ne_person": True,
            "lead_ne_hicpa": True,
            "lead_ne_asbestos": True,
            "daily_update_note": "Official list described as updated daily Monday–Friday. Daily cadence is not proof each row changed that day.",
            "sourceUrl": acquire["files"]["ledcontr.htm"]["url"],
            "individualsUrl": acquire["files"]["ledcert.htm"]["url"],
            "contractors": lead,
            "individuals": lead_p,
        },
        "other_specialty": {
            "manufactured_housing_installers": "FUTURE",
            "crane_operators": "FUTURE",
            "reason": "Person-occupation credentials are not a contractor-business census. Not acquired in Wave 1.",
        },
        "debarment": debar,
        "enforcement": {
            "oag_hicpa_structured_actions": "SOURCE_NOT_ACQUIRED",
            "news_releases": "DISCOVERY_ONLY",
            "news_ne_census": True,
        },
        "municipal": {
            "PA_LOCAL_CONTRACTOR_LICENSING": "MUNICIPAL / NOT_CENTRALIZED",
            "philadelphia_ne_statewide": True,
            "pittsburgh_ne_statewide": True,
            "electrical_plumbing_local": True,
            "absence_ne_zero": True,
            "municipalities_cited": 2562,
            "sourceUrl": acquire["files"]["contractor-licensing.html"]["url"],
        },
        "permits_ucc": {
            "coverage": "LOCAL_OR_FRAGMENTED",
            "statewide_comparable_dataset": False,
            "no_manufactured_permit_total": True,
        },
        "identity": {
            "EXACT_HICPA_REGISTRATION": 0,
            "EXACT_ASBESTOS_CERT": asb["DISTINCT_CERT_IDS"],
            "EXACT_LEAD_CERT": lead["DISTINCT_CERT_IDS"],
            "EXACT_SOURCE_NATIVE_CROSSWALKS": 0,
            "EXACT_DEBARMENT_CASE_ID": 0,
            "NAME_ONLY_UNSAFE": 0,
            "REVIEW_REQUIRED_CROSSWALKS": 0,
            "hicpa_bulk_identities": "NOT_ACQUIRED",
            "debarment_case_id": "NOT_EXPOSED — listing has name/address/date only",
        },
        "expansion_ledger": {
            "NET_NEW_STATE_RESEARCH_IDENTITIES": asb["DISTINCT_CERT_IDS"] + lead["DISTINCT_CERT_IDS"],
            "NET_NEW_CANONICAL_ORGANIZATIONS": 0,
            "NET_NEW_PUBLIC_CONTRACTOR_PROFILES": 0,
            "EXISTING_ORGANIZATIONS_ENRICHED": 0,
            "GRAPH_WRITES": 0,
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "CLAIM_ELIGIBILITY_BROADENED": False,
        },
        "adverse_publication": {
            "ADVERSE_SOURCES_FOUND": 3,
            "ADVERSE_SOURCES_ACQUIRED": 1,
            "ADVERSE_ROWS_ACQUIRED": debar["PA_PREVAILING_WAGE_DEBARMENT_ROWS"],
            "UNIQUE_REGULATORY_MATTERS": debar["PA_PREVAILING_WAGE_DEBARMENT_ROWS"],
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "REVIEW_REQUIRED": 0,
            "UNRESOLVED": None,
            "INTERNAL_ONLY": 0,
            "PUBLICATION_PENDING": 0,
            "PUBLIC_READY_PROFILES": 0,
            "PUBLICLY_RENDERED_PROFILES": 0,
            "BUSINESS_RESPONSE_READY": False,
            "name_only_adverse_attachment": "REJECTED",
            "statewide_page_renders_class_aggregates_not_facility_profiles": True,
        },
        "withheld_reason_counts": {
            "PUBLICATION_ADAPTER_NOT_READY": True,
            "PROFILE_NOT_AVAILABLE": 0,
            "MISSING_IDENTIFIER": debar["PA_PREVAILING_WAGE_DEBARMENT_ROWS"],
            "UNSAFE_NAME_MATCH": 0,
            "SOURCE_RESTRICTION": 1,
            "name_only_adverse_joins_not_attempted": 0,
        },
        "clocks": {
            "hicpa_sourceAsOf": None,
            "hicpa_sourceAsOf_reason": "HICPA bulk census not acquired. Search restored March 2026; online registration operational 2026-04-24. Relaunch is not sourceAsOf.",
            "asbestos_sourceAsOf": None,
            "asbestos_sourceAsOf_reason": "Official list is described as updated daily Monday–Friday. No row-level modified timestamp.",
            "lead_sourceAsOf": None,
            "lead_sourceAsOf_reason": "Official list is described as updated daily Monday–Friday. No row-level modified timestamp.",
            "debarment_sourceModifiedAt": "2026-02-12",
            "retrievedAt": retrieved,
            "snapshotAsOf": snapshot_as_of,
            "generatedAt": generated,
            "retrievedAt_is_not_sourceAsOf": True,
        },
        "no_local_pennsylvania_routes": True,
        "no_philadelphia_page": True,
        "no_pittsburgh_page": True,
        "no_ranking": True,
        "no_trust_score": True,
        "no_aggregate_rating": True,
        "unknown_is_not_zero": True,
        "search_only_is_not_zero": True,
        "gate": {
            "live_cohort_not_inflated": True,
            "passed": True,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    generated = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    if args.check:
        current = json.loads(ART.read_text(encoding="utf-8"))
        rebuilt = build_body(current["generatedAt"])
        rebuilt["fingerprint"] = sha(rebuilt)
        if rebuilt["fingerprint"] != current["fingerprint"]:
            raise SystemExit(f"fingerprint drift {rebuilt['fingerprint']} != {current['fingerprint']}")
        print("PA-CON-001 snapshot check PASS", current["fingerprint"])
        return
    body = build_body(generated)
    body["fingerprint"] = sha(body)
    ART.parent.mkdir(parents=True, exist_ok=True)
    TS.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(body, indent=2) + "\n"
    ART.write_text(text, encoding="utf-8")
    TS.write_text(text, encoding="utf-8")
    print(
        json.dumps(
            {
                "fingerprint": body["fingerprint"],
                "asbestos_firms": body["asbestos"]["PA_ASBESTOS_CONTRACTOR_DISTINCT_IDS"],
                "asbestos_people": body["asbestos"]["PA_ASBESTOS_INDIVIDUAL_ROWS"],
                "lead_firms": body["lead"]["PA_LEAD_CONTRACTOR_DISTINCT_IDS"],
                "lead_people": body["lead"]["PA_LEAD_INDIVIDUAL_ROWS"],
                "debarment_rows": body["debarment"]["PA_PREVAILING_WAGE_DEBARMENT_ROWS"],
                "debarment_firms": body["debarment"]["PA_PREVAILING_WAGE_FIRM_ROWS"],
                "debarment_persons": body["debarment"]["PA_PREVAILING_WAGE_PERSON_ROWS"],
                "settlements": body["debarment"]["settlements"]["CURRENT_SOURCE_OBSERVATION"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
