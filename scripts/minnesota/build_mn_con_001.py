#!/usr/bin/env python3
"""MN-CON-001 — Minnesota ContractorTrustHub statewide evidence.

Stage 1 (--acquire-parse; needs gitignored raw files in data/raw/minnesota/mn-con-001/):
  Minnesota Department of Labor and Industry (DLI), Construction Codes and Licensing Division (CCLD),
  License and Registration Lookup export. DLI states the export "includes all licenses, bonds,
  certifications and registrations" issued by CCLD and is "updated nightly"; it prints no as-of date, so
  none is invented — the retrieval time and the file's own date stamp are the only clocks.
    MNDLILicRegCertExport.zip -> LIC_SNAP_MM_DD_YYYY.csv (every credential type except Contractor
    Registration) and MNDLILicRegCertExport_Contractor_Registrations.csv (Contractor Registration only;
    disjoint credential numbers). The four per-type CSVs (Residential Contractors, Electrical, Plumbing,
    Mechanical Contractor Bond) were downloaded and checked to be exact subsets of LIC_SNAP.
  DLI "Residential building contractor enforcement actions" PDFs for 2024, 2025, and 2026 year to date
  (text extracted with pypdf; the PDFs and text stay in raw).
  -> data/minnesota/mn-con-001/export-manifest.json, enforcement.json (committed)
  -> lib/minnesota-intelligence/credentials/NN.json (committed exact-number lookup shards)
Stage 2 (default): shards + stage JSON -> accepted-snapshot.json (aggregates), summary.json (client-safe
  counts), events.json (enforcement rows with attribution), credential-labels.json.
  --check rebuilds stage 2, compares byte for byte, and checks the shard manifest hashes.

Grains never combined: business credential != individual credential != bond != certificate != registration
!= enforcement. The export's own Bus_Pers column decides business vs person. Person rows are published
for exact-number lookup only: no name, phone, email, street address, city, or ZIP. Business rows keep the
licensee name, DBA, and city / state / ZIP; phones, emails, and street addresses are dropped.
Status is kept exactly as DLI prints it (mixed case; "Issued" and "ISSUED" both occur). Enforcement
attaches to a credential only through an exact credential number DLI printed; never by name.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "minnesota" / "mn-con-001"
STAGE = ROOT / "data" / "minnesota" / "mn-con-001"
LIB = ROOT / "lib" / "minnesota-intelligence"
SHARDS = LIB / "credentials"
GENERATED_AT = "2026-09-26T16:30:00Z"
RETRIEVED_AT = "2026-09-26T14:11:34Z"
EXPORT_ZIP = "MNDLILicRegCertExport.zip"
EXPORT_SNAP = "LIC_SNAP_09_26_2026.csv"
EXPORT_CREG = "MNDLILicRegCertExport_Contractor_Registrations.csv"
PER_TYPE = {
    "MNDLILicRegCertExport_Residential_Contractors.csv": "Residential Contractors",
    "MNDLILicRegCertExport_Electrical.csv": "Electrical",
    "MNDLILicRegCertExport_Plumbing.csv": "Plumbing",
    "MNDLILicRegCertExport_Mechanical_Contractor_Bond.csv": "Mechanical Contractor Bond",
}
ENFORCEMENT_PDFS = {"2024": "rbc-2024actions.pdf", "2025": "rbc_2025actions.pdf", "2026": "rbc_2026actions.pdf"}
EXPORT_BASE = "https://secure.doli.state.mn.us/ccld/data/"
LOOKUP_PAGE = "https://www.dli.mn.gov/license-and-registration-lookup"
IMS = "https://ims.dli.mn.gov/"
ENFORCEMENT_PAGE = "https://www.dli.mn.gov/business/residential-contractors/residential-building-contractor-enforcement-actions"
CONTRACTOR_COMPLAINT = "https://www.dli.mn.gov/business/residential-contractors/residential-building-contractor-complaints"
RESIDENTIAL_LICENSING = "https://www.dli.mn.gov/business/residential-contractors/residential-contractor-licensing"
DLI_STATEMENT = (
    "The spreadsheet includes all licenses, bonds, certifications and registrations issued by DLI's Construction "
    "Codes and Licensing Division. It is updated nightly. Current, active licenses or registrations will have a "
    "status of 'Issued.'"
)
COLUMNS = ["Bus_Pers", "License_Type", "License_Subtype", "Name", "DBA_Name", "Addr1", "Addr2", "City", "St", "Zip", "Phone_No", "Email_Address", "Lic_Number", "Status", "Orig_Date", "Exp_Date", "Enforcement_Action", "Renewal_in_Progress"]
DROPPED = ["Addr1", "Addr2", "Phone_No", "Email_Address"]
PERSON_DROPPED = DROPPED + ["Name", "DBA_Name", "City", "Zip"]
CITIES = ["MINNEAPOLIS", "ST PAUL", "ROCHESTER", "DULUTH"]
CRED_RE = re.compile(r"^[A-Z0-9:]{2}\d{6}$")
STRICT_CRED_RE = re.compile(r"^[A-Z0-9]{2}\d{6}$")

# Credential kind per DLI License_Subtype. Every subtype in the export must be listed; an unknown subtype stops the build.
KIND = {
    "bond": ["Mechanical Contractor Bond", "Pipelaying Bond", "MPCA Pipelaying Bond", "Sign Contractor Bond"],
    "exemption": ["Certificate of Exemption"],
    "registration": [
        "Business Entity", "Sole Proprietor or Individual",
        "Qualifying Builder", "Qualifying Remodeler", "Qualifying Roofer", "Qualifying Installer",
        "Registered Electrical Employer", "Registered Plumbing Employer",
        "Registered Unlicensed Electrician", "Registered Unlicensed Power Limited Technician", "Registered Unlicensed Plumber",
        "Registered Unlicensed Elevator Constructor", "Registered Unlicensed HPP Pipefitter", "Registered Unlicensed Water Conditioning Installer",
    ],
    "certification": [
        "Backflow Prevention Tester", "Backflow Prevention Rebuilder", "Medical Gas Certification", "Boiler Inspector Competency",
        "Certified Building Official", "Certified Building Official - Limited", "Accessibility Specialist",
    ],
    "sponsor_approval": ["CE Sponsor", "CE Sponsor Out-of-State"],
    "license": [
        "Residential Building Contractor", "Residential Remodeler Contractor", "Residential Roofer Contractor", "Manufactured Home Installer",
        "Class A Electrical Contractor", "Class B Electrical Contractor", "Technology Systems Contractor", "Satellite System Contractor",
        "Class A Master Electrician", "Class B Master Electrician", "Journeyworker A Electrician", "Journeyworker B Electrician",
        "Power Limited Technician", "Maintenance Electrician", "Lineman", "Class B Installer", "Satellite System Installer",
        "Plumbing Contractor", "Restricted Plumbing Contractor", "Master Plumber", "Restricted Master Plumber", "Journeyworker Plumber", "Restricted Journeyworker Plumber",
        "HPP Contractor", "Master HPP Pipefitter", "HPP Journeyworker Pipefitter",
        "Elevator Contractor", "Limited Elevator Contractor", "Master Elevator Constructor", "Limited Master Elevator Constructor",
        "Journeyworker Elevator Constructor", "Limited Journeyworker Elevator Constructor",
        "Water Conditioning Contractor", "Master Water Conditioning", "Journeyworker Water Conditioning",
        "Special Engineer", "1st Class A Engineer", "1st Class B Engineer", "1st Class C Engineer", "1st Class P Engineer",
        "2nd Class A Engineer", "2nd Class B Engineer", "2nd Class C Engineer", "Chief A Engineer", "Chief B Engineer", "Chief C Engineer",
        "Historical Boiler Engineer", "Boat Master",
        "Manufactured Home Dealer", "Manufactured Home Dealer Subagency", "Manufactured Home Limited Dealer", "Manufactured Home Manufacturer",
    ],
}
KIND_OF = {sub: kind for kind, subs in KIND.items() for sub in subs}
RESIDENTIAL_BUSINESS = ["Residential Building Contractor", "Residential Remodeler Contractor", "Residential Roofer Contractor", "Manufactured Home Installer", "Certificate of Exemption"]
RESIDENTIAL_PERSON = ["Qualifying Builder", "Qualifying Remodeler", "Qualifying Roofer", "Qualifying Installer"]

# Read-only audit of Production before this ticket (psql, default_transaction_read_only=on, 2026-09-26).
EXISTING_DATABASE = {
    "source_system": "mn_dli",
    "licenseRows": 276793,
    "distinctExternalKeys": 276793,
    "linkedContractorProfiles": 276793,
    "externalKeyForm": "MN-DLI:<Lic_Number>",
    "sourceFiles": {"MNDLILicRegCertExport.zip:LIC_SNAP_08_14_2026.csv": 255726, "MNDLILicRegCertExport_Contractor_Registrations.csv": 21067},
    "loadedAt": "2026-08-14",
    "busPersAsLoaded": {"Personal": 218686, "Business": 58107},
    "personRowsPublishedAsContractorProfiles": 218686,
    "minnesotaHomeProfiles": 237782,
    "rawPayloadHoldsPhoneAndStreet": True,
    "minnesotaDisciplineRows": 0,
    "grain": "one license row and one contractor profile per DLI credential number, for business and person rows alike (pre-existing; not changed by this ticket)",
}
# Exact credential-number reconciliation of the 2026-09-26 export against those 276,793 keys (same audit).
RECONCILIATION = {
    "exportCredentialsAlsoInDatabase": 276505,
    "exportCredentialsNotInDatabase": 4043,
    "databaseCredentialsNotInExport": 288,
    "sharedCredentialsWithChangedStatus": 2662,
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def iso_mdy(raw: str) -> str | None:
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", raw.strip())
    return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}" if m else None


def read_csv(data: bytes) -> list[dict]:
    rows = list(csv.DictReader(io.StringIO(data.decode("cp1252"))))
    if rows and list(rows[0].keys()) != COLUMNS:
        raise SystemExit(f"export columns drifted: {list(rows[0].keys())}")
    return rows


def norm_city(raw: str) -> str:
    c = re.sub(r"[^A-Z ]", "", raw.upper()).strip()
    c = re.sub(r"\s+", " ", c)
    return re.sub(r"^(ST|SAINT) PAUL$", "ST PAUL", c)


def shard_of(number: str) -> str:
    m = re.search(r"(\d{2})$", number)
    return m.group(1) if m else "xx"


def parse_export() -> tuple[dict, dict[str, list], list[dict]]:
    zpath = RAW / EXPORT_ZIP
    with zipfile.ZipFile(zpath) as z:
        names = z.namelist()
        if names != [EXPORT_SNAP]:
            raise SystemExit(f"unexpected zip members {names}")
        info = z.getinfo(EXPORT_SNAP)
        snap_bytes = z.read(EXPORT_SNAP)
    creg_path = RAW / EXPORT_CREG
    snap = read_csv(snap_bytes)
    creg = read_csv(creg_path.read_bytes())
    if any(r["License_Type"] != "Contractor Registration" for r in creg) or any(r["License_Type"] == "Contractor Registration" for r in snap):
        raise SystemExit("Contractor Registration rows are expected only in the registrations CSV")
    rows = snap + creg
    padded = sum(1 for r in rows if r["Lic_Number"] != r["Lic_Number"].strip())
    for r in rows:
        r["Lic_Number"] = r["Lic_Number"].strip()  # surrounding whitespace is not part of the number
    numbers = [r["Lic_Number"] for r in rows]
    if len(set(numbers)) != len(numbers):
        raise SystemExit("duplicate credential number across the export")
    for name, ltype in PER_TYPE.items():
        sub = {r["Lic_Number"].strip() for r in read_csv((RAW / name).read_bytes())}
        if sub != {r["Lic_Number"] for r in snap if r["License_Type"] == ltype}:
            raise SystemExit(f"{name} is not the {ltype} subset of LIC_SNAP")
    labels: list[dict] = []
    label_index: dict[tuple[str, str], int] = {}
    for r in rows:
        key = (r["License_Type"], r["License_Subtype"])
        if r["License_Subtype"] not in KIND_OF:
            raise SystemExit(f"unmapped License_Subtype {r['License_Subtype']!r}")
        if r["Bus_Pers"] not in ("Business", "Personal"):
            raise SystemExit(f"unexpected Bus_Pers {r['Bus_Pers']!r}")
        if key not in label_index:
            label_index[key] = len(labels)
            labels.append({"type": key[0], "subtype": key[1], "kind": KIND_OF[key[1]], "grain": Counter()})
        labels[label_index[key]]["grain"][r["Bus_Pers"]] += 1
    order = sorted(range(len(labels)), key=lambda k: (labels[k]["type"], labels[k]["subtype"]))
    remap = {old: new for new, old in enumerate(order)}
    final_labels = []
    for k in order:
        lab = labels[k]
        grains = sorted(lab["grain"])
        if len(grains) != 1:
            raise SystemExit(f"subtype {lab['subtype']} mixes business and person rows: {dict(lab['grain'])}")
        final_labels.append({"id": remap[k], "type": lab["type"], "subtype": lab["subtype"], "kind": lab["kind"], "grain": "business" if grains[0] == "Business" else "person", "rows": lab["grain"][grains[0]]})
    shards: dict[str, list] = defaultdict(list)
    dropped = Counter()
    for r in rows:
        for col in DROPPED:
            if r[col].strip():
                dropped[col] += 1
        base = {
            "n": r["Lic_Number"],
            "k": remap[label_index[(r["License_Type"], r["License_Subtype"])]],
            "g": "B" if r["Bus_Pers"] == "Business" else "P",
            "st": r["St"].strip() or None,
            "s": r["Status"].strip(),
            "o": iso_mdy(r["Orig_Date"]),
            "e": iso_mdy(r["Exp_Date"]),
            "ea": 1 if r["Enforcement_Action"].strip() == "1" else 0,
            "rp": 1 if r["Renewal_in_Progress"].strip().lower() == "yes" else 0,
        }
        if r["Orig_Date"].strip() and base["o"] is None or r["Exp_Date"].strip() and base["e"] is None:
            raise SystemExit(f"unparsed date on {r['Lic_Number']}")
        if base["g"] == "B":
            base.update({"name": re.sub(r"\s+", " ", r["Name"]).strip(), "dba": re.sub(r"\s+", " ", r["DBA_Name"]).strip() or None, "city": re.sub(r"\s+", " ", r["City"]).strip() or None, "zip": r["Zip"].strip() or None})
        else:
            for col in ("Name", "DBA_Name", "City", "Zip"):
                if r[col].strip():
                    dropped[col + "(person)"] += 1
        shards[shard_of(r["Lic_Number"])].append(base)
    for v in shards.values():
        v.sort(key=lambda x: x["n"])
    manifest = {
        "source": {"lookupPage": LOOKUP_PAGE, "exportBase": EXPORT_BASE, "ims": IMS},
        "dliStatement": DLI_STATEMENT,
        "asOfPrintedByDli": None,
        "retrievedAt": RETRIEVED_AT,
        "files": {
            EXPORT_ZIP: {"sha256": sha(zpath), "bytes": zpath.stat().st_size, "member": EXPORT_SNAP, "memberBytes": info.file_size, "memberDateTime": "%04d-%02d-%02dT%02d:%02d:00" % info.date_time[:5], "rows": len(snap)},
            EXPORT_CREG: {"sha256": sha(creg_path), "bytes": creg_path.stat().st_size, "rows": len(creg)},
            **{name: {"sha256": sha(RAW / name), "bytes": (RAW / name).stat().st_size, "subsetOf": "LIC_SNAP", "licenseType": ltype} for name, ltype in PER_TYPE.items()},
        },
        "columns": COLUMNS,
        "rows": len(rows),
        "distinctCredentialNumbers": len(set(numbers)),
        "numbersPrintedWithWhitespace": padded,
        "fieldsDroppedForEveryRow": DROPPED,
        "fieldsDroppedForPersonRows": PERSON_DROPPED,
        "droppedFieldCounts": dict(sorted(dropped.items())),
        "labels": final_labels,
        "shardSha256": {},
    }
    return manifest, shards, final_labels


# ---- enforcement -----------------------------------------------------------------------------------------------

ORDER_RE = re.compile(r"^([A-Z][^:;]{0,80}?\b(?:Order|Orders|Stipulation|Decision)\b[^:;]{0,40}?)\s*[:;]\s*(.*)$", re.S)
FILE_RE = re.compile(r"\b[A-Za-z]{3}\d{4}-\s*\d{4}/[A-Z]+")
FILE_CONT_RE = re.compile(r"^\s*(\d{4}/[A-Z]+|[A-Za-z]{3}\d{4}-)")
DATE_END_RE = re.compile(r"(\d{1,2}/\d{1,2}/(?:\d{5}|\d{4}|\d{2}))\s*\.?\s*$")
ID_RE = re.compile(r"\b([A-Z]{2}\d{6})\b")
PAGE_HEADER_RE = re.compile(r"^\s*Residential Building Contractor Enforcement Actions(\s+\d+)?\s*$")
# Dates DLI printed in a form that does not parse; each correction is listed in the snapshot with the printed text.
PRINTED_DATE_CORRECTIONS = {"05/29/20266": "2026-05-29"}
BOILER = ("Year to Date", "Any violation of an Order of the Commissioner", "A Consent Order is not a finding of fact", "For more information about specific orders")


def parse_enforcement_year(year: str, path: Path) -> dict:
    text = (RAW / (path.name + ".txt")).read_text(encoding="utf-8")
    lines = [ln.rstrip() for ln in text.split("\n")]
    entries: list[dict] = []
    cur: dict | None = None
    last_kind: str | None = None  # 'header' | 'city' | 'order' | 'file'
    for ln in lines:
        s = ln.strip()
        if not s or PAGE_HEADER_RE.match(s) or any(b in s for b in BOILER):
            continue
        if s.startswith("•"):
            body = s.lstrip("•").strip()
            if cur is None:
                raise SystemExit(f"{year}: bullet before any header: {s!r}")
            if FILE_RE.search(body) and not ORDER_RE.match(body):
                cur["files"].append(body)
                last_kind = "file"
            elif ORDER_RE.match(body):
                cur["orders"].append(body)
                last_kind = "order"
            else:
                cur["cities"].append(body)
                last_kind = "city"
            continue
        # non-bullet line
        if cur is not None and last_kind == "order" and not DATE_END_RE.search(cur["orders"][-1]):
            cur["orders"][-1] = cur["orders"][-1] + " " + s
            continue
        if cur is not None and last_kind == "file" and FILE_CONT_RE.match(s):
            cur["files"][-1] = cur["files"][-1] + " " + s
            continue
        if cur is not None and last_kind == "header" and (s[0].islower() or re.search(r"(\bdba|\baka|\band|,|&)\s*$", cur["header"])):
            cur["header"] = cur["header"] + " " + s  # wrapped cross-reference ("... Handyman Connection" / "of Eden Prairie")
            continue
        if cur is not None and last_kind == "header" and not re.search(r"\s[-–]\s*see\s", cur["header"]) and not re.search(r"\s[-–]\s*see\s", s):
            cur["header"] = cur["header"] + " " + s
            continue
        cur = {"header": s, "cities": [], "orders": [], "files": []}
        entries.append(cur)
        last_kind = "header"
    events, aliases = [], 0
    for n, e in enumerate(entries):
        header = re.sub(r"\s+", " ", e["header"]).strip()
        if re.search(r"\s[-–]\s*see\s", header):
            if e["orders"]:
                raise SystemExit(f"{year}: alias line with orders: {header!r}")
            aliases += 1
            continue
        if not e["orders"]:
            if e["cities"] or e["files"]:
                raise SystemExit(f"{year}: entry without an order bullet: {header!r}")
            aliases += 1  # a bare cross-reference line printed without "see" (for example "Smith, John C. - JsXteriors LLC")
            continue
        # respondent as printed = header before the " – <ids>" tail, ids from the header and the synopsis
        m = re.match(r"^(.*?)\s*[-–]\s*((?:[A-Z]{2}\d{6}|,|\s|and|\(|\))+)$", header)
        respondent = m.group(1).strip() if m and ID_RE.search(m.group(2)) else header
        header_ids = ID_RE.findall(header)
        cities = "; ".join(re.sub(r"\s+", " ", c) for c in e["cities"]) or None
        files = sorted({re.sub(r"\s+", "", f) for blob in e["files"] for f in FILE_RE.findall(blob)})
        for k, order in enumerate(e["orders"]):
            om = ORDER_RE.match(re.sub(r"\s+", " ", order).strip())
            action_type, rest = om.group(1), om.group(2).strip()
            dm = DATE_END_RE.search(rest)
            raw_date = dm.group(1) if dm else ""
            if re.fullmatch(r"\d{1,2}/\d{1,2}/\d{2}", raw_date):
                raw_date = raw_date[: raw_date.rindex("/") + 1] + "20" + raw_date[-2:]  # DLI printed a two-digit year
            date = PRINTED_DATE_CORRECTIONS.get(raw_date) or (iso_mdy(raw_date) if raw_date else None)
            if date is None:
                raise SystemExit(f"{year}: order without a trailing date: {respondent!r}: {rest[:80]!r}")
            synopsis = re.sub(r"\s*[-–]?\s*\d{1,2}/\d{1,2}/(?:\d{5}|\d{4}|\d{2})\s*\.?\s*$", "", rest).strip()
            ids = []
            for i in header_ids + ID_RE.findall(synopsis):
                if i not in ids:
                    ids.append(i)
            pen = re.search(r"\$[\d,]+ monetary penalty(?:,? \$[\d,]+,? stayed with conditions)?", synopsis)
            events.append(
                {
                    "id": f"MN-DLI-RBC-ACTION:{year}:{n}:{k}",
                    "grain": "DLI_RESIDENTIAL_BUILDING_CONTRACTOR_ENFORCEMENT_ACTION_AS_LISTED",
                    "listYear": year,
                    "actionDate": date,
                    "actionDatePrinted": dm.group(1),
                    "respondent": respondent,
                    "cityPrinted": cities,
                    "actionType": action_type,
                    "synopsis": synopsis,
                    "penaltyPrinted": pen.group(0) if pen else None,
                    "credentialNumbersPrinted": ids,
                    "fileNumbers": files,
                }
            )
    if not events:
        raise SystemExit(f"{year}: no events parsed")
    return {"year": year, "file": path.name, "sha256": sha(path), "bytes": path.stat().st_size, "textSha256": sha(RAW / (path.name + ".txt")), "entries": len(entries), "aliasCrossReferences": aliases, "events": events}


def parse_enforcement() -> dict:
    years = {y: parse_enforcement_year(y, RAW / f) for y, f in ENFORCEMENT_PDFS.items()}
    events = [ev for y in years.values() for ev in y["events"]]
    events.sort(key=lambda e: (e["actionDate"], e["respondent"], e["id"]))
    return {
        "source": ENFORCEMENT_PAGE,
        "method": "Three DLI year-to-date PDFs (2024, 2025, 2026) as published; text extracted with pypdf 6.16.1; one row per order bullet, respondent and credential numbers exactly as printed",
        "retrievedAt": RETRIEVED_AT,
        "disclaimerPrinted": "A Consent Order is not a finding of fact or admission of guilt.",
        "files": {y: {k: v for k, v in d.items() if k != "events"} for y, d in years.items()},
        "events": events,
    }


def acquire_parse() -> None:
    STAGE.mkdir(parents=True, exist_ok=True)
    SHARDS.mkdir(parents=True, exist_ok=True)
    manifest, shards, _labels = parse_export()
    for old in SHARDS.glob("*.json"):
        old.unlink()
    for k, v in sorted(shards.items()):
        data = compact(v)
        (SHARDS / f"{k}.json").write_bytes(data)
        manifest["shardSha256"][k] = hashlib.sha256(data).hexdigest()
    (STAGE / "export-manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    (STAGE / "enforcement.json").write_text(json.dumps(parse_enforcement(), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def load(name: str):
    return json.loads((STAGE / name).read_text(encoding="utf-8"))


def compact(obj) -> bytes:
    return (json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8")


def load_shards(manifest: dict) -> list[dict]:
    rows = []
    for k, want in sorted(manifest["shardSha256"].items()):
        data = (SHARDS / f"{k}.json").read_bytes().replace(b"\r\n", b"\n")
        if hashlib.sha256(data).hexdigest() != want:
            raise SystemExit(f"credential shard {k} drifted from the manifest")
        rows.extend(json.loads(data))
    if len(rows) != manifest["rows"]:
        raise SystemExit("shard row count drifted")
    return rows


def by_desc(counter: Counter, limit: int | None = None) -> dict:
    items = sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))
    return dict(items[:limit] if limit else items)


def build():
    manifest = load("export-manifest.json")
    enf = load("enforcement.json")
    labels = manifest["labels"]
    rows = load_shards(manifest)
    E = enf["events"]
    lab = {l["id"]: l for l in labels}
    by_number = {r["n"]: r for r in rows}
    biz = [r for r in rows if r["g"] == "B"]
    per = [r for r in rows if r["g"] == "P"]
    status_printed = Counter(r["s"] for r in rows)
    status_group = Counter(r["s"].upper() for r in rows)

    def block(subset: list[dict]) -> dict:
        return {
            "rows": len(subset),
            "statusAsPrinted": by_desc(Counter(r["s"] for r in subset)),
            "statusGroupedCaseInsensitive": by_desc(Counter(r["s"].upper() for r in subset)),
            "issuedPerDliStatement": sum(1 for r in subset if r["s"].upper() == "ISSUED"),
            "dliEnforcementActionFlag": sum(1 for r in subset if r["ea"]),
            "renewalInProgress": sum(1 for r in subset if r["rp"]),
            "expirationPrinted": sum(1 for r in subset if r["e"]),
        }

    def sub_rows(subtype: str) -> list[dict]:
        ids = {l["id"] for l in labels if l["subtype"] == subtype}
        return [r for r in rows if r["k"] in ids]

    def class_block(subtype: str) -> dict:
        l = next(x for x in labels if x["subtype"] == subtype)
        rs = sub_rows(subtype)
        return {
            "subtype": subtype, "kind": l["kind"], "grain": l["grain"], "rows": len(rs),
            "issuedPerDliStatement": sum(1 for r in rs if r["s"].upper() == "ISSUED"),
            "statusGroupedCaseInsensitive": by_desc(Counter(r["s"].upper() for r in rs)),
            "dliEnforcementActionFlag": sum(1 for r in rs if r["ea"]),
            "prefixesPrinted": sorted({r["n"][:2] for r in rs}) if len({r["n"][:2] for r in rs}) <= 4 else "various",
        }

    types = sorted({l["type"] for l in labels})
    type_matrix = []
    for t in types:
        subs = [l for l in labels if l["type"] == t]
        type_matrix.append(
            {
                "type": t,
                "rows": sum(l["rows"] for l in subs),
                "businessSubtypes": [{"subtype": l["subtype"], "kind": l["kind"], "rows": l["rows"], "issuedPerDliStatement": sum(1 for r in sub_rows(l["subtype"]) if r["s"].upper() == "ISSUED")} for l in subs if l["grain"] == "business"],
                "personSubtypes": [{"subtype": l["subtype"], "kind": l["kind"], "rows": l["rows"], "issuedPerDliStatement": sum(1 for r in sub_rows(l["subtype"]) if r["s"].upper() == "ISSUED")} for l in subs if l["grain"] == "person"],
            }
        )
    kinds = Counter()
    kinds_biz = Counter()
    kinds_per = Counter()
    for r in rows:
        k = lab[r["k"]]["kind"]
        kinds[k] += 1
        (kinds_biz if r["g"] == "B" else kinds_per)[k] += 1
    city = {c.title().replace("St Paul", "St. Paul"): sum(1 for r in biz if r["st"] == "MN" and norm_city(r["city"] or "") == c) for c in CITIES}
    odd_numbers = sorted(r["n"] for r in rows if not STRICT_CRED_RE.match(r["n"]))

    # enforcement attribution: exact printed credential numbers that exist in the export
    events = []
    attached_rows = 0
    per_cred: dict[str, list] = defaultdict(list)
    for e in E:
        in_export = [i for i in e["credentialNumbersPrinted"] if i in by_number]
        not_in = [i for i in e["credentialNumbersPrinted"] if i not in by_number]
        attribution = "exact_credential_number_in_export" if in_export else ("exact_credential_number_not_in_export" if not_in else "standalone_event_no_credential_number")
        events.append({**e, "attribution": attribution, "credentialNumbersInExport": in_export, "credentialNumbersNotInExport": not_in})
        if in_export:
            attached_rows += 1
            for i in in_export:
                per_cred[i].append(e["id"])
    attached_by_grain = Counter(lab[by_number[i]["k"]]["grain"] for i in per_cred)
    attached_by_subtype = Counter(lab[by_number[i]["k"]]["subtype"] for i in per_cred)
    ea_flag_agreement = sum(1 for i in per_cred if by_number[i]["ea"])
    action_types = Counter(e["actionType"] for e in E)

    snapshot = {
        "contract_name": "contractor-mn-state-intel-v1",
        "ticket": "MN-CON-001",
        "path": "/minnesota",
        "generated_at": GENERATED_AT,
        "regulator": {
            "agency": "Minnesota Department of Labor and Industry (DLI), Construction Codes and Licensing Division",
            "law": "Minn. Stat. ch. 326B (construction codes and licensing); Minn. Stat. § 326B.845 (violation of a Commissioner's order); Minn. Stat. § 181.723 (contractor registration)",
            "lookup": LOOKUP_PAGE,
            "ims": IMS,
            "exportBase": EXPORT_BASE,
            "enforcement": ENFORCEMENT_PAGE,
            "contractorComplaint": CONTRACTOR_COMPLAINT,
            "residentialLicensing": RESIDENTIAL_LICENSING,
        },
        "statewide_export": {
            "coverage": "KNOWN",
            "dliStatement": DLI_STATEMENT,
            "asOfPrintedByDli": None,
            "asOfPolicy": "DLI says the export is updated nightly and prints no as-of date; the retrieval time and the zip member's own date stamp are the only clocks, and none is invented",
            "retrievedAt": manifest["retrievedAt"],
            "files": manifest["files"],
            "columns": manifest["columns"],
            "rows": manifest["rows"],
            "distinctCredentialNumbers": manifest["distinctCredentialNumbers"],
            "credentialNumberForm": "two-character prefix plus six digits as printed (for example BC, QB, EA, PC, MB, IR)",
            "credentialNumbersOutsidePrefixSixDigitForm": {"count": len(odd_numbers), "bySubtype": by_desc(Counter(lab[by_number[n]["k"]]["subtype"] for n in odd_numbers)), "examples": odd_numbers[:5]},
            "credentialNumbersPrintedWithSurroundingWhitespace": manifest["numbersPrintedWithWhitespace"],
            "busPers": {"Business": len(biz), "Personal": len(per)},
            "statusAsPrinted": by_desc(status_printed),
            "statusGroupedCaseInsensitive": by_desc(status_group),
            "statusPolicy": "status is kept exactly as DLI prints it; DLI prints the same word in mixed and upper case ('Issued' and 'ISSUED'), so grouped counts are shown beside the as-printed counts. 'Issued' is the only status DLI describes as current and active; 'LICENSED' is printed on some registrations and is not folded into Issued. A future expiration date does not make a credential current.",
            "fieldsDroppedForEveryRow": manifest["fieldsDroppedForEveryRow"],
            "fieldsDroppedForPersonRows": manifest["fieldsDroppedForPersonRows"],
            "droppedFieldCounts": manifest["droppedFieldCounts"],
            "types": type_matrix,
            "credentialKinds": {"all": by_desc(kinds), "business": by_desc(kinds_biz), "person": by_desc(kinds_per)},
        },
        "business_credentials": {
            "grain": "credential issued to a business (DLI Bus_Pers = Business)",
            **block(biz),
            "namePublished": True,
            "cityOfRecordMinnesota": city,
            "addressIsNotServiceArea": True,
            "withMinnesotaAddress": sum(1 for r in biz if r["st"] == "MN"),
            "withOutOfStateAddress": sum(1 for r in biz if r["st"] and r["st"] != "MN"),
        },
        "person_credentials": {
            "grain": "credential issued to an individual (DLI Bus_Pers = Personal)",
            **block(per),
            "namePublished": False,
            "cityPublished": False,
            "exactNumberLookupOnly": True,
            "notContractors": True,
            "policy": "an individual's credential is verified by its exact number; the name on it is confirmed on DLI's lookup, not here",
        },
        "residential_contractors": {
            "businessClasses": [class_block(s) for s in RESIDENTIAL_BUSINESS],
            "qualifyingPersons": [class_block(s) for s in RESIDENTIAL_PERSON],
            "rule": "A residential building contractor, residential remodeler, or residential roofer license is issued to the business and must have a qualifying person (qualifying builder, remodeler, or roofer registration) who passed the examination. The license and the qualifying registration are different credentials with different numbers and are never added. A Certificate of Exemption is not a license.",
        },
        "electrical": {
            "businessClasses": [class_block(s) for s in ["Class A Electrical Contractor", "Class B Electrical Contractor", "Technology Systems Contractor", "Satellite System Contractor", "Registered Electrical Employer", "Sign Contractor Bond"]],
            "personClasses": [class_block(s) for s in ["Class A Master Electrician", "Class B Master Electrician", "Journeyworker A Electrician", "Journeyworker B Electrician", "Power Limited Technician", "Maintenance Electrician", "Lineman", "Class B Installer", "Satellite System Installer", "Registered Unlicensed Electrician", "Registered Unlicensed Power Limited Technician"]],
            "rule": "electrical contractor (business) != electrician (person); a registered unlicensed individual is a registration, not a license",
        },
        "plumbing": {
            "businessClasses": [class_block(s) for s in ["Plumbing Contractor", "Restricted Plumbing Contractor", "Registered Plumbing Employer", "Pipelaying Bond"]],
            "personClasses": [class_block(s) for s in ["Master Plumber", "Restricted Master Plumber", "Journeyworker Plumber", "Restricted Journeyworker Plumber", "Registered Unlicensed Plumber", "Backflow Prevention Tester", "Backflow Prevention Rebuilder", "Medical Gas Certification", "MPCA Pipelaying Bond"]],
            "rule": "plumbing contractor (business) != plumber (person); backflow and medical gas are certifications; a pipelaying bond is a bond",
        },
        "bonds_and_registrations": {
            "bonds": [class_block(s) for s in KIND["bond"]],
            "contractorRegistration": [class_block(s) for s in ["Business Entity", "Sole Proprietor or Individual"]],
            "rule": "A bond is regulatory evidence of financial responsibility, not an identity, a count of contractors, a quality score, or insurance. Contractor Registration (Minn. Stat. § 181.723) is a registration for independent contractors in the building trades, not a license.",
        },
        "other_ccld_credentials": {
            "types": [t for t in types if t not in ("Residential Contractors", "Electrical", "Plumbing", "Mechanical Contractor Bond", "Contractor Registration")],
            "note": "Boiler, Building Officials, Continuing Education, Elevator, High Pressure Piping, Manufactured Structures, and Water Conditioning credentials are in the same export, are counted by their own subtype above, and resolve in the exact-number lookup. They are not contractor licenses and are never added to one.",
        },
        "enforcement": {
            "coverage": "PARTIAL",
            "scope": "DLI residential building contractor enforcement action lists for 2024, 2025, and 2026 year to date, as published on the retrieval date; 2023 and earlier lists were not acquired",
            "source": enf["source"],
            "method": enf["method"],
            "retrievedAt": enf["retrievedAt"],
            "disclaimerPrinted": enf["disclaimerPrinted"],
            "files": enf["files"],
            "rows": len(E),
            "rowsByListYear": dict(sorted(Counter(e["listYear"] for e in E).items())),
            "rowsByActionYear": dict(sorted(Counter(e["actionDate"][:4] for e in E).items())),
            "actionTypes": by_desc(action_types),
            "firstActionDate": E[0]["actionDate"] if E else None,
            "lastActionDate": E[-1]["actionDate"] if E else None,
            "rowsWithCredentialNumberPrinted": sum(1 for e in E if e["credentialNumbersPrinted"]),
            "rowsWithoutCredentialNumber": sum(1 for e in E if not e["credentialNumbersPrinted"]),
            "rowsWithPenaltyPrinted": sum(1 for e in E if e["penaltyPrinted"]),
            "distinctCredentialNumbersPrinted": len({i for e in E for i in e["credentialNumbersPrinted"]}),
            "rowsAttachedByExactCredentialNumber": attached_rows,
            "credentialsInExportWithEnforcement": len(per_cred),
            "credentialsWithEnforcementByGrain": dict(sorted(attached_by_grain.items())),
            "credentialsWithEnforcementBySubtype": by_desc(attached_by_subtype),
            "attachedCredentialsAlsoFlaggedByDli": ea_flag_agreement,
            "dliEnforcementFlagRowsInExport": sum(1 for r in rows if r["ea"]),
            "nameOnlyAttachment": False,
            "databaseProfileAttachments": 0,
            "orderDetailFetched": False,
        },
        "complaints": {
            "intake": "KNOWN",
            "contractorComplaint": CONTRACTOR_COMPLAINT,
            "records": "NOT_ACQUIRED",
            "complaintIsNotEnforcement": True,
            "consentOrderIsNotFinding": True,
        },
        "existing_coverage": {
            "statePage": "NONE (/minnesota returned 404 before this ticket)",
            "database": EXISTING_DATABASE,
            "reconciliation": RECONCILIATION,
            "reconciliationMeaning": "exact credential-number matches between the 2026-09-26 export and the 2026-08-14 Production load; databaseCredentialsNotInExport are rows DLI no longer exports; sharedCredentialsWithChangedStatus compares status case-insensitively. Production was read only and not changed.",
            "preExistingConcern": "Production publishes each DLI person row as a contractor profile with phone and street address in raw_payload; this ticket does not repeat that (person rows here are number-only) and does not modify it. Reported for the Founder.",
            "databaseModified": False,
        },
        "capability_matrix": [
            {"capability": "Statewide DLI export (nightly)", "state": "KNOWN"},
            {"capability": "Exact credential verification (DLI lookup / iMS)", "state": "KNOWN"},
            {"capability": "Business credentials (licenses, bonds, registrations, exemptions, approvals)", "state": "KNOWN"},
            {"capability": "Individual credentials (exact-number lookup, no names)", "state": "KNOWN"},
            {"capability": "Residential Building Contractor / Remodeler / Roofer classes", "state": "KNOWN"},
            {"capability": "Electrical business / person separation", "state": "KNOWN"},
            {"capability": "Plumbing business / person separation", "state": "KNOWN"},
            {"capability": "Bonds (mechanical, pipelaying, MPCA pipelaying, sign contractor)", "state": "KNOWN"},
            {"capability": "Contractor Registration (Minn. Stat. § 181.723)", "state": "KNOWN"},
            {"capability": "Residential building contractor enforcement 2024 - 2026 YTD", "state": "PARTIAL"},
            {"capability": "Enforcement before 2024", "state": "NOT_ACQUIRED"},
            {"capability": "Order text / per-order detail", "state": "NOT_ACQUIRED"},
            {"capability": "Electrical / plumbing / other trade enforcement lists", "state": "NOT_ACQUIRED"},
            {"capability": "Complaint intake", "state": "KNOWN"},
            {"capability": "Complaint records", "state": "NOT_ACQUIRED"},
            {"capability": "Local (city/county) permits and licensing", "state": "UNKNOWN"},
            {"capability": "Name-only enforcement attachment", "state": "UNSUPPORTED"},
            {"capability": "Combined Minnesota contractor / trades / bond / certification total", "state": "UNSUPPORTED"},
        ],
        "guardrails": [
            "business credential != individual credential != bond != certificate != registration != enforcement",
            "residential building contractor != residential remodeler != residential roofer != qualifying builder/remodeler/roofer",
            "electrical contractor (business) != electrician (person); plumbing contractor (business) != plumber (person)",
            "status is as DLI prints it; a future expiration date does not make a credential current",
            "enforcement attaches only through an exact credential number DLI printed; never by name; a Consent Order is not a finding",
            "bond != identity != count != quality != insurance; complaint != enforcement; address != service area",
            "no combined Minnesota contractor count; no ranking; no Trust Score; no person names, phones, or street addresses",
        ],
        "net_new": {
            "EXPORT_ROWS": len(rows),
            "BUSINESS_CREDENTIAL_ROWS": len(biz),
            "PERSON_CREDENTIAL_ROWS_NUMBER_ONLY": len(per),
            "ENFORCEMENT_ROWS": len(E),
            "ENFORCEMENT_ROWS_ATTACHED_BY_EXACT_CREDENTIAL": attached_rows,
            "NEW_PROFILES": 0,
            "DATABASE_WRITES": 0,
        },
    }
    db_path = RAW / "database-license-numbers.txt"  # gitignored export of the read-only audit, if present
    if db_path.exists():
        db = {}
        for ln in db_path.read_text(encoding="utf-8", errors="replace").splitlines():
            if ln.strip():
                p = ln.split("|")
                db[p[0]] = p[1].strip().upper()
        cur = set(by_number)
        shared = cur & set(db)
        got = {
            "exportCredentialsAlsoInDatabase": len(shared),
            "exportCredentialsNotInDatabase": len(cur - set(db)),
            "databaseCredentialsNotInExport": len(set(db) - cur),
            "sharedCredentialsWithChangedStatus": sum(1 for i in shared if db[i] != by_number[i]["s"].upper()),
        }
        if got != RECONCILIATION:
            raise SystemExit(f"database reconciliation drifted: {got}")
    snapshot["credentialShardsSha256"] = hashlib.sha256(json.dumps(manifest["shardSha256"], sort_keys=True).encode()).hexdigest()
    snapshot["eventsSha256"] = hashlib.sha256(compact(events)).hexdigest()
    snapshot["fingerprint"] = hashlib.sha256(json.dumps(snapshot, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()

    def issued(subtype: str) -> int:
        return sum(1 for r in sub_rows(subtype) if r["s"].upper() == "ISSUED")

    summary = {
        "fingerprint": snapshot["fingerprint"],
        "exportRows": len(rows),
        "businessRows": len(biz),
        "personRows": len(per),
        "residentialBuildingContractor": {"rows": len(sub_rows("Residential Building Contractor")), "issued": issued("Residential Building Contractor")},
        "residentialRemodeler": {"rows": len(sub_rows("Residential Remodeler Contractor")), "issued": issued("Residential Remodeler Contractor")},
        "residentialRoofer": {"rows": len(sub_rows("Residential Roofer Contractor")), "issued": issued("Residential Roofer Contractor")},
        "qualifyingBuilder": {"rows": len(sub_rows("Qualifying Builder")), "issued": issued("Qualifying Builder")},
        "classAElectricalContractor": {"rows": len(sub_rows("Class A Electrical Contractor")), "issued": issued("Class A Electrical Contractor")},
        "classAMasterElectrician": {"rows": len(sub_rows("Class A Master Electrician")), "issued": issued("Class A Master Electrician")},
        "journeyworkerAElectrician": {"rows": len(sub_rows("Journeyworker A Electrician")), "issued": issued("Journeyworker A Electrician")},
        "plumbingContractor": {"rows": len(sub_rows("Plumbing Contractor")), "issued": issued("Plumbing Contractor")},
        "masterPlumber": {"rows": len(sub_rows("Master Plumber")), "issued": issued("Master Plumber")},
        "journeyworkerPlumber": {"rows": len(sub_rows("Journeyworker Plumber")), "issued": issued("Journeyworker Plumber")},
        "mechanicalContractorBond": {"rows": len(sub_rows("Mechanical Contractor Bond")), "issued": issued("Mechanical Contractor Bond")},
        "contractorRegistration": {"rows": sum(l["rows"] for l in labels if l["type"] == "Contractor Registration"), "issued": issued("Business Entity") + issued("Sole Proprietor or Individual")},
        "enforcementRows": len(E),
        "enforcementAttachedByExactCredential": attached_rows,
        "enforcementWindow": "2024 through 2026 year to date",
        "enforcementActionTypes": by_desc(action_types),
        "cityOfRecordMinnesota": city,
        "retrievedAt": manifest["retrievedAt"],
    }
    return snapshot, summary, events, labels


def main() -> int:
    if "--acquire-parse" in sys.argv:
        acquire_parse()
    snap, summary, events, labels = build()
    targets = {
        LIB / "accepted-snapshot.json": (json.dumps(snap, indent=2, ensure_ascii=False) + "\n").encode("utf-8"),
        LIB / "summary.json": (json.dumps(summary, indent=2, ensure_ascii=False) + "\n").encode("utf-8"),
        LIB / "events.json": compact(events),
        LIB / "credential-labels.json": compact(labels),
    }
    if "--check" in sys.argv:
        for path, want in targets.items():
            if not path.exists() or path.read_bytes().replace(b"\r\n", b"\n") != want:
                raise SystemExit(f"{path.relative_to(ROOT)} drifted from the builder")
        print("MN-CON-001 check OK", snap["fingerprint"])
        return 0
    LIB.mkdir(parents=True, exist_ok=True)
    for path, data in targets.items():
        path.write_bytes(data)
    x = snap["statewide_export"]
    print("fingerprint", snap["fingerprint"])
    print("rows", x["rows"], x["busPers"], "odd numbers", x["credentialNumbersOutsidePrefixSixDigitForm"], "padded", x["credentialNumbersPrintedWithSurroundingWhitespace"])
    print("status printed", x["statusAsPrinted"])
    print("kinds", x["credentialKinds"])
    print("dropped", x["droppedFieldCounts"])
    e = snap["enforcement"]
    print("enforcement", e["rows"], e["rowsByListYear"], e["actionTypes"], "attached", e["rowsAttachedByExactCredentialNumber"], "creds", e["credentialsInExportWithEnforcement"], e["credentialsWithEnforcementByGrain"], "flag agree", e["attachedCredentialsAlsoFlaggedByDli"])
    print("no-number rows", e["rowsWithoutCredentialNumber"], "not-in-export", sum(1 for ev in events if ev["attribution"] == "exact_credential_number_not_in_export"))
    print("cities", summary["cityOfRecordMinnesota"])
    print("summary", {k: v for k, v in summary.items() if isinstance(v, dict) and "rows" in v})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
