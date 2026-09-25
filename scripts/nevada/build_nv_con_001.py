#!/usr/bin/env python3
"""NV-CON-001 — Nevada ContractorTrustHub statewide evidence.

Stage 1 (--acquire-parse; needs gitignored raw files in data/raw/nevada/nv-con-001/):
  Nevada State Contractors Board (NSCB) public Contractor Listing Search, submitted once with
  County = All and Classification = All ("Active Directory of Licensed Contractors"). One public form
  post, no enumeration of license numbers, no CAPTCHA. Phones and street addresses are dropped;
  city / state / ZIP of the licensee address are kept. No principal or qualified-individual names are
  in this listing and none are committed.
  NSCB Public Disciplinary and Board Actions Search, one "Search Date Range" query for
  2023-01-01 .. 2026-09-25, type Any. Each row prints a date, the licensee as published, a license
  number, and an action type; penalty detail sits behind a per-row postback and was not fetched.
  -> data/nevada/nv-con-001/*.json (committed)
Stage 2 (default): derived JSON -> lib/nevada-intelligence/accepted-snapshot.json (aggregates),
  summary.json (client-safe counts), events.json (discipline rows), classification-labels.json,
  licenses/NN.json (exact license-number lookup shards by the last two digits of the numeric part).
  --check rebuilds stage 2 and compares byte for byte.

A Nevada license belongs to the business; one license can carry several classifications. License
numbers, classification relationships, and discipline rows are different grains and are never added.
Discipline attaches to a license only through the exact license number the Board printed.
"""

from __future__ import annotations

import hashlib
import html
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "nevada" / "nv-con-001"
STAGE = ROOT / "data" / "nevada" / "nv-con-001"
LIB = ROOT / "lib" / "nevada-intelligence"
GENERATED_AT = "2026-09-25T18:30:00Z"
LISTING_RAW = "nscb-contractor-listing-all.html"
DISCIPLINE_RAW = "nscb-discipline-2023-01-01_2026-09-25.html"
LISTING_RETRIEVED_AT = "2026-09-25T17:32:48Z"
DISCIPLINE_RETRIEVED_AT = "2026-09-25T17:34:33Z"
DISCIPLINE_WINDOW = ("2023-01-01", "2026-09-25")
LISTING_URL = "https://app.nvcontractorsboard.com/Clients/nvscb/Public/ContractorListing/ListingSearch.aspx"
LICENSE_SEARCH = "https://app.nvcontractorsboard.com/Clients/NVSCB/Public/ContractorLicenseSearch/ContractorLicenseSearch.aspx"
DISCIPLINE_URL = "https://app.nvcontractorsboard.com/Clients/NVSCB/Public/DisciplineSearch/DisciplineSearchPage.aspx"
BOARD_ACTIONS = "https://www.nvcontractorsboard.com/investigations/disciplinary-and-board-actions/"
COMPLAINTS = "https://www.nvcontractorsboard.com/complaints/"
CLASSIFICATIONS = "https://www.nvcontractorsboard.com/licensing/license-classifications/"
BOARD = "https://www.nvcontractorsboard.com/"
CITIES = ["LAS VEGAS", "HENDERSON", "RENO", "NORTH LAS VEGAS", "SPARKS", "CARSON CITY"]
LICENSE_RE = re.compile(r"^\d{7}[A-Z]?$")

# Read-only audit of Production before this ticket (psql, default_transaction_read_only=on, 2026-09-25).
EXISTING_DATABASE = {
    "source_system": "nv_nscb",
    "licenseRows": 19120,
    "distinctExternalKeys": 19120,
    "linkedContractorProfiles": 19120,
    "statusAsLoaded": {"Active": 19119, "Active Probation": 1},
    "sourceFile": "NSCB_Active_Directory_All_2026-08-13.csv",
    "loadedAt": "2026-08-13",
    "grain": "one license row and one contractor profile per NSCB license number (letter-suffixed numbers are separate licenses and separate profiles)",
    "nevadaHomeProfiles": 14317,
    "nevadaDisciplineRows": 0,
}
# Exact license-number reconciliation of the listing against those 19,120 rows (same audit).
RECONCILIATION = {"listingLicensesAlsoInDatabase": 18925, "listingLicensesNotInDatabase": 288, "databaseLicensesNotInListing": 195}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def clean(raw: str | None) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", raw or ""))).strip()


def iso_mdy(raw: str) -> str | None:
    m = re.fullmatch(r"(\d{2})-(\d{2})-(\d{4})", raw.strip())
    return f"{m.group(3)}-{m.group(1)}-{m.group(2)}" if m else None


def parse_city_state_zip(raw: str) -> dict:
    m = re.match(r"^(.*?)\s+([A-Z]{2})\s+(\d{5})(?:-\d{4})?$", raw.strip())
    if not m:
        return {"city": None, "state": None, "zip": None}
    return {"city": m.group(1).strip().upper(), "state": m.group(2), "zip": m.group(3)}


def parse_listing() -> dict:
    path = RAW / LISTING_RAW
    s = path.read_text(encoding="utf-8", errors="ignore")
    asof = re.search(r'id="ContentPlaceHolder1_lblTime">([^<]*)<', s)
    county = re.search(r'id="ContentPlaceHolder1_lblCounty">([^<]*)<', s)
    klass = re.search(r'id="ContentPlaceHolder1_lblPrimary">([^<]*)<', s)
    if not asof or clean(county.group(1)) != "All" or clean(klass.group(1)) != "All":
        raise SystemExit("listing is not the County=All / Classification=All directory")
    licenses, labels = [], []
    label_index: dict[str, int] = {}
    dropped = Counter()
    for blk in re.split(r'(?=<tr>\s*<td class="boxedTop" style="width:250px;">)', s):
        m = re.search(r"lbBusinessName_(\d+)", blk)
        if not m:
            continue
        i = int(m.group(1))

        def field(name: str, tag: str = "span") -> str:
            f = re.search(rf'id="ContentPlaceHolder1_dtgResults_{name}_{i}"[^>]*>(.*?)</{tag}>', blk, re.S)
            return f.group(1) if f else ""

        lic = clean(field("lnkLicense", "a"))
        if not LICENSE_RE.match(lic):
            raise SystemExit(f"unexpected license number format: {lic!r}")
        if clean(field("lbPhone")):
            dropped["phone"] += 1
        if clean(field("lbCompoundStreet")):
            dropped["street"] += 1
        classes = []
        for part in field("lbClassifications").split("<br/>"):
            label = clean(part)
            if not label:
                continue
            if label not in label_index:
                label_index[label] = len(labels)
                labels.append(label)
            classes.append(label_index[label])
        limit = clean(field("lbLimit")) or None
        licenses.append(
            {
                "license": lic,
                "name": clean(field("lbBusinessName")),
                "status": clean(field("lbStatus")),
                "expires": iso_mdy(clean(field("lbExpires"))),
                **parse_city_state_zip(clean(field("lbCityStateZip"))),
                "classifications": classes,
                "monetaryLimit": limit,
                "limitation": clean(field("lbLimitation")) or None,
            }
        )
    if len({x["license"] for x in licenses}) != len(licenses):
        raise SystemExit("duplicate license number in listing")
    # Stable label ids: sort labels by (code, description) and remap.
    order = sorted(range(len(labels)), key=lambda k: labels[k])
    remap = {old: new for new, old in enumerate(order)}
    for x in licenses:
        x["classifications"] = sorted(remap[c] for c in x["classifications"])
    licenses.sort(key=lambda x: x["license"])
    return {
        "source": LISTING_URL,
        "method": "One public Contractor Listing Search form submission, County = All, Classification = All (Active Directory of Licensed Contractors)",
        "retrievedAt": LISTING_RETRIEVED_AT,
        "sourceAsOfPrinted": clean(asof.group(1)),
        "sha256": sha(path),
        "bytes": path.stat().st_size,
        "rows": len(licenses),
        "fieldsPublished": ["Business name", "Street", "City State ZIP", "License #", "Phone", "Classifications", "Limitation", "Expires", "Monetary Limit", "Status"],
        "fieldsDropped": {"phone": dropped["phone"], "street": dropped["street"]},
        "principalsOrQualifiersInListing": False,
        "classificationLabels": [labels[k] for k in order],
        "licenses": licenses,
    }


def parse_discipline() -> dict:
    path = RAW / DISCIPLINE_RAW
    s = path.read_text(encoding="utf-8", errors="ignore")
    grid = s[s.find("ContentPlaceHolder1_dtgSearchResults"):]
    grid = grid[: grid.find("</table>")]
    header = [clean(h) for h in re.findall(r"<td[^>]*>(.*?)</td>", re.search(r"<tr[^>]*>(.*?)</tr>", grid, re.S).group(1), re.S)]
    if header != ["Date", "Licensee(s)", "License Number", "Type"]:
        raise SystemExit(f"discipline columns drifted: {header}")
    events = []
    for n, tr in enumerate(re.findall(r"<tr>(.*?)</tr>", grid, re.S)):
        tds = re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
        if len(tds) != 4:
            continue
        date = clean(tds[0])[:10]
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
            raise SystemExit(f"unparsed discipline date {tds[0]!r}")
        lic = clean(tds[2]) or None
        if lic is not None and not LICENSE_RE.match(lic):
            raise SystemExit(f"unexpected discipline license number {lic!r}")
        events.append(
            {
                "id": f"NV-NSCB-ACTION:{date}:{lic or 'none'}:{n}",
                "grain": "NSCB_PUBLIC_DISCIPLINARY_OR_BOARD_ACTION_ROW",
                "actionDate": date,
                "respondent": clean(tds[1]),
                "licenseNumberPrinted": lic,
                "actionType": clean(tds[3]),
            }
        )
    events.sort(key=lambda e: (e["actionDate"], e["licenseNumberPrinted"] or "", e["respondent"], e["id"]))
    return {
        "source": DISCIPLINE_URL,
        "method": f"One public 'Search Date Range' query {DISCIPLINE_WINDOW[0]} .. {DISCIPLINE_WINDOW[1]}, Type = Any, sorted by date",
        "retrievedAt": DISCIPLINE_RETRIEVED_AT,
        "window": list(DISCIPLINE_WINDOW),
        "sha256": sha(path),
        "detailFetched": False,
        "events": events,
    }


def acquire_parse() -> None:
    STAGE.mkdir(parents=True, exist_ok=True)
    (STAGE / "nscb-contractor-licenses.json").write_text(json.dumps(parse_listing(), separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    (STAGE / "nscb-discipline.json").write_text(json.dumps(parse_discipline(), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def load(name: str):
    return json.loads((STAGE / name).read_text(encoding="utf-8"))


def compact(obj) -> bytes:
    return (json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8")


def shard_of(license_number: str) -> str:
    return re.sub(r"[A-Z]$", "", license_number)[-2:]


def code_of(label: str) -> str:
    return label.split(" ", 1)[0]


def family_of(code: str) -> str:
    if code == "AB":
        return "AB"
    return code.split("-", 1)[0]


def limit_value(raw: str | None) -> float | None:
    if not raw or raw == "Unlimited":
        return None
    return float(raw.replace("$", "").replace(",", ""))


def build():
    lic = load("nscb-contractor-licenses.json")
    dis = load("nscb-discipline.json")
    L = lic["licenses"]
    labels = lic["classificationLabels"]
    E = dis["events"]
    by_license = {x["license"]: x for x in L}
    status = Counter(x["status"] for x in L)
    rel = Counter(labels[c] for x in L for c in x["classifications"])
    codes = Counter(code_of(labels[c]) for x in L for c in x["classifications"])
    families = Counter()
    for x in L:
        for fam in {family_of(code_of(labels[c])) for c in x["classifications"]}:
            families[fam] += 1
    per_license = Counter(len(x["classifications"]) for x in L)
    limits = Counter(x["monetaryLimit"] or "(not printed)" for x in L)
    numeric_limits = sorted(v for v in (limit_value(x["monetaryLimit"]) for x in L) if v is not None)
    city = {c.title(): sum(1 for x in L if x["state"] == "NV" and x["city"] == c) for c in CITIES}
    base = Counter(re.sub(r"[A-Z]$", "", x["license"]) for x in L)
    action_types = Counter(e["actionType"] for e in E)
    printed = [e for e in E if e["licenseNumberPrinted"]]
    in_directory = [e for e in printed if e["licenseNumberPrinted"] in by_license]
    events = []
    for e in E:
        attached = e["licenseNumberPrinted"] in by_license if e["licenseNumberPrinted"] else False
        events.append(
            {
                **e,
                "attribution": "exact_license_number_in_active_directory" if attached else ("exact_license_number_not_in_active_directory" if e["licenseNumberPrinted"] else "standalone_event_no_license_number"),
            }
        )
    discipline_by_license: dict[str, list] = defaultdict(list)
    for e in events:
        if e["attribution"] == "exact_license_number_in_active_directory":
            discipline_by_license[e["licenseNumberPrinted"]].append(e["id"])
    shards: dict[str, list] = defaultdict(list)
    for x in L:
        row = dict(x)
        row["disciplineEvents"] = len(discipline_by_license.get(x["license"], []))
        shards[shard_of(x["license"])].append(row)
    top_labels = [{"classification": k, "licenses": v} for k, v in sorted(rel.items(), key=lambda kv: (-kv[1], kv[0]))[:25]]
    snapshot = {
        "contract_name": "contractor-nv-state-intel-v1",
        "ticket": "NV-CON-001",
        "path": "/nevada",
        "generated_at": GENERATED_AT,
        "regulator": {
            "board": "Nevada State Contractors Board (NSCB)",
            "law": "NRS Chapter 624; NAC Chapter 624",
            "site": BOARD,
            "licenseSearch": LICENSE_SEARCH,
            "contractorListing": LISTING_URL,
            "disciplineSearch": DISCIPLINE_URL,
            "boardActions": BOARD_ACTIONS,
            "complaints": COMPLAINTS,
            "classifications": CLASSIFICATIONS,
        },
        "license_model": {
            "licenseHolder": "business (sole proprietorship, partnership, corporation, LLC, or other entity)",
            "qualifiedIndividual": "a person (owner, officer, member, manager, or employee) who qualifies the license by examination and experience; the license belongs to the business, not the person",
            "classes": [
                {"id": "A", "label": "Class A — General Engineering", "rule": "Fixed works requiring specialized engineering knowledge: highways, bridges, dams, pipelines, sewers, grading, and similar projects."},
                {"id": "B", "label": "Class B — General Building", "rule": "Structures for the support, shelter, or enclosure of people, animals, or property, using more than two unrelated building trades or crafts."},
                {"id": "AB", "label": "Class AB — General Engineering and General Building", "rule": "Holds both the A and B scopes on one license."},
                {"id": "C", "label": "Class C — Specialty", "rule": "One specialty trade (for example C-1 Plumbing and Heating, C-2 Electrical, C-15 Roofing and Siding) with subclassifications that narrow the scope further."},
                {"id": "E", "label": "E-1 / E-2 — Owner/Builder (as printed in the listing)", "rule": "The listing also prints Owner/Builder classifications (E-1 not to exceed three stories, E-2 exceeding three stories). They are shown as published and kept apart from A, B, AB, and C."},
            ],
            "monetaryLimit": "The Board sets a monetary limit on each license: the largest single contract (or project) the licensee may take on. It is a regulatory limit tied to financial responsibility, not revenue, company size, a quality signal, or a recommended budget.",
            "bondAndFinancialResponsibility": "Licensees post a bond and show financial responsibility as a condition of licensure. These are regulatory requirements, not quality indicators.",
            "limitation": "Some licenses print a limitation that narrows the classification (for example 'LIMITED TO WOOD FLOORS ONLY').",
        },
        "contractor_licenses": {
            "coverage": "KNOWN",
            "scope": "Active directory only (statuses printed: Active, Active Probation). Expired, revoked, suspended, and inactive licenses are not in the listing.",
            "source": lic["source"],
            "method": lic["method"],
            "retrievedAt": lic["retrievedAt"],
            "sourceAsOfPrinted": lic["sourceAsOfPrinted"],
            "sha256": lic["sha256"],
            "bytes": lic["bytes"],
            "fieldsPublished": lic["fieldsPublished"],
            "fieldsDropped": lic["fieldsDropped"],
            "distinctLicenseNumbers": len(L),
            "statusCounts": dict(sorted(status.items(), key=lambda kv: (-kv[1], kv[0]))),
            "letterSuffixedLicenseNumbers": sum(1 for x in L if x["license"][-1].isalpha()),
            "baseNumbersWithMoreThanOneLicense": sum(1 for v in base.values() if v > 1),
            "licensesWithNevadaAddress": sum(1 for x in L if x["state"] == "NV"),
            "licensesWithOutOfStateAddress": sum(1 for x in L if x["state"] and x["state"] != "NV"),
            "licensesWithLimitationPrinted": sum(1 for x in L if x["limitation"]),
            "addressIsNotServiceArea": True,
            "cityOfLicenseeAddress": city,
            "statusIsAsPublished": True,
        },
        "classifications": {
            "grain": "license-to-classification relationship",
            "relationships": sum(len(x["classifications"]) for x in L),
            "distinctClassificationLabels": len(labels),
            "distinctClassificationCodes": len(codes),
            "licensesByClassificationCount": {str(k): v for k, v in sorted(per_license.items())},
            "licensesCarryingFamily": dict(sorted(families.items())),
            "topClassifications": top_labels,
            "relationshipsAreNotContractors": True,
        },
        "monetary_limits": {
            "grain": "one monetary limit printed per license",
            "counts": dict(sorted(limits.items(), key=lambda kv: (-kv[1], kv[0]))[:12]),
            "unlimited": limits.get("Unlimited", 0),
            "notPrinted": limits.get("(not printed)", 0),
            "numericMedian": numeric_limits[len(numeric_limits) // 2] if numeric_limits else None,
            "monetaryLimitIsNotRevenueOrQuality": True,
        },
        "qualified_individuals": {
            "grain": "person qualifying a contractor license",
            "inListing": False,
            "acquired": "NOT_ACQUIRED",
            "verify": "NSCB License Search supports search by principal or qualified individual; one license at a time",
            "namesPublished": False,
            "notContractors": True,
        },
        "discipline": {
            "coverage": "PARTIAL",
            "window": f"NSCB Public Disciplinary and Board Actions Search, {DISCIPLINE_WINDOW[0]} through {DISCIPLINE_WINDOW[1]}",
            "source": dis["source"],
            "method": dis["method"],
            "retrievedAt": dis["retrievedAt"],
            "sha256": dis["sha256"],
            "rows": len(E),
            "rowsByYear": dict(sorted(Counter(e["actionDate"][:4] for e in E).items())),
            "actionTypes": dict(sorted(action_types.items(), key=lambda kv: (-kv[1], kv[0]))),
            "firstActionDate": E[0]["actionDate"] if E else None,
            "lastActionDate": E[-1]["actionDate"] if E else None,
            "rowsWithLicenseNumberPrinted": len(printed),
            "rowsWithoutLicenseNumber": len(E) - len(printed),
            "distinctLicenseNumbersPrinted": len({e["licenseNumberPrinted"] for e in printed}),
            "rowsAttachedByExactLicenseNumber": len(in_directory),
            "licensesInDirectoryWithDiscipline": len(discipline_by_license),
            "rowsWithLicenseNotInActiveDirectory": len(printed) - len(in_directory),
            "penaltyDetailFetched": False,
            "nameOnlyAttachment": False,
            "databaseProfileAttachments": 0,
            "unlicensedActionsInThisSearch": 0,
        },
        "unlicensed_activity": {
            "coverage": "NOT_ACQUIRED",
            "note": "The Board's discipline search lists actions against licensees. Unlicensed-contractor enforcement is separate and was not acquired; an unlicensed respondent is never a licensed contractor record.",
        },
        "complaints": {
            "intake": "KNOWN",
            "contractorComplaint": COMPLAINTS,
            "unlicensedContractorComplaint": COMPLAINTS,
            "records": "NOT_ACQUIRED",
            "complaintIsNotDiscipline": True,
        },
        "existing_coverage": {
            "statePage": "NONE (/nevada returned 404 before this ticket)",
            "database": EXISTING_DATABASE,
            "reconciliation": RECONCILIATION,
            "reconciliationMeaning": "databaseLicensesNotInListing are Production rows loaded as Active on 2026-08-13 that are no longer in the Board's active directory; they were not changed by this ticket",
            "databaseModified": False,
        },
        "capability_matrix": [
            {"capability": "Exact license verification (NSCB License Search)", "state": "KNOWN"},
            {"capability": "Contractor Listing Search (active directory, all counties and classifications)", "state": "KNOWN"},
            {"capability": "Statewide active license population", "state": "KNOWN"},
            {"capability": "Expired / revoked / inactive license population", "state": "NOT_ACQUIRED"},
            {"capability": "Classification framework (A / B / AB / C and subclassifications)", "state": "KNOWN"},
            {"capability": "Monetary limit per license", "state": "KNOWN"},
            {"capability": "Principals and qualified individuals (bulk)", "state": "NOT_ACQUIRED"},
            {"capability": "Qualified individual lookup (one license at a time)", "state": "KNOWN"},
            {"capability": "Board discipline 2023 - September 2026", "state": "PARTIAL"},
            {"capability": "Discipline penalty detail", "state": "NOT_ACQUIRED"},
            {"capability": "Unlicensed-contractor enforcement", "state": "NOT_ACQUIRED"},
            {"capability": "Complaint intake", "state": "KNOWN"},
            {"capability": "Complaint records", "state": "NOT_ACQUIRED"},
            {"capability": "Local (city/county) licensing and permits", "state": "UNKNOWN"},
            {"capability": "Name-only discipline attachment", "state": "UNSUPPORTED"},
            {"capability": "Combined Nevada contractor / qualifier / classification total", "state": "UNSUPPORTED"},
        ],
        "guardrails": [
            "business license != classification != qualified individual != discipline",
            "monetary limit != revenue != company size != quality",
            "bond and financial responsibility are regulatory requirements, not quality indicators",
            "status is as published; a future expiration date does not make a license active",
            "discipline attaches only through the exact license number the Board printed; never by name",
            "unlicensed respondent != licensed contractor; complaint != discipline; address != service area",
            "no combined Nevada contractor count; no ranking; no Trust Score",
        ],
        "net_new": {
            "ACTIVE_LICENSES_IN_DIRECTORY": len(L),
            "CLASSIFICATION_RELATIONSHIPS": sum(len(x["classifications"]) for x in L),
            "DISCIPLINE_ROWS": len(E),
            "DISCIPLINE_ROWS_ATTACHED_BY_EXACT_LICENSE": len(in_directory),
            "QUALIFIED_INDIVIDUAL_ROWS": 0,
            "UNLICENSED_ACTION_ROWS": 0,
            "NEW_PROFILES": 0,
            "DATABASE_WRITES": 0,
        },
    }
    db_path = RAW / "database-license-numbers.txt"  # gitignored export of the read-only audit, if present
    if db_path.exists():
        db = {ln.strip() for ln in db_path.read_text(encoding="utf-8").splitlines() if ln.strip()}
        cur = set(by_license)
        got = {"listingLicensesAlsoInDatabase": len(cur & db), "listingLicensesNotInDatabase": len(cur - db), "databaseLicensesNotInListing": len(db - cur)}
        if got != RECONCILIATION:
            raise SystemExit(f"database reconciliation drifted: {got}")
    shard_hashes = {k: hashlib.sha256(compact(v)).hexdigest() for k, v in sorted(shards.items())}
    snapshot["licenseShardsSha256"] = hashlib.sha256(json.dumps(shard_hashes, sort_keys=True).encode()).hexdigest()
    snapshot["eventsSha256"] = hashlib.sha256(compact(events)).hexdigest()
    snapshot["fingerprint"] = hashlib.sha256(json.dumps(snapshot, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()
    fam_label = {"A": "General Engineering (A)", "B": "General Building (B)", "AB": "General Engineering and General Building (AB)", "C": "Specialty (C)", "E": "Owner/Builder (E)"}
    summary = {
        "fingerprint": snapshot["fingerprint"],
        "distinctLicenseNumbers": len(L),
        "activeLicenses": status.get("Active", 0),
        "activeProbationLicenses": status.get("Active Probation", 0),
        "classificationRelationships": snapshot["classifications"]["relationships"],
        "licensesCarryingFamily": {fam_label.get(k, k): v for k, v in sorted(families.items())},
        "licensesByCode": {k: codes[k] for k in ["A", "B", "AB", "B-2", "C-1", "C-2", "C-15", "C-15A"]},
        "unlimitedMonetaryLimit": limits.get("Unlimited", 0),
        "disciplineRows": len(E),
        "disciplineAttachedByExactLicense": len(in_directory),
        "disciplineWindow": "January 2023 - September 2026",
        "disciplineActionTypes": snapshot["discipline"]["actionTypes"],
        "cityOfLicenseeAddress": city,
        "sourceAsOfPrinted": lic["sourceAsOfPrinted"],
    }
    return snapshot, summary, events, shards, labels


def main() -> int:
    if "--acquire-parse" in sys.argv:
        acquire_parse()
    snap, summary, events, shards, labels = build()
    targets = {
        LIB / "accepted-snapshot.json": (json.dumps(snap, indent=2, ensure_ascii=False) + "\n").encode("utf-8"),
        LIB / "summary.json": (json.dumps(summary, indent=2, ensure_ascii=False) + "\n").encode("utf-8"),
        LIB / "events.json": compact(events),
        LIB / "classification-labels.json": compact(labels),
        **{LIB / "licenses" / f"{k}.json": compact(v) for k, v in shards.items()},
    }
    if "--check" in sys.argv:
        for path, want in targets.items():
            if not path.exists() or path.read_bytes().replace(b"\r\n", b"\n") != want:
                raise SystemExit(f"{path.relative_to(ROOT)} drifted from the builder")
        print("NV-CON-001 check OK", snap["fingerprint"])
        return 0
    (LIB / "licenses").mkdir(parents=True, exist_ok=True)
    for path, data in targets.items():
        path.write_bytes(data)
    c = snap["contractor_licenses"]
    print("fingerprint", snap["fingerprint"])
    print("licenses", c["distinctLicenseNumbers"], c["statusCounts"], "suffixed", c["letterSuffixedLicenseNumbers"])
    print("classifications", snap["classifications"]["relationships"], "labels", snap["classifications"]["distinctClassificationLabels"], snap["classifications"]["licensesCarryingFamily"])
    print("discipline", snap["discipline"]["rows"], snap["discipline"]["actionTypes"], "attached", snap["discipline"]["rowsAttachedByExactLicenseNumber"])
    print("reconciliation", snap["existing_coverage"]["reconciliation"])
    print("cities", c["cityOfLicenseeAddress"], "shards", len(shards))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
