#!/usr/bin/env python3
"""TN-CON-001 — Tennessee ContractorTrustHub statewide evidence.

Stage 1 (--acquire-parse; needs gitignored raw files in data/raw/tennessee/tn-con-001/):
  Board for Licensing Contractors "Contractor & Qualifying Agent Data" Tableau dashboard, public
  Download -> Crosstab -> CSV (UTF-16, tab-delimited; license x qualifying-agent rows). Emails, phones,
  street addresses, and qualifying-agent names are dropped; QA relationships are kept as counts.
  TDCI Regulatory Board Disciplinary Action Reports, Jan 2024 - Aug 2026, contractor-board rows only.
  -> data/tennessee/tn-con-001/*.json (committed)
Stage 2 (default): derived JSON -> lib/tennessee-intelligence/accepted-snapshot.json (aggregates),
  summary.json (client-safe counts), events.json (discipline rows), licenses/NN.json (license lookup
  shards by last two digits). --check rebuilds stage 2 and compares.

The dashboard holds Contractor licenses only. Home Improvement, LLE, and LLP are separate credentials
that are verified on the state search; no bulk file for them was found. No name-only joins.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "tennessee" / "tn-con-001"
STAGE = ROOT / "data" / "tennessee" / "tn-con-001"
LIB = ROOT / "lib" / "tennessee-intelligence"
GENERATED_AT = "2026-09-24T21:27:00Z"
DASHBOARD_RETRIEVED_AT = "2026-09-24T21:09:18Z"
DASHBOARD = "https://data.tn.gov/t/Public/views/ContractorandQAdata/PublicDashboard"
DASHBOARD_PAGE = "https://www.tn.gov/commerce/regboards/contractors/consumer/verify-qa.html"
VERIFY = "https://search.cloud.commerce.tn.gov/"
DAR_INDEX = "https://www.tn.gov/commerce/dar/rb.html"
DAR_ARCHIVE = "https://www.tn.gov/commerce/dar/rb/archive.html"
PROGRAM_PREFIX = "Contractors & Home Improvement"
CITIES = ["NASHVILLE", "MEMPHIS", "KNOXVILLE", "CHATTANOOGA"]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def iso(raw: str) -> str | None:
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", raw.strip())
    return date(int(m.group(3)), int(m.group(1)), int(m.group(2))).isoformat() if m else None


def parse_location(name_and_address: str) -> tuple[str, dict | None]:
    lines = [ln.strip() for ln in name_and_address.replace("\r", "").split("\n") if ln.strip()]
    name = lines[0] if lines else ""
    for ln in lines[1:]:
        m = re.match(r"^(.*),\s*([A-Z]{2})\s+(\d{5})", ln)
        if m:
            return name, {"city": m.group(1).strip().upper(), "state": m.group(2), "zip": m.group(3)}
    return name, None


def parse_classifications(raw: str) -> tuple[list[dict], str | None]:
    classes, limit = [], None
    for part in [p.strip() for p in raw.split(";") if p.strip()]:
        code, _, label = part.partition(" - ")
        code, label = code.strip(), label.strip()
        if code == "AGLM":
            limit = label.replace("Aggregate Limit", "").strip()
            continue
        classes.append({"code": code, "label": label})
    return classes, limit


def parse_dashboard() -> dict:
    path = RAW / "tn-contractor-qa.csv"
    text = path.read_bytes().decode("utf-16")
    rows = list(csv.reader(io.StringIO(text), delimiter="\t"))
    header = [h.strip() for h in rows[0] if h.strip()]
    expected = [
        "License Number",
        "License Status",
        "License Expiration Date",
        "License Origination Date",
        "Name and Address",
        "Classifications",
        "Qualifying Agent Name",
    ]
    if header != expected:
        raise SystemExit(f"dashboard columns drifted: {header}")
    body = rows[1:]
    by: dict[str, list[list[str]]] = defaultdict(list)
    for r in body:
        if r[0].strip():
            by[r[0].strip()].append(r)
    licenses = []
    labels: dict[str, str] = {}
    for lic, group in by.items():
        first = group[0]
        if len({(g[1], g[2], g[3], g[4], g[5]) for g in group}) != 1:
            raise SystemExit(f"license {lic} has inconsistent non-QA fields across rows")
        name, loc = parse_location(first[4])
        classes, limit = parse_classifications(first[5])
        for c in classes:
            labels.setdefault(f'{c["code"]} - {c["label"]}', str(len(labels)))
        licenses.append(
            {
                "license": lic,
                "name": name,
                "status": first[1].strip(),
                "expires": iso(first[2]),
                "originated": iso(first[3]),
                "city": loc["city"] if loc else None,
                "state": loc["state"] if loc else None,
                "zip": loc["zip"] if loc else None,
                "classifications": [labels[f'{c["code"]} - {c["label"]}'] for c in classes],
                "monetaryLimit": limit,
                "qualifyingAgents": sum(1 for g in group if g[6].strip()),
            }
        )
    licenses.sort(key=lambda x: int(x["license"]))
    app_rows = [r for r in body if not r[0].strip()]
    qa_names = [r[6].strip() for r in body if r[0].strip() and r[6].strip()]
    return {
        "source": DASHBOARD,
        "sourcePage": DASHBOARD_PAGE,
        "method": "Public Tableau toolbar: Download -> Crosstab -> sheet 'Contractor and QA Data_Public' -> CSV",
        "retrievedAt": DASHBOARD_RETRIEVED_AT,
        "sha256": sha(path),
        "columns": expected,
        "rows": len(body),
        "licenseRows": sum(len(g) for g in by.values()),
        "applicationRowsWithoutLicense": len(app_rows),
        "applicationStatuses": dict(Counter(r[1].strip() for r in app_rows).most_common()),
        "distinctQualifyingAgentNamesAsPrinted": len(set(qa_names)),
        "fieldsDropped": ["email", "phone", "street address", "qualifying agent name"],
        "classificationLabels": {v: k for k, v in labels.items()},
        "licenses": licenses,
    }


def parse_discipline() -> dict:
    import pdfplumber

    manifest = json.loads((RAW / "dar-manifest.json").read_text(encoding="utf-8"))
    events = []
    reports = []
    for it in manifest:
        path = RAW / it["file"]
        n = 0
        with pdfplumber.open(str(path)) as pdf:
            prog = None
            for pg in pdf.pages:
                for tb in pg.extract_tables():
                    for r in tb:
                        cells = [re.sub(r"\s+", " ", (c or "").replace("\xa0", " ")).strip() for c in r]
                        if cells[0] == "Program":
                            continue
                        if cells[0]:
                            prog = cells[0]
                        if not (prog or "").startswith(PROGRAM_PREFIX) or len(cells) < 6 or "NO ACTION" in cells[1].upper():
                            continue
                        n += 1
                        penalty = re.search(r"\$([\d,]+(?:\.\d\d)?) civil penalty", cells[4])
                        events.append(
                            {
                                "id": f"TN-BLC-DAR:{it['year']}-{it['month_label'][:3]}:{n}",
                                "grain": "TDCI_DISCIPLINARY_ACTION_REPORT_ROW",
                                "program": "Board for Licensing Contractors (Contractors & Home Improvement, Limited Licensed Electricians, Limited Licensed Plumbers)",
                                "respondent": cells[1],
                                "location": cells[2],
                                "violation": cells[3],
                                "action": cells[4],
                                "actionDate": iso(cells[5]),
                                "civilPenalty": float(penalty.group(1).replace(",", "")) if penalty else None,
                                "reportYear": it["year"],
                                "reportMonth": it["month_label"],
                                "reportUrl": it["url"],
                                "unlicensedActivity": bool(re.search(r"unlicensed", cells[3], re.I)),
                                "licenseNumberPrinted": None,
                                # Kept as published even when it falls outside the report period (source typo suspected).
                                "actionDateOutsideReportPeriod": bool(iso(cells[5]) and int(iso(cells[5])[:4]) < it["year"] - 1),
                                "attribution": "standalone_event_no_profile_join",
                            }
                        )
        reports.append({"year": it["year"], "month": it["month_label"], "url": it["url"], "sha256": it["sha256"], "retrievedAt": it["retrievedAt"], "contractorRows": n})
    if any(e["actionDate"] is None for e in events):
        raise SystemExit("unparsed discipline action date")
    events.sort(key=lambda e: (e["actionDate"], e["id"]), reverse=True)
    return {"index": DAR_INDEX, "archive": DAR_ARCHIVE, "reports": reports, "events": events}


def acquire_parse() -> None:
    STAGE.mkdir(parents=True, exist_ok=True)
    (STAGE / "blc-contractor-licenses.json").write_text(json.dumps(parse_dashboard(), separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    (STAGE / "blc-discipline.json").write_text(json.dumps(parse_discipline(), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def load(name: str):
    return json.loads((STAGE / name).read_text(encoding="utf-8"))


def events_bytes(obj) -> bytes:
    return (json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8")


def build():
    lic = load("blc-contractor-licenses.json")
    dis = load("blc-discipline.json")
    L = lic["licenses"]
    E = dis["events"]
    status = Counter(x["status"] for x in L)
    codes = Counter(c for x in L for c in x["classifications"])
    labels = lic["classificationLabels"]
    limits = Counter(x["monetaryLimit"] or "(not printed)" for x in L)
    city = {c.title(): sum(1 for x in L if x["state"] == "TN" and x["city"] == c) for c in CITIES}
    violations = Counter(e["violation"] for e in E)
    shards: dict[str, list] = defaultdict(list)
    for x in L:
        shards[x["license"][-2:].zfill(2)].append(x)
    snapshot = {
        "contract_name": "contractor-tn-state-intel-v1",
        "ticket": "TN-CON-001",
        "path": "/tennessee",
        "generated_at": GENERATED_AT,
        "regulator": {
            "board": "Tennessee Board for Licensing Contractors",
            "department": "Tennessee Department of Commerce & Insurance",
            "law": "Tenn. Code Ann. Title 62, Chapter 6",
            "verify": VERIFY,
            "dashboard": DASHBOARD_PAGE,
            "complaints": "https://access.cloud.commerce.tn.gov/portal/public/information/complaint",
            "disciplinaryActions": DAR_INDEX,
        },
        "credential_rules": [
            {
                "id": "contractor",
                "label": "Contractor license",
                "rule": "Required before contracting, including bidding, offering to engage, or negotiating a price, for projects of $25,000 or more when acting as a prime contractor, certain subcontractor, or construction manager/consultant. Electrical, mechanical, plumbing, HVAC, or roofing subcontractors contracting with a contractor need a license when their portion is $25,000 or more; masonry subcontractors at $100,000 or more.",
                "source": "https://www.tn.gov/commerce/regboards/contractors/license/get/contractor.html",
                "bulk": "KNOWN",
            },
            {
                "id": "home-improvement",
                "label": "Home Improvement Contractor license",
                "rule": "Required for residential remodeling projects from $3,000 to $24,999, only in counties that adopted the law: Bradley, Davidson, Hamilton, Haywood, Knox, Marion, Robertson, Rutherford, and Shelby.",
                "counties": ["Bradley", "Davidson", "Hamilton", "Haywood", "Knox", "Marion", "Robertson", "Rutherford", "Shelby"],
                "source": "https://www.tn.gov/commerce/regboards/contractors/license/get/home-improvement.html",
                "bulk": "NOT_ACQUIRED",
            },
            {
                "id": "lle",
                "label": "Limited Licensed Electrician (LLE)",
                "rule": "Required only for electricians working in a municipality that uses the Division of Fire Prevention for permits or inspections, for work under $25,000 per project. Check local requirements first. Issued to individuals.",
                "source": "https://www.tn.gov/commerce/regboards/contractors/license/get/lle.html",
                "bulk": "NOT_ACQUIRED",
            },
            {
                "id": "llp",
                "label": "Limited Licensed Plumber (LLP)",
                "rule": "Required only for plumbers working in a municipality that uses the Division of Fire Prevention for permits or inspections, for work under $25,000 per project; general maintenance under $500 is exempt. Check local requirements first. Issued to individuals.",
                "source": "https://www.tn.gov/commerce/regboards/contractors/license/get/llp.html",
                "bulk": "NOT_ACQUIRED",
            },
        ],
        "contractor_licenses": {
            "coverage": "KNOWN",
            "source": lic["source"],
            "method": lic["method"],
            "retrievedAt": lic["retrievedAt"],
            "sourceAsOf": None,
            "sha256": lic["sha256"],
            "columns": lic["columns"],
            "exportRows": lic["rows"],
            "licenseByQualifyingAgentRows": lic["licenseRows"],
            "applicationRowsWithoutLicense": lic["applicationRowsWithoutLicense"],
            "applicationStatuses": lic["applicationStatuses"],
            "distinctLicenseNumbers": len(L),
            "statusCounts": dict(status.most_common()),
            "licensesWithTennesseeAddress": sum(1 for x in L if x["state"] == "TN"),
            "licensesWithOutOfStateAddress": sum(1 for x in L if x["state"] and x["state"] != "TN"),
            "classificationCodes": len(codes),
            "topClassifications": [{"classification": labels[c], "licenses": n} for c, n in codes.most_common(25)],
            "monetaryLimitCounts": dict(limits.most_common(12)),
            "monetaryLimitIsNotRevenueOrQuality": True,
            "cityOfLicenseeAddress": city,
            "addressIsNotServiceArea": True,
            "fieldsDropped": lic["fieldsDropped"],
            "homeImprovementLleLlpInExport": False,
        },
        "qualifying_agents": {
            "grain": "person linked to a contractor license",
            "relationships": sum(x["qualifyingAgents"] for x in L),
            "distinctNamesAsPrinted": lic["distinctQualifyingAgentNamesAsPrinted"],
            "licensesWithMoreThanOneQA": sum(1 for x in L if x["qualifyingAgents"] > 1),
            "namesPublished": False,
            "notContractors": True,
            "verify": DASHBOARD_PAGE,
        },
        "discipline": {
            "coverage": "PARTIAL",
            "window": "TDCI Disciplinary Action Reports January 2024 through August 2026",
            "program": "Board for Licensing Contractors (one program label covers Contractors, Home Improvement, LLE, and LLP)",
            "reports": len(dis["reports"]),
            "rows": len(E),
            "rowsByReportYear": dict(sorted(Counter(str(e["reportYear"]) for e in E).items())),
            "unlicensedActivityRows": sum(1 for e in E if e["unlicensedActivity"]),
            "topViolations": dict(violations.most_common(8)),
            "rowsWithCivilPenalty": sum(1 for e in E if e["civilPenalty"] is not None),
            "rowsWithActionDateOutsideReportPeriod": sum(1 for e in E if e["actionDateOutsideReportPeriod"]),
            "licenseNumbersPrinted": 0,
            "profileAttachments": 0,
            "credentialClassNotStated": True,
        },
        "complaints": {
            "intake": "KNOWN",
            "records": "NOT_ACQUIRED",
            "outcomes": "PARTIAL (only adjudicated actions appear in Disciplinary Action Reports)",
            "complaintIsNotDiscipline": True,
        },
        "existing_coverage": {
            "statePage": "NONE (/tennessee returned 404 before this ticket)",
            "databaseSource": "tn_blc credential rows already in the licenses database (28,852 rows across classification codes BC, CE, CMC, SPEC, MU, HC, HRA, TN per network metrics), excluded from the live cohort; vintage and grain not documented in this repo; not used or modified here",
            "networkMetricsState": "STATE_SOURCE_ACQUIRED",
        },
        "capability_matrix": [
            {"capability": "Contractor & Qualifying Agent dashboard export", "state": "KNOWN"},
            {"capability": "Live license verification (state search)", "state": "KNOWN"},
            {"capability": "Home Improvement rule (nine counties, $3,000-$24,999)", "state": "KNOWN"},
            {"capability": "Home Improvement license roster", "state": "NOT_ACQUIRED"},
            {"capability": "LLE and LLP rules", "state": "KNOWN"},
            {"capability": "LLE and LLP rosters", "state": "NOT_ACQUIRED"},
            {"capability": "Qualifying-agent relationships (counts)", "state": "KNOWN"},
            {"capability": "Board discipline January 2024 - August 2026", "state": "PARTIAL"},
            {"capability": "Complaint intake", "state": "KNOWN"},
            {"capability": "Complaint records and outcomes", "state": "NOT_ACQUIRED"},
            {"capability": "Local (city/county) licensing", "state": "UNKNOWN"},
            {"capability": "Name-only discipline attachment", "state": "UNSUPPORTED"},
            {"capability": "Combined Tennessee contractor total", "state": "UNSUPPORTED"},
        ],
        "guardrails": [
            "contractor license != Home Improvement != LLE != LLP",
            "contractor != qualifying agent",
            "the $25,000 contractor threshold is not the whole Tennessee licensing system",
            "monetary limit is a license limitation, not revenue or quality",
            "unlicensed activity != licensed contractor record",
            "complaint != discipline; address != service area",
            "no combined Tennessee contractor count; no ranking; no Trust Score",
        ],
        "net_new": {
            "CONTRACTOR_LICENSES": len(L),
            "QUALIFYING_AGENT_RELATIONSHIPS": sum(x["qualifyingAgents"] for x in L),
            "DISCIPLINE_ROWS": len(E),
            "HIC_ROWS": 0,
            "LLE_ROWS": 0,
            "LLP_ROWS": 0,
            "PROFILE_ATTACHMENTS": 0,
            "NEW_PROFILES": 0,
        },
    }
    shard_hashes = {k: hashlib.sha256(events_bytes(v)).hexdigest() for k, v in sorted(shards.items())}
    snapshot["licenseShardsSha256"] = hashlib.sha256(json.dumps(shard_hashes, sort_keys=True).encode()).hexdigest()
    snapshot["eventsSha256"] = hashlib.sha256(events_bytes(E)).hexdigest()
    snapshot["fingerprint"] = hashlib.sha256(json.dumps(snapshot, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()
    summary = {
        "fingerprint": snapshot["fingerprint"],
        "distinctLicenseNumbers": len(L),
        "activeLicenses": status.get("Active", 0),
        "qualifyingAgentRelationships": snapshot["qualifying_agents"]["relationships"],
        "disciplineRows": len(E),
        "unlicensedActivityRows": snapshot["discipline"]["unlicensedActivityRows"],
        "disciplineWindow": "January 2024 - August 2026",
        "cityOfLicenseeAddress": city,
    }
    return snapshot, summary, E, shards


def main() -> int:
    if "--acquire-parse" in sys.argv:
        acquire_parse()
    snap, summary, events, shards = build()
    targets = {
        LIB / "accepted-snapshot.json": (json.dumps(snap, indent=2, ensure_ascii=False) + "\n").encode("utf-8"),
        LIB / "summary.json": (json.dumps(summary, indent=2, ensure_ascii=False) + "\n").encode("utf-8"),
        LIB / "events.json": events_bytes(events),
        LIB / "classification-labels.json": events_bytes(load("blc-contractor-licenses.json")["classificationLabels"]),
        **{LIB / "licenses" / f"{k}.json": events_bytes(v) for k, v in shards.items()},
    }
    if "--check" in sys.argv:
        for path, want in targets.items():
            if path.read_bytes().replace(b"\r\n", b"\n") != want:
                raise SystemExit(f"{path.relative_to(ROOT)} drifted from the builder")
        print("TN-CON-001 check OK", snap["fingerprint"])
        return 0
    (LIB / "licenses").mkdir(parents=True, exist_ok=True)
    for path, data in targets.items():
        path.write_bytes(data)
    c = snap["contractor_licenses"]
    print("fingerprint", snap["fingerprint"])
    print("licenses", c["distinctLicenseNumbers"], "rows", c["exportRows"], "apps", c["applicationRowsWithoutLicense"], c["statusCounts"])
    print("qa", snap["qualifying_agents"]["relationships"], snap["qualifying_agents"]["distinctNamesAsPrinted"])
    print("discipline", snap["discipline"]["rows"], snap["discipline"]["rowsByReportYear"], "unlicensed", snap["discipline"]["unlicensedActivityRows"])
    print("cities", c["cityOfLicenseeAddress"], "shards", len(shards))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
