#!/usr/bin/env python3
"""MA-CON-001 — Massachusetts ContractorTrustHub statewide evidence.

Stage 1 (--acquire-parse; needs gitignored raw files in data/raw/massachusetts/ma-con-001/):
  DOL disciplinary-action CSVs 2021-2024 + 2025 (Q1 year-to-date as published), filtered to the
  construction-trade boards EL (electricians, incl. fire/burglar alarm), PL and GF (plumbers and gas
  fitters), SM (sheet metal); DCAMM suspended/debarred table; AG Fair Labor Division debarment list.
  Writes committed derived JSON under data/massachusetts/ma-con-001/.
Stage 2 (default): derived JSON -> lib/massachusetts-intelligence/accepted-snapshot.json + fingerprint.
  --check rebuilds stage 2 and compares the fingerprint.

No HIC or CSL rows are acquired: the MA Contractor Hub HIC search is an interactive form with
reCAPTCHA and the CSL verification is a search form. No name-only joins. No combined totals.
"""
from __future__ import annotations

import csv
import hashlib
import html as htmllib
import io
import json
import re
import sys
from collections import Counter
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "massachusetts" / "ma-con-001"
STAGE = ROOT / "data" / "massachusetts" / "ma-con-001"
LIB = ROOT / "lib" / "massachusetts-intelligence"
GENERATED_AT = "2026-09-24T16:00:00Z"
RETRIEVAL_DATE = "2026-09-24"

DOL_PAGE = "https://www.mass.gov/info-details/division-of-occupational-licensure-disciplinary-actions"
DOL_PAST = "https://www.mass.gov/info-details/past-division-of-occupational-licensure-dol-disciplinary-actions"
DOL_FILES = {
    2021: ("https://www.mass.gov/files/csv/2024-04/Discipline_Inspection_Report_2021.csv", "2026-09-24T15:53:30Z", "Calendar year 2021"),
    2022: ("https://www.mass.gov/files/csv/2024-04/Discipline_Inspection_Report_2022.csv", "2026-09-24T15:53:28Z", "Calendar year 2022"),
    2023: ("https://www.mass.gov/files/csv/2024-05/Discipline_Inspection_Report_2023.csv", "2026-09-24T15:53:26Z", "Calendar year 2023"),
    2024: ("https://www.mass.gov/files/csv/2025-06/Discipline_Inspection_Report_2024.csv", "2026-09-24T15:53:13Z", "Calendar year 2024"),
    2025: ("https://www.mass.gov/files/csv/2025-04/website_Discipline_Inspection_report_2025_Q1.csv", "2026-09-24T15:53:36Z", "2025 year-to-date through Q1 (latest file DOL published)"),
}
BOARDS = {
    "EL": "Board of State Examiners of Electricians",
    "PL": "Board of State Examiners of Plumbers and Gas Fitters",
    "GF": "Board of State Examiners of Plumbers and Gas Fitters",
    "SM": "Sheet Metal Board",
}
DCAMM_PAGE = "https://www.mass.gov/info-details/contractors-and-vendors-suspended-or-debarred-by-dcamm"
DCAMM_RETRIEVED = "2026-09-24T15:47:00Z"
AG_PAGE = "https://www.mass.gov/info-details/fair-labor-division-data"
AG_FILE = "https://www.mass.gov/doc/ags-fair-labor-division-debarment-list/download"
AG_RETRIEVED = "2026-09-24T15:53:44Z"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def clean(v) -> str:
    return re.sub(r"\s+", " ", str(v if v is not None else "")).strip()


def iso(raw: str) -> str | None:
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", raw.strip())
    return date(int(m.group(3)), int(m.group(1)), int(m.group(2))).isoformat() if m else None


def read_csv(path: Path) -> list[dict]:
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1252")
    return [{clean(k): clean(v) for k, v in r.items()} for r in csv.DictReader(io.StringIO(text))]


def parse_dol() -> dict:
    rows, files = [], []
    for year, (url, retrieved, period) in DOL_FILES.items():
        path = RAW / f"dol-{year}.csv"
        all_rows = read_csv(path)
        files.append({"year": year, "url": url, "sha256": sha(path), "retrieved_at": retrieved, "period": period, "all_board_rows": len(all_rows)})
        for r in all_rows:
            board = r["BOARD CODE"]
            if board not in BOARDS:
                continue
            closed = iso(r["Closed date"])
            if not closed:
                raise SystemExit(f"Unparseable DOL closed date {r['Closed date']!r}")
            lic = r["LICENSEE NO"]
            rows.append(
                {
                    "id": f"MA-DOL:{r['COMPLIANCE NUMBER'] or r['COMPLAINT NUMBER']}:{board}:{lic or 'none'}",
                    "grain": "DOL_DISCIPLINE_REPORT_ROW",
                    "boardCode": board,
                    "board": BOARDS[board],
                    "tradeProfession": r["TRADE PROFESSION"],
                    "respondent": r["Respondent Name"],
                    "licenseNumber": lic or None,
                    "complaintNumber": r["COMPLAINT NUMBER"],
                    "complianceNumber": r["COMPLIANCE NUMBER"] or None,
                    "closedDate": closed,
                    "natureCodes": r["Nature Code"],
                    "decision": r["DECISION"],
                    "type": r["TYPE"],
                    "sourceYear": year,
                    "sourcePeriod": period,
                    "identity": f"MA-DOL-{board}:{lic}" if lic else None,
                    "attribution": "standalone_event_no_profile_join",
                }
            )
    ids = Counter(r["id"] for r in rows)
    if any(v > 1 for v in ids.values()):
        raise SystemExit("duplicate DOL row ids")
    rows.sort(key=lambda r: (r["closedDate"], r["id"]), reverse=True)
    return {"files": files, "rows": rows}


def parse_dcamm() -> dict:
    t = (RAW / "dcamm-suspended-debarred.html").read_text(encoding="utf-8")
    rows = []
    for tb in re.findall(r"<table.*?</table>", t, re.S):
        trs = re.findall(r"<tr.*?</tr>", tb, re.S)
        header = [clean(htmllib.unescape(re.sub(r"<[^>]+>", " ", c))) for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", trs[0], re.S)]
        if header != ["Party Debarred", "Basis for Debarment", "Extent of Restrictions Imposed", "Termination Date of Debarment", "Hearing Date"]:
            raise SystemExit(f"DCAMM header drifted {header}")
        for tr in trs[1:]:
            c = [clean(htmllib.unescape(re.sub(r"<[^>]+>", " ", x))) for x in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
            if not c:
                continue
            rows.append(
                {
                    "id": f"MA-DCAMM-DEBAR:{len(rows) + 1}",
                    "grain": "DCAMM_SUSPENSION_OR_DEBARMENT_ROW",
                    "party": c[0],
                    "basis": c[1],
                    "extent": c[2],
                    "terminationDate": c[3],
                    "hearingDate": c[4],
                    "attribution": "standalone_event_no_profile_join",
                }
            )
    return {"source_sha256": sha(RAW / "dcamm-suspended-debarred.html"), "rows": rows}


def parse_ag() -> dict:
    import openpyxl

    ws = openpyxl.load_workbook(RAW / "ag-fair-labor-debarment.xlsx", read_only=True).worksheets[0]
    all_rows = list(ws.iter_rows(values_only=True))
    header = [clean(h) for h in all_rows[0]]
    expected = ["Business Name(s)", "Employer Name(s)", "Business Street Address", "Business City", "State", "Debarred pursuant to (statute)", "Debarment begin date", "Debarment end date"]
    if header != expected:
        raise SystemExit(f"AG header drifted {header}")
    rows = []
    for r in all_rows[1:]:
        if not any(v is not None and clean(v) for v in r):
            continue
        d = lambda v: v.date().isoformat() if isinstance(v, datetime) else (clean(v) or None)
        begin, end = d(r[6]), d(r[7])
        rows.append(
            {
                "id": f"MA-AG-FLD-DEBAR:{len(rows) + 1}",
                "grain": "AG_FAIR_LABOR_DEBARMENT_ROW",
                "businessNames": clean(r[0]) or None,
                "employerNames": clean(r[1]) or None,
                "city": clean(r[3]) or None,
                "state": clean(r[4]) or None,
                "statute": clean(r[5]) or None,
                "debarmentBegin": begin,
                "debarmentEnd": end,
                "periodIncludesRetrievalDate": bool(
                    begin and end and re.match(r"\d{4}-\d\d-\d\d$", begin) and re.match(r"\d{4}-\d\d-\d\d$", end) and begin <= RETRIEVAL_DATE <= end
                ),
                "attribution": "standalone_event_no_profile_join",
            }
        )
    return {"source_sha256": sha(RAW / "ag-fair-labor-debarment.xlsx"), "sheet_rows_including_blank": len(all_rows) - 1, "rows": rows}


def acquire_parse() -> None:
    STAGE.mkdir(parents=True, exist_ok=True)
    for name, payload in (("dol-construction-discipline.json", parse_dol()), ("dcamm-debarment.json", parse_dcamm()), ("ag-fair-labor-debarment.json", parse_ag())):
        (STAGE / name).write_text(json.dumps(payload, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def load(name: str):
    return json.loads((STAGE / name).read_text(encoding="utf-8"))


def build() -> dict:
    dol, dcamm, ag = load("dol-construction-discipline.json"), load("dcamm-debarment.json"), load("ag-fair-labor-debarment.json")
    rows = dol["rows"]
    by_board = Counter(r["boardCode"] for r in rows)
    by_year = Counter(r["sourceYear"] for r in rows)
    decisions = Counter(d.strip() for r in rows for d in r["decision"].split(",") if d.strip())
    snapshot = {
        "contract_name": "contractor-ma-state-intel-v1",
        "ticket": "MA-CON-001",
        "path": "/massachusetts",
        "generated_at": GENERATED_AT,
        "credential_systems": [
            {
                "id": "hic",
                "label": "Home Improvement Contractor (HIC) registration",
                "agency": "Office of Consumer Affairs and Business Regulation — Home Improvement Contractor Program",
                "grain": "registration (business or individual contractor) for covered residential home-improvement work",
                "identifier": "HIC registration number",
                "lookup": "KNOWN",
                "lookupUrl": "https://contractorhub.mass.gov/s/hic-contractor-search",
                "bulk": "NOT_ACQUIRED",
                "bulkReason": "The MA Contractor Hub search is an interactive form (business name, contractor name, HIC number, city, ZIP) with reCAPTCHA. No download or export. Not bypassed.",
                "rowsAcquired": None,
            },
            {
                "id": "csl",
                "label": "Construction Supervisor License (CSL)",
                "agency": "Division of Occupational Licensure — Office of Public Safety and Inspections / Board of Building Regulations and Standards",
                "grain": "individual license for supervising building construction under 780 CMR",
                "identifier": "CSL number",
                "lookup": "KNOWN",
                "lookupUrl": "https://madpl.mylicense.com/Verification/",
                "bulk": "NOT_ACQUIRED",
                "bulkReason": "License Verification Site is a search form. No statewide export was found.",
                "rowsAcquired": None,
            },
            {
                "id": "electrician",
                "label": "Electrician licenses",
                "agency": "Division of Occupational Licensure — Board of State Examiners of Electricians",
                "grain": "individual license (journeyman/master) and business license classes",
                "identifier": "DOL license number",
                "lookup": "KNOWN",
                "lookupUrl": "https://www.mass.gov/info-details/division-of-occupational-licensure-check-a-license",
                "bulk": "NOT_ACQUIRED",
                "bulkReason": "Search-only license verification.",
                "rowsAcquired": None,
            },
            {
                "id": "plumber-gas",
                "label": "Plumber and gas fitter licenses",
                "agency": "Division of Occupational Licensure — Board of State Examiners of Plumbers and Gas Fitters",
                "grain": "individual license (journeyman/master) and business classes",
                "identifier": "DOL license number",
                "lookup": "KNOWN",
                "lookupUrl": "https://www.mass.gov/info-details/division-of-occupational-licensure-check-a-license",
                "bulk": "NOT_ACQUIRED",
                "bulkReason": "Search-only license verification.",
                "rowsAcquired": None,
            },
            {
                "id": "dcamm",
                "label": "DCAMM contractor certification (public building work)",
                "agency": "Division of Capital Asset Management and Maintenance",
                "grain": "public-contracting prequalification, not a residential license",
                "identifier": "DCAMM certification",
                "lookup": "KNOWN",
                "lookupUrl": "https://www.mass.gov/lists/contractors-standing-with-dcamm",
                "bulk": "NOT_ACQUIRED",
                "bulkReason": "Directory deferred; not a residential contractor census.",
                "rowsAcquired": None,
            },
        ],
        "hic_context": {
            "complaintIntake": "KNOWN",
            "complaintOutcomes": "NOT_ACQUIRED",
            "arbitration": "KNOWN process; outcomes NOT_ACQUIRED",
            "guarantyFund": "KNOWN process; claims and payments NOT_ACQUIRED",
            "providerLevelDetail": "Shown per contractor on the MA Contractor Hub search only (complaints, arbitration outcome, Guaranty Fund payouts owed). Not acquired.",
            "hicDiscipline": "NOT_ACQUIRED",
            "complaintUrl": "https://contractorhub.mass.gov/s/",
        },
        "dol_discipline": {
            "coverage": "PARTIAL",
            "agency": "Division of Occupational Licensure",
            "pages": [DOL_PAGE, DOL_PAST],
            "files": dol["files"],
            "window": "Closed dates in DOL report years 2021-2024 plus the 2025 Q1 year-to-date file; DOL had not published a later 2025 or 2026 file on 2026-09-24",
            "boards": BOARDS,
            "rows": len(rows),
            "distinctComplaints": len({r["complaintNumber"] for r in rows}),
            "rowsWithLicenseNumber": sum(1 for r in rows if r["licenseNumber"]),
            "rowsWithoutLicenseNumber": sum(1 for r in rows if not r["licenseNumber"]),
            "rowsByBoard": dict(sorted(by_board.items())),
            "rowsByReportYear": {str(k): v for k, v in sorted(by_year.items())},
            "decisionTerms": dict(decisions.most_common()),
            "excluded": "All non-construction boards (cosmetology, massage, real estate, health, etc.) and home inspectors",
            "notInReport": "DOL notes the report omits child-support suspensions and summary emergency suspensions.",
            "profileAttachments": 0,
            "events": rows,
        },
        "dcamm_debarment": {
            "coverage": "KNOWN",
            "agency": "Division of Capital Asset Management and Maintenance",
            "source": DCAMM_PAGE,
            "sourceSha256": dcamm["source_sha256"],
            "retrievedAt": DCAMM_RETRIEVED,
            "scope": "Parties suspended or debarred by DCAMM under M.G.L. c.29 §29F and c.149 §44C only. Excludes MassDOT, AG, and DIA debarments.",
            "rows": len(dcamm["rows"]),
            "profileAttachments": 0,
            "events": dcamm["rows"],
        },
        "ag_fair_labor_debarment": {
            "coverage": "KNOWN",
            "agency": "Office of the Attorney General — Fair Labor Division",
            "source": AG_FILE,
            "page": AG_PAGE,
            "sourceSha256": ag["source_sha256"],
            "retrievedAt": AG_RETRIEVED,
            "scope": "Employers debarred from public construction and public works contracts (e.g. M.G.L. c.149 §27C, §148B, settlement agreements). Includes past periods.",
            "rows": len(ag["rows"]),
            "rowsWherePeriodIncludesRetrievalDate": sum(1 for r in ag["rows"] if r["periodIncludesRetrievalDate"]),
            "statuteCounts": dict(Counter(r["statute"] or "(blank in source)" for r in ag["rows"]).most_common()),
            "profileAttachments": 0,
            "events": ag["rows"],
        },
        "existing_coverage": {
            "statePage": "NONE (/massachusetts returned 404 before this ticket)",
            "liveCredentialSource": "NONE (MA not in the live Verify cohort)",
            "networkMetricsState": "UNKNOWN",
            "hicIdentities": 0,
            "cslIdentities": 0,
            "tradeIdentities": 0,
            "disciplineOrDebarment": 0,
            "localPages": 0,
        },
        "capability_matrix": [
            {"capability": "HIC registration lookup (official)", "state": "KNOWN"},
            {"capability": "HIC statewide bulk roster", "state": "NOT_ACQUIRED"},
            {"capability": "HIC complaint intake, arbitration, Guaranty Fund process", "state": "KNOWN"},
            {"capability": "HIC complaint, arbitration, and Guaranty Fund outcomes", "state": "NOT_ACQUIRED"},
            {"capability": "CSL lookup (official)", "state": "KNOWN"},
            {"capability": "CSL bulk roster", "state": "NOT_ACQUIRED"},
            {"capability": "Electrician / plumber / gas fitter bulk rosters", "state": "NOT_ACQUIRED"},
            {"capability": "DOL construction-trade discipline 2021 to 2025 Q1", "state": "PARTIAL"},
            {"capability": "DOL discipline 2025 Q2 onward and 2026", "state": "UNKNOWN"},
            {"capability": "DCAMM suspended or debarred parties", "state": "KNOWN"},
            {"capability": "AG Fair Labor debarment list", "state": "KNOWN"},
            {"capability": "DCAMM certified contractor directory", "state": "NOT_ACQUIRED"},
            {"capability": "HIC records by request", "state": "REQUEST_ONLY"},
            {"capability": "Name-only adverse attachment", "state": "UNSUPPORTED"},
            {"capability": "Combined Massachusetts licensed-contractor count", "state": "UNSUPPORTED"},
        ],
        "guardrails": [
            "HIC != CSL != trade license != DCAMM != debarment",
            "person license != contractor business",
            "complaint != finding; arbitration != discipline; Guaranty Fund payment != revocation",
            "not found != unlicensed; missing != zero",
            "no combined Massachusetts licensed contractors count",
            "no ranking, no Trust Score",
        ],
        "net_new": {
            "HIC_ROWS": 0,
            "CSL_ROWS": 0,
            "DOL_DISCIPLINE_ROWS": len(rows),
            "DCAMM_DEBARMENT_ROWS": len(dcamm["rows"]),
            "AG_FAIR_LABOR_DEBARMENT_ROWS": len(ag["rows"]),
            "PROFILE_ATTACHMENTS": 0,
            "NEW_PROFILES": 0,
        },
    }
    blob = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    snapshot["fingerprint"] = hashlib.sha256(blob).hexdigest()
    return snapshot


def summary(snap: dict) -> dict:
    """Counts only. Imported by the client-side Ask interpreter; events stay server-side."""
    d, dc, ag = snap["dol_discipline"], snap["dcamm_debarment"], snap["ag_fair_labor_debarment"]
    return {
        "fingerprint": snap["fingerprint"],
        "generatedAt": snap["generated_at"],
        "dolRows": d["rows"],
        "dolDistinctComplaints": d["distinctComplaints"],
        "dolRowsByBoard": d["rowsByBoard"],
        "dolWindow": "2021 to 2025 Q1",
        "dcammRows": dc["rows"],
        "agRows": ag["rows"],
        "agRowsCoveringRetrievalDate": ag["rowsWherePeriodIncludesRetrievalDate"],
        "retrievalDate": RETRIEVAL_DATE,
    }


def main() -> int:
    if "--acquire-parse" in sys.argv:
        acquire_parse()
    snap = build()
    target = LIB / "accepted-snapshot.json"
    summary_path = LIB / "summary.json"
    if "--check" in sys.argv:
        committed = json.loads(target.read_text(encoding="utf-8"))
        if committed.get("fingerprint") != snap["fingerprint"]:
            raise SystemExit(f"MA snapshot drifted: builder={snap['fingerprint']} committed={committed.get('fingerprint')}")
        if json.loads(summary_path.read_text(encoding="utf-8")) != summary(snap):
            raise SystemExit("MA summary drifted from snapshot")
        print("fingerprint check OK", snap["fingerprint"])
        return 0
    LIB.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(snap, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    summary_path.write_text(json.dumps(summary(snap), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    d = snap["dol_discipline"]
    print("fingerprint", snap["fingerprint"])
    print("dol", d["rows"], d["distinctComplaints"], d["rowsByBoard"], d["rowsByReportYear"])
    print("dcamm", snap["dcamm_debarment"]["rows"], "ag", snap["ag_fair_labor_debarment"]["rows"], snap["ag_fair_labor_debarment"]["rowsWherePeriodIncludesRetrievalDate"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
