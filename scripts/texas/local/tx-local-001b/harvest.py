"""TX-CON-LOCAL-001B — San Antonio/Bexar + Houston/Harris bounded harvest.

Allowed: official CSV/CKAN/ArcGIS/FTP bulk.
Forbidden: TULIP/Accela scrape, CAPTCHA, PRA wait, paid export, public routes.
Does not touch austin-travis / fort-worth-tarrant (Builder 3).
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

UA = "ContractorTrustHub-TX-CON-LOCAL-001B/1.0 (research; official bulk only; no portal scrape)"
CTX = ssl.create_default_context()
ROOT = Path(__file__).resolve().parents[4]
SA = ROOT / "data" / "texas" / "local" / "san-antonio-bexar"
HOU = ROOT / "data" / "texas" / "local" / "houston-harris"
BUNDLE = ROOT / "data" / "texas" / "local" / "tx-local-001b"
DOCS = ROOT / "docs" / "texas" / "local" / "tx-local-001b"
ART = ROOT / "artifacts" / "tx-local-001b"
for path in (SA, HOU, BUNDLE, DOCS, ART):
    path.mkdir(parents=True, exist_ok=True)

RETRIEVED = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch(url: str, timeout: int = 90, method: str = "GET") -> tuple[int, bytes, dict]:
    req = urllib.request.Request(url, method=method, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
            return resp.status, resp.read() if method != "HEAD" else b"", {
                k.lower(): v for k, v in resp.headers.items()
            }
    except urllib.error.HTTPError as e:
        body = e.read() if e.fp and method != "HEAD" else b""
        return e.code, body, dict(e.headers.items()) if e.headers else {}
    except Exception as e:
        return 0, str(e).encode(), {}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def save_bytes(dest: Path, data: bytes) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return {"path": str(dest.relative_to(ROOT)).replace("\\", "/"), "bytes": len(data), "sha256": sha256(data)}


def json_get(url: str, timeout: int = 90) -> tuple[int, object]:
    status, body, _ = fetch(url, timeout=timeout)
    if status != 200:
        return status, {"snippet": body[:400].decode("utf-8", "replace")}
    try:
        return status, json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        return status, {"snippet": body[:400].decode("utf-8", "replace")}


def ckan_search(base: str, q: str, rows: int = 8) -> dict:
    url = f"{base}/api/3/action/package_search?" + urllib.parse.urlencode({"q": q, "rows": str(rows)})
    st, payload = json_get(url)
    if st != 200 or not isinstance(payload, dict):
        return {"q": q, "http_status": st, "count": None, "titles": []}
    result = payload.get("result") or {}
    titles = []
    for item in result.get("results") or []:
        titles.append(
            {
                "name": item.get("name"),
                "title": item.get("title"),
                "resources": [
                    {"name": r.get("name"), "format": r.get("format"), "url": r.get("url"), "size": r.get("size")}
                    for r in item.get("resources") or []
                ],
            }
        )
    return {"q": q, "http_status": st, "count": result.get("count"), "titles": titles}


def datastore_meta(base: str, resource_id: str) -> dict:
    url = f"{base}/api/3/action/datastore_search?" + urllib.parse.urlencode(
        {"resource_id": resource_id, "limit": "0"}
    )
    st, payload = json_get(url)
    if st != 200 or not isinstance(payload, dict):
        return {"resource_id": resource_id, "http_status": st}
    result = payload.get("result") or {}
    return {
        "resource_id": resource_id,
        "http_status": st,
        "total": result.get("total"),
        "fields": [f.get("id") for f in result.get("fields") or [] if f.get("id") != "_id"],
    }


def sample_rows(base: str, resource_id: str, limit: int = 8) -> list[dict]:
    url = f"{base}/api/3/action/datastore_search?" + urllib.parse.urlencode(
        {"resource_id": resource_id, "limit": str(limit)}
    )
    st, payload = json_get(url)
    if st != 200 or not isinstance(payload, dict):
        return []
    rows = (payload.get("result") or {}).get("records") or []
    clean = []
    for row in rows:
        clean.append({k: v for k, v in row.items() if k != "_id"})
    return clean


def profile_csv(path: Path, n_sample: int = 8) -> dict:
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    cols = reader.fieldnames or []
    rows = []
    for i, row in enumerate(reader):
        rows.append({k: (v or "").strip() for k, v in row.items()})
        if i >= 250000:
            break
    def col(*needles: str) -> str | None:
        lowered = {c.lower(): c for c in cols}
        for needle in needles:
            for lk, orig in lowered.items():
                if needle in lk:
                    return orig
        return None

    contact_col = col("primary contact", "contractor", "company", "applicant")
    type_col = col("permit type")
    work_col = col("work type")
    addr_col = col("address")
    permit_col = col("permit #", "permit number")
    val_col = col("valuation", "value")
    date_col = col("date issued", "issued")
    contacts = Counter((r.get(contact_col) or "").strip() or "(blank)" for r in rows) if contact_col else Counter()
    types = Counter((r.get(type_col) or "").strip() or "(blank)" for r in rows) if type_col else Counter()
    works = Counter((r.get(work_col) or "").strip() or "(blank)" for r in rows) if work_col else Counter()
    id_like = 0
    if contact_col:
        for r in rows:
            blob = r.get(contact_col) or ""
            if re.search(r"\b(TACL|TECL|TACLA|RM\d|MP\d|LIC|#)\b", blob, re.I):
                id_like += 1
    return {
        "rows": len(rows),
        "columns": cols,
        "permit_number_populated": sum(1 for r in rows if permit_col and r.get(permit_col)),
        "address_populated": sum(1 for r in rows if addr_col and r.get(addr_col)),
        "contact_populated": sum(1 for r in rows if contact_col and r.get(contact_col)),
        "contact_field": contact_col,
        "distinct_contacts": len([k for k in contacts if k != "(blank)"]),
        "blank_contacts": contacts.get("(blank)", 0),
        "contact_looks_like_license_id": id_like,
        "top_permit_types": [{"label": k, "count": v} for k, v in types.most_common(20)],
        "top_work_types": [{"label": k, "count": v} for k, v in works.most_common(20)],
        "top_contacts": [{"label": k, "count": v} for k, v in contacts.most_common(15) if k != "(blank)"],
        "valuation_populated": sum(1 for r in rows if val_col and r.get(val_col)),
        "issued_populated": sum(1 for r in rows if date_col and r.get(date_col)),
        "has_local_registration_id": any(
            re.search(r"regist|contractor.?id|license.?no|tdlr|tsbpe|parcel|account", c, re.I) for c in cols
        ),
        "sample": [{k: r.get(k) for k in cols[:12]} for r in rows[:n_sample]],
    }


def probe_urls(urls: list[str], timeout: int = 25) -> list[dict]:
    out = []
    for url in urls:
        st, body, headers = fetch(url, timeout=timeout, method="GET")
        info = {
            "url": url,
            "http_status": st,
            "bytes": len(body),
            "content_type": headers.get("content-type"),
            "content_disposition": headers.get("content-disposition"),
            "looks_html": body.lstrip()[:1] in (b"<", b"{") and b"<html" in body[:500].lower() if body else False,
            "looks_zip": body[:2] == b"PK",
            "looks_json": body.lstrip()[:1] == b"{",
        }
        if st == 200 and body and not info["looks_html"] and len(body) > 200:
            info["acquired_candidate"] = True
        out.append(info)
        print("probe", st, url[:90], flush=True)
    return out


def arcgis_search(hub: str, q: str) -> dict:
    urls = [
        f"{hub}/api/search/v1?" + urllib.parse.urlencode({"q": q, "limit": "8"}),
        f"{hub}/api/v3/search?" + urllib.parse.urlencode({"q": q, "limit": "8"}),
    ]
    for url in urls:
        st, payload = json_get(url, timeout=40)
        if st == 200 and isinstance(payload, dict) and payload.get("data") or payload.get("results"):
            items = payload.get("data") or payload.get("results") or []
            titles = []
            for item in items[:8]:
                attrs = item.get("attributes") or item
                titles.append(attrs.get("name") or attrs.get("title") or attrs.get("id"))
            return {"url": url, "http_status": st, "titles": titles, "count": payload.get("total") or len(items)}
        if st:
            return {"url": url, "http_status": st, "titles": [], "snippet": str(payload)[:300]}
    return {"url": urls[0], "http_status": 0, "titles": []}


def main() -> None:
    report: dict = {
        "ticket": "TX-CON-LOCAL-001B",
        "retrieved_at": RETRIEVED,
        "namespaces": ["tx-local-001b", "san-antonio-bexar", "houston-harris"],
        "builder3_namespaces_untouched": ["austin-travis", "fort-worth-tarrant"],
        "publication": "KEEP_DATA_ONLY",
        "no_local_routes": True,
        "guardrails": {
            "LOCAL_REGISTRATION_NE_STATE_LICENSE": True,
            "NO_TDLR_MATCH_NE_UNLICENSED": True,
            "TDLR_TRADE_NE_GENERAL_CONTRACTOR": True,
            "INSURANCE_REQUIREMENT_NE_PROOF": True,
            "PERMIT_NE_QUALITY": True,
            "APPRAISAL_NE_SALE": True,
            "HCAD_NE_HOUSTON_CITY": True,
            "CITY_OF_HOUSTON_NE_HARRIS_COUNTY": True,
            "MISSING_NE_ZERO": True,
            "NO_TRUST_SCORE": True,
            "NO_RANKING": True,
        },
    }

    # ------------------------------------------------------------------ SA
    print("SA catalog", flush=True)
    sa_ckan = "https://data.sanantonio.gov"
    sa_searches = {
        "contractor": ckan_search(sa_ckan, "contractor"),
        "registration": ckan_search(sa_ckan, "registration"),
        "buildsa": ckan_search(sa_ckan, "buildsa"),
        "license": ckan_search(sa_ckan, "license"),
        "permits": ckan_search(sa_ckan, "building permits"),
    }
    sa_permit_issued = datastore_meta(sa_ckan, "c21106f9-3ef5-4f3a-8604-f992b4db7512")
    sa_permit_hist = datastore_meta(sa_ckan, "c22b1ef2-dcf8-4d77-be1a-ee3638092aab")
    sa_permit_apps = datastore_meta(sa_ckan, "fbb7202e-c6c1-475b-849e-c5c2cfb65833")

    print("SA download current issued", flush=True)
    issued_url = "https://data.sanantonio.gov/dataset/05012dcb-ba1b-4ade-b5f3-7403bc7f52eb/resource/c21106f9-3ef5-4f3a-8604-f992b4db7512/download/permits_issued.csv"
    apps_url = "https://data.sanantonio.gov/dataset/05012dcb-ba1b-4ade-b5f3-7403bc7f52eb/resource/fbb7202e-c6c1-475b-849e-c5c2cfb65833/download/accelasubmitpermitsextract.csv"
    dict_url = "https://data.sanantonio.gov/dataset/05012dcb-ba1b-4ade-b5f3-7403bc7f52eb/resource/764f3297-2f73-41a3-8de5-5e3976baaf03/download/datadictionary-permits.xlsx"
    sa_files = {}
    for key, url, name in [
        ("permits_issued", issued_url, "permits_issued.csv"),
        ("applications", apps_url, "applications_submitted.csv"),
        ("dictionary", dict_url, "permits_data_dictionary.xlsx"),
    ]:
        st, body, headers = fetch(url, timeout=180)
        info = {"url": url, "http_status": st, "bytes": len(body), "content_type": headers.get("content-type")}
        if st == 200 and len(body) > 200 and not body.lstrip().startswith(b"<"):
            info.update(save_bytes(SA / "raw" / name, body))
            info["saved"] = True
        else:
            info["saved"] = False
            info["snippet"] = body[:300].decode("utf-8", "replace")
        sa_files[key] = info
        print(" saved" if info["saved"] else " fail", key, st, len(body), flush=True)

    issued_profile = None
    apps_profile = None
    if sa_files["permits_issued"].get("saved"):
        issued_profile = profile_csv(SA / "raw" / "permits_issued.csv")
        (SA / "permits-issued-profile.json").write_text(json.dumps(issued_profile, indent=2) + "\n", encoding="utf-8")
    if sa_files["applications"].get("saved"):
        apps_profile = profile_csv(SA / "raw" / "applications_submitted.csv")
        (SA / "applications-profile.json").write_text(json.dumps(apps_profile, indent=2) + "\n", encoding="utf-8")

    print("SA contractor registration probes", flush=True)
    sa_reg_probes = probe_urls(
        [
            "https://www.sa.gov/Directory/Departments/DSD/Contractor",
            "https://www.sa.gov/Directory/Departments/DSD/Contractor/Find-a-Contractor",
            "https://aca-prod.accela.com/COSACO/Cap/CapHome.aspx?module=Licenses",
            "https://aca-prod.accela.com/SANANTONIO/",
            "https://buildsa.sanantonio.gov/",
            "https://www.sanantonio.gov/DSD/Contractors",
        ]
    )
    contractor_connect = {
        "access": "OPEN_SEARCH_ONLY",
        "scrape": "FORBIDDEN",
        "official_search": "https://www.sa.gov/Directory/Departments/DSD/Contractor/Find-a-Contractor",
        "rule_page": "https://www.sa.gov/Directory/Departments/DSD/Contractor",
        "open_data_roster": "NOT_FOUND",
        "note": "All City- and State-licensed contractors must register with Development Services before permits are issued. Contractor Connect is a public search. Open Data SA has no contractor-registration table. Bond/insurance requirements are published as program rules, not record-level fields in the permit CSV.",
    }

    # ------------------------------------------------------------------ Bexar CAD
    print("Bexar CAD probes", flush=True)
    bexar_probes = probe_urls(
        [
            "https://bcad.org/",
            "https://bcad.org/online-portal/",
            "https://ftp.bcad.org/",
            "https://data.bcad.org/",
            "https://gis.bcad.org/",
            "https://maps.bcad.org/arcgis/rest/services",
            "https://gis.bexar.org/arcgis/rest/services?f=pjson",
        ]
    )
    bexar_cad = {
        "result": "PARKED_REQUEST_OR_NOT_IMMEDIATELY_DOWNLOADABLE",
        "reason": "BCAD public-information policy offers electronic appraisal/GIS products via FTP/CD, often after written request and possibly fees for historical/unscheduled exports. No immediately downloadable current bulk URL was found in this pass. Do not wait on PRA.",
        "sales_data": "CONFIDENTIAL_NOT_ACQUIRED",
        "owner_dossiers": "NOT_BUILT",
        "probes": bexar_probes,
    }

    # ------------------------------------------------------------------ Houston permits
    print("Houston catalog + ArcGIS", flush=True)
    hou_ckan = "https://data.houstontx.gov"
    hou_searches = {
        "building permit": ckan_search(hou_ckan, "building permit"),
        "contractor": ckan_search(hou_ckan, "contractor"),
        "electrical": ckan_search(hou_ckan, "electrical license"),
        "iPermits": ckan_search(hou_ckan, "ipermits"),
    }
    hou_hub = arcgis_search("https://opendata-cohpwe.hub.arcgis.com", "permit")
    hou_permit_probes = probe_urls(
        [
            "https://www.houstonpermittingcenter.org/",
            "https://geohub.houstontx.gov/",
            "https://opendata-cohpwe.hub.arcgis.com/",
            "https://data.houstontx.gov/dataset/residential-building-permits",
            "https://mycity2.houstontx.gov/pubgis02/rest/services?f=pjson",
            "https://www.houstonpermittingcenter.org/building-code-enforcement",
        ]
    )
    houston_permit_bulk = {
        "result": "SOURCE_NOT_ACQUIRED / SEARCH_ONLY",
        "reason": "City of Houston Open Data publishes only a monthly/yearly SUMMARY of residential building permits, not permit-level rows. iPermits / Houston Permitting Center is an interactive/login workflow. GeoHub/Public Works GIS is infrastructure-oriented. No official free row-level building-permit CSV/API was acquired in this bounded pass. Do not scrape the sold-permit search.",
        "summary_dataset": "https://data.houstontx.gov/dataset/residential-building-permits",
        "geography": "CITY_OF_HOUSTON_NOT_HARRIS_COUNTY",
        "ckan": hou_searches,
        "hub": hou_hub,
        "probes": hou_permit_probes,
    }
    houston_contractor_reg = {
        "result": "OPEN_SEARCH_ONLY / FORM",
        "note": "Houston does not require a local general-contractor license. Electrical, mechanical (TDLR A/C), and plumbing (TSBPE) trades register with the City. No structured public registration roster/API was found. Do not scrape.",
        "rule_source": "Houston Permitting Center permit-submittal overview: City does not license or register general contractors; trades register with the City after state license.",
    }

    # ------------------------------------------------------------------ Harris County
    print("Harris County probes", flush=True)
    harris_probes = probe_urls(
        [
            "https://www.harriscountytx.gov/",
            "https://www.harriscountyelectrical.com/",
            "https://www.hcfcd.org/",
            "https://www.harriscountyfws.org/",
            "https://www.harriscountytx.gov/Government/Departments/Engineering",
            "https://www.eng.hctx.net/",
            "https://www.harriscountytx.gov/Open-Data",
            "https://data.harriscountytx.gov/",
        ]
    )
    harris_county = {
        "result": "BOUNDED_PASS_NO_EASY_PERMIT_BULK",
        "geography": "HARRIS_COUNTY_NOT_CITY_OF_HOUSTON",
        "note": "One bounded pass. Unincorporated building regulation and county permit systems were not acquired as free bulk/API. Do not let county systems block HCAD.",
        "probes": harris_probes,
    }

    # ------------------------------------------------------------------ HCAD
    print("HCAD probes", flush=True)
    hcad_candidates = [
        "https://download.hcad.org/data/CAMA/2026/Real_acct.zip",
        "https://download.hcad.org/data/CAMA/2025/Real_acct.zip",
        "https://download.hcad.org/data/CAMA/2026/Real_building_land.zip",
        "https://download.hcad.org/data/CAMA/2026/Real_jur.zip",
        "https://download.hcad.org/data/CAMA/2026/Code.zip",
        "https://download.hcad.org/data/CAMA/2025/Real_building_land.zip",
        "https://download.hcad.org/data/CAMA/2025/Code.zip",
        "http://download.hcad.org/data/CAMA/2026/Real_acct.zip",
        "https://pdata.hcad.org/download/2026/Real_acct.zip",
        "https://hcad.org/assets/uploads/pdf/pdataCodebook.pdf",
        "https://hcad.org/pdata/pdata-property-downloads.html",
        "https://hcad.org/hcad-online-services/pdata/",
    ]
    hcad_probes = []
    hcad_acquired = []
    for url in hcad_candidates:
        name = url.rstrip("/").split("/")[-1]
        st_h, _, headers_h = fetch(url, timeout=20, method="HEAD")
        clen = headers_h.get("content-length")
        ctype = headers_h.get("content-type")
        info = {
            "url": url,
            "head_status": st_h,
            "content_length": int(clen) if clen and clen.isdigit() else None,
            "content_type": ctype,
        }
        print("hcad HEAD", st_h, name, info["content_length"], flush=True)
        want_get = name.endswith(".pdf") or name.lower() in {
            "code.zip",
            "real_jur.zip",
            "real_acct.zip",
            "real_building_land.zip",
        }
        size_ok = info["content_length"] is not None and info["content_length"] <= 120_000_000
        if (want_get or size_ok) and st_h in {200, 0, 405, 501}:
            timeout = 300 if (info["content_length"] or 0) > 10_000_000 else 90
            st, body, headers = fetch(url, timeout=timeout)
            info["http_status"] = st
            info["bytes"] = len(body)
            info["looks_zip"] = body[:2] == b"PK"
            info["looks_pdf"] = body[:4] == b"%PDF"
            if st == 200 and body[:2] == b"PK" and len(body) > 1000:
                dest = HOU / "raw" / "hcad" / name
                save_bytes(dest, body)
                info["saved"] = True
                info["path"] = str(dest.relative_to(ROOT)).replace("\\", "/")
                try:
                    with zipfile.ZipFile(io.BytesIO(body)) as zf:
                        info["zip_members"] = [
                            {"name": n, "bytes": zf.getinfo(n).file_size} for n in zf.namelist()[:20]
                        ]
                except zipfile.BadZipFile:
                    info["zip_members"] = []
                hcad_acquired.append(info)
            elif st == 200 and body[:4] == b"%PDF":
                dest = HOU / "raw" / "hcad" / "pdataCodebook.pdf"
                save_bytes(dest, body)
                info["saved"] = True
                hcad_acquired.append(info)
        else:
            info["http_status"] = st_h
            info["download"] = "SKIPPED_THIS_PASS_TOO_LARGE_OR_HEAD_FAILED"
            if info["content_length"] and info["content_length"] > 80_000_000:
                info["available_not_copied"] = True
        hcad_probes.append(info)

    hcad = {
        "official_page": "https://hcad.org/pdata/pdata-property-downloads.html",
        "codebook": "https://hcad.org/assets/uploads/pdf/pdataCodebook.pdf",
        "as_of_page": "2026 Preliminary Values; page last updated 2026-08-30",
        "result": "ACQUIRED" if hcad_acquired else "SOURCE_URL_NOT_RESOLVED_PAGE_CONFIRMED",
        "acquired": hcad_acquired,
        "probes": hcad_probes,
        "geography": "HARRIS_COUNTY_APPRAISAL_DISTRICT_NOT_CITY_OF_HOUSTON",
        "owner_dossiers": "NOT_BUILT",
        "sales_inference": "NOT_DONE",
        "minimum_files_sought": [
            "real_acct (account, situs, values)",
            "building information",
            "jurisdiction",
            "code descriptions",
        ],
        "hubs": ["Lender", "Insurance", "Contractor", "Investor"],
        "note": "HCAD public data is official, free, and large. Direct CAMA zip URLs are confirmed only when HTTP 200 + ZIP magic. Do not treat HCAD as City of Houston permits.",
    }

    # ------------------------------------------------------------------ identity from SA permits
    identity = {
        "hierarchy": [
            "EXACT_LOCAL_REGISTRATION",
            "EXACT_TDLR",
            "EXACT_TSBPE",
            "HIGH_CONFIDENCE_BUSINESS",
            "REVIEW_REQUIRED",
            "UNSAFE",
        ],
        "san_antonio_permits": {
            "local_registration_id_field": False,
            "tdlr_field": False,
            "tsbpe_field": False,
            "parcel_field": False,
            "contractor_identity_field": "PRIMARY CONTACT (name string)",
            "name_only": "UNSAFE for adverse attach",
            "exact_local_registration": 0,
            "exact_tdlr": 0,
            "exact_tsbpe": 0,
            "high_confidence_business": 0,
            "note": "Permit CSV has project address, not contractor address/phone. HIGH_CONFIDENCE requires exact business name + exact government address/phone + one unambiguous candidate. That join is not supported by this extract. Do not classify unmatched PRIMARY CONTACT as unlicensed.",
        },
        "houston_permits": {
            "row_level_file": "NOT_ACQUIRED",
            "exact_tdlr": None,
            "exact_tsbpe": None,
            "missing_is_not_zero": True,
        },
    }

    insurance_bond = {
        "grain": "PROGRAM_RULE",
        "record_level_fields": False,
        "required": "Some San Antonio registration/license categories require bond or insurance (official DSD page).",
        "filed": "UNKNOWN / not in permit CSV",
        "current": "UNKNOWN / contractors upload certificates to BuildSA Customer Portal (not bulk)",
        "carrier": "NOT_IN_STRUCTURED_EXTRACT",
        "expiration": "NOT_IN_STRUCTURED_EXTRACT",
        "bond_number": "NOT_IN_STRUCTURED_EXTRACT",
        "amount": "Rule example: Residential Building Contractor GL $500,000 per occurrence / $1,000,000 aggregate (application PDF). That is a requirement, not proof a named business currently carries it.",
        "do_not_publish": ["insured", "bonded"],
        "houston": "Trade registration with the City is not a GC license and is not a bulk insurance file.",
    }

    sources = [
        {
            "source": "Open Data SA Building Permits — PERMITS ISSUED",
            "agency": "City of San Antonio Development Services",
            "geographic_grain": "CITY_OF_SAN_ANTONIO_NOT_BEXAR_COUNTY",
            "url": issued_url,
            "access_class": "OPEN_BULK_DOWNLOAD",
            "format": "CSV/CKAN datastore",
            "retrieved": RETRIEVED,
            "as_of": "2026-08-30",
            "refresh": "OpenGovETL; dataset last updated 2026-08-30",
            "rows": (issued_profile or {}).get("rows") or sa_permit_issued.get("total"),
            "grain": "issued building/trade/garage-sale permit",
            "identity": "PERMIT #; PRIMARY CONTACT is a name string",
            "credential_fields": "none",
            "contact_fields": "PRIMARY CONTACT (name only)",
            "permit_fields": "PERMIT TYPE, PERMIT #, WORK TYPE, DATE SUBMITTED, DATE ISSUED, DECLARED VALUATION, AREA (SF)",
            "property_fields": "ADDRESS, LOCATION, X_COORD, Y_COORD; no parcel/account",
            "publication_eligibility": "KEEP_DATA_ONLY",
            "limitations": [
                "City of San Antonio only — not Bexar County.",
                "No local contractor registration ID, TDLR, or TSBPE column.",
                "PRIMARY CONTACT is name-only and UNSAFE for adverse attach.",
                "Garage-sale permits are in the same file; do not treat the row total as contractor jobs.",
            ],
        },
        {
            "source": "Open Data SA Building Permits — PERMITS ISSUED 2020-2024",
            "agency": "City of San Antonio Development Services",
            "geographic_grain": "CITY_OF_SAN_ANTONIO_NOT_BEXAR_COUNTY",
            "url": "https://data.sanantonio.gov/dataset/building-permits/resource/c22b1ef2-dcf8-4d77-be1a-ee3638092aab",
            "access_class": "OPEN_BULK_DOWNLOAD",
            "format": "CSV/CKAN datastore",
            "retrieved": RETRIEVED,
            "as_of": "2024-12-31",
            "refresh": "historical extract",
            "rows": sa_permit_hist.get("total"),
            "grain": "issued building/trade/garage-sale permit 2020-2024",
            "identity": "same schema as current issued file",
            "credential_fields": "none",
            "contact_fields": "PRIMARY CONTACT",
            "permit_fields": "same as current issued",
            "property_fields": "address/coords only",
            "publication_eligibility": "KEEP_DATA_ONLY",
            "limitations": ["Same missing contractor-ID schema. 78MB file profiled via datastore, not re-copied into git."],
        },
        {
            "source": "Open Data SA APPLICATIONS SUBMITTED",
            "agency": "City of San Antonio Development Services",
            "geographic_grain": "CITY_OF_SAN_ANTONIO_NOT_BEXAR_COUNTY",
            "url": apps_url,
            "access_class": "OPEN_BULK_DOWNLOAD",
            "format": "CSV",
            "retrieved": RETRIEVED,
            "as_of": "2026-08-30",
            "refresh": "this year applications",
            "rows": (apps_profile or {}).get("rows") or sa_permit_apps.get("total"),
            "grain": "permit application submitted this year",
            "identity": "PERMIT #; PRIMARY CONTACT name",
            "credential_fields": "none",
            "contact_fields": "PRIMARY CONTACT",
            "permit_fields": "same family as issued",
            "property_fields": "address/coords",
            "publication_eligibility": "KEEP_DATA_ONLY",
            "limitations": ["Application is not an issued permit."],
        },
        {
            "source": "San Antonio Contractor Connect / BuildSA registration",
            "agency": "City of San Antonio Development Services",
            "geographic_grain": "CITY_OF_SAN_ANTONIO",
            "url": "https://www.sa.gov/Directory/Departments/DSD/Contractor/Find-a-Contractor",
            "access_class": "OPEN_SEARCH_ONLY",
            "format": "interactive search",
            "retrieved": RETRIEVED,
            "as_of": None,
            "refresh": "portal",
            "rows": None,
            "grain": "looked-up registered contractor",
            "identity": "local registration on a looked-up record; not a bulk ID",
            "credential_fields": "state license type/number may appear on a looked-up record; not bulk",
            "contact_fields": "portal fields not harvested",
            "permit_fields": "n/a",
            "property_fields": "n/a",
            "publication_eligibility": "KEEP_DATA_ONLY",
            "limitations": [
                "No bulk/API/CSV of registered contractors was found.",
                "Missing roster is unknown, not zero.",
                "Insurance/bond on the DSD page is a requirement, not a per-contractor proof file.",
            ],
        },
        {
            "source": "HCAD Public Data (CAMA text files)",
            "agency": "Harris Central Appraisal District",
            "geographic_grain": "HARRIS_COUNTY_CAD_NOT_CITY_OF_HOUSTON",
            "url": "https://hcad.org/pdata/pdata-property-downloads.html",
            "access_class": "OPEN_BULK_DOWNLOAD" if hcad_acquired else "OFFICIAL_PAGE_CONFIRMED_DIRECT_ZIP_UNRESOLVED",
            "format": "zipped tab-delimited text + shapefiles",
            "retrieved": RETRIEVED,
            "as_of": "2026 Preliminary Values (page 2026-08-30)",
            "refresh": "weekly during preliminary season; certified mid-August",
            "rows": None,
            "grain": "real property account / building / jurisdiction",
            "identity": "acct (account number)",
            "credential_fields": "none",
            "contact_fields": "owner mailing on real_acct — not published as person dossier",
            "permit_fields": "permits.txt exists in Real_acct_owner.zip per codebook (CAD permit notes, not City of Houston issued permits)",
            "property_fields": "situs, legal, values, year built in building files, jurisdictions",
            "publication_eligibility": "KEEP_DATA_ONLY",
            "limitations": [
                "HCAD != City of Houston.",
                "Appraisal value != sale price.",
                "Do not publish owner-person dossiers.",
                "Direct zip URL resolution recorded in probes.",
            ],
        },
        {
            "source": "City of Houston Residential Building Permits by Month and Year",
            "agency": "City of Houston Planning and Development",
            "geographic_grain": "CITY_OF_HOUSTON_NOT_HARRIS_COUNTY",
            "url": "https://data.houstontx.gov/dataset/residential-building-permits",
            "access_class": "OPEN_BULK_DOWNLOAD",
            "format": "XLS monthly summary",
            "retrieved": RETRIEVED,
            "as_of": "2026-05-01",
            "refresh": "from weekly HPC reports",
            "rows": None,
            "grain": "month x year aggregate counts (single-family / multi-family)",
            "identity": "none",
            "credential_fields": "none",
            "contact_fields": "none",
            "permit_fields": "counts only",
            "property_fields": "none",
            "publication_eligibility": "KEEP_DATA_ONLY",
            "limitations": ["Not a permit-level file. Not Harris County permits."],
        },
    ]

    scorecard = {
        "San Antonio": {
            "CONTRACTOR IDENTITY": "MEDIUM",
            "WORK HISTORY": "HIGH",
            "PUBLIC CONTACTS": "LOW",
            "BOND/INSURANCE": "LOW",
            "PROPERTY": "LOW",
            "LENDER": "LOW",
            "INSURANCE": "LOW",
            "SENIOR": "LOW",
            "MOVE": "LOW",
            "INVESTOR": "MEDIUM",
            "ACQUISITION EASE": "HIGH",
            "REFRESHABILITY": "HIGH",
            "note": "Giant issued-permit CSV is easy. Contractor registration roster is search-only. Identity IDs missing from permits.",
        },
        "Bexar County": {
            "CONTRACTOR IDENTITY": "LOW",
            "WORK HISTORY": "LOW",
            "PUBLIC CONTACTS": "LOW",
            "BOND/INSURANCE": "LOW",
            "PROPERTY": "MEDIUM",
            "LENDER": "MEDIUM",
            "INSURANCE": "MEDIUM",
            "SENIOR": "LOW",
            "MOVE": "LOW",
            "INVESTOR": "MEDIUM",
            "ACQUISITION EASE": "LOW",
            "REFRESHABILITY": "LOW",
            "note": "CAD bulk not immediately downloadable; PARK rather than PRA-wait.",
        },
        "Houston": {
            "CONTRACTOR IDENTITY": "LOW",
            "WORK HISTORY": "LOW",
            "PUBLIC CONTACTS": "LOW",
            "BOND/INSURANCE": "LOW",
            "PROPERTY": "LOW",
            "LENDER": "LOW",
            "INSURANCE": "LOW",
            "SENIOR": "LOW",
            "MOVE": "LOW",
            "INVESTOR": "LOW",
            "ACQUISITION EASE": "LOW",
            "REFRESHABILITY": "LOW",
            "note": "No row-level building-permit bulk. Trade registration search-only. City != Harris County.",
        },
        "Harris County": {
            "CONTRACTOR IDENTITY": "LOW",
            "WORK HISTORY": "LOW",
            "PUBLIC CONTACTS": "LOW",
            "BOND/INSURANCE": "LOW",
            "PROPERTY": "HIGH",
            "LENDER": "HIGH",
            "INSURANCE": "HIGH",
            "SENIOR": "MEDIUM",
            "MOVE": "LOW",
            "INVESTOR": "HIGH",
            "ACQUISITION EASE": "HIGH" if hcad_acquired else "MEDIUM",
            "REFRESHABILITY": "HIGH",
            "note": "HCAD is the P0 Harris foundation even when Houston permits are search-only.",
        },
    }

    publication = {
        "San Antonio / Contractor": "KEEP_DATA_ONLY",
        "San Antonio / Investor": "KEEP_DATA_ONLY",
        "Bexar / Lender": "PARK",
        "Houston / Contractor": "PARK",
        "Harris / Lender": "KEEP_DATA_ONLY" if hcad_acquired else "KEEP_DATA_ONLY",
        "Harris / Insurance": "KEEP_DATA_ONLY",
        "Harris / Investor": "KEEP_DATA_ONLY",
        "routes_forbidden": [
            "/texas/san-antonio",
            "/texas/bexar",
            "/texas/houston",
            "/texas/harris",
        ],
        "reason": "No local pages in this ticket. San Antonio permits are useful work-history evidence without exact contractor IDs. Houston permit bulk was not proven. HCAD is property foundation, not a contractor roster.",
    }

    report.update(
        {
            "san_antonio": {
                "ckan_searches": sa_searches,
                "datastore": {
                    "permits_issued": sa_permit_issued,
                    "permits_issued_2020_2024": sa_permit_hist,
                    "applications": sa_permit_apps,
                },
                "files": sa_files,
                "issued_profile": issued_profile,
                "applications_profile": apps_profile,
                "contractor_registration": contractor_connect,
                "registration_probes": sa_reg_probes,
                "insurance_bond": insurance_bond,
            },
            "bexar": bexar_cad,
            "houston": {
                "permit_bulk": houston_permit_bulk,
                "contractor_registration": houston_contractor_reg,
            },
            "harris_county": harris_county,
            "hcad": hcad,
            "identity": identity,
            "sources": sources,
            "scorecard": scorecard,
            "publication_decision": publication,
            "skipped": [
                "Dallas",
                "Austin",
                "Fort Worth",
                "other Bexar municipalities",
                "other Harris municipalities",
                "county-clerk deeds",
                "PRA waiting",
                "paid CAD exports",
                "Accela/BuildSA/iPermits scrape",
                "Contractor Connect scrape",
                "confidential sales",
                "owner dossiers",
            ],
        }
    )

    (BUNDLE / "harvest-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    (SA / "source-manifest.json").write_text(
        json.dumps({"ticket": "TX-CON-LOCAL-001B", "geography": "san-antonio-bexar", "sources": sources[:4], "retrieved_at": RETRIEVED}, indent=2)
        + "\n",
        encoding="utf-8",
    )
    (HOU / "source-manifest.json").write_text(
        json.dumps({"ticket": "TX-CON-LOCAL-001B", "geography": "houston-harris", "sources": sources[4:], "retrieved_at": RETRIEVED}, indent=2)
        + "\n",
        encoding="utf-8",
    )
    (ART / "harvest-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    compact = {
        "sa_issued_rows": (issued_profile or {}).get("rows") or sa_permit_issued.get("total"),
        "sa_hist_rows": sa_permit_hist.get("total"),
        "sa_apps_rows": (apps_profile or {}).get("rows") or sa_permit_apps.get("total"),
        "sa_contact_field": (issued_profile or {}).get("contact_field"),
        "sa_distinct_contacts": (issued_profile or {}).get("distinct_contacts"),
        "sa_has_local_id": (issued_profile or {}).get("has_local_registration_id"),
        "sa_registration": contractor_connect["access"],
        "houston_permit_bulk": houston_permit_bulk["result"],
        "hcad_result": hcad["result"],
        "hcad_acquired": len(hcad_acquired),
        "bexar": bexar_cad["result"],
        "publication": publication,
    }
    print(json.dumps(compact, indent=2, default=str)[:15000])


if __name__ == "__main__":
    main()
