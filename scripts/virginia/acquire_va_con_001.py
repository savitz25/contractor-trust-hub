"""VA-CON-001A: acquire official DPOR contractor sources. No License Lookup scrape."""
from __future__ import annotations

import hashlib
import json
import re
import ssl
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "virginia"
STAGE = ROOT / "data" / "virginia" / "va-con-001"
UA = "ContractorTrustHub/VA-CON-001 research acquisition (official public files)"
BASE = "https://www.dpor.virginia.gov"
LISTS = "https://www.dpor.virginia.gov/sites/default/files/Records%20and%20Documents/Regulant%20List"
NEWS = "https://www.dpor.virginia.gov/sites/default/files"

FILES = {
    "2701_class_a_legacy": f"{LISTS}/2701__crnt.txt",
    "2705a_class_a": f"{LISTS}/2705a__crnt.txt",
    "2705b_class_b": f"{LISTS}/2705b__crnt.txt",
    "2705c_class_c": f"{LISTS}/2705c__crnt.txt",
    "2703_temporary": f"{LISTS}/2703__crnt.txt",
    "2710_tradesman_person": f"{LISTS}/2710__crnt.txt",
    "2709_residential_tradesman": f"{LISTS}/2709__crnt.txt",
    "2707_rbea_firm": f"{LISTS}/2707__crnt.txt",
    "2722_rbea_person": f"{LISTS}/2722__crnt.txt",
    "classifications_pdf": f"{LISTS}/VA%20Contractors%20Classifications%20%26%20Specialties.pdf",
    "tradesman_designations_pdf": f"{LISTS}/tradesman%20designations.pdf",
    "population_pdf": "https://www.dpor.virginia.gov/sites/default/files/Records%20and%20Documents/reg_pop.pdf",
    "regulant_lists_page": "https://www.dpor.virginia.gov/node/10230",
    "board_page": "https://www.dpor.virginia.gov/Boards/Contractors",
    "lookup_page": "https://www.dpor.virginia.gov/LicenseLookup",
    "complaint_page": "https://www.dpor.virginia.gov/Report-Licensee/",
    "recovery_fund_page": "https://www.dpor.virginia.gov/Boards/Contractors_Recovery_Fund/",
    "news_releases_page": "https://www.dpor.virginia.gov/NewsReleases",
    "town_hall_meetings": "https://townhall.virginia.gov/L/Meetings.cfm?BoardID=10",
    "regs_18vac50_22": "https://law.lis.virginia.gov/admincode/title18/agency50/chapter22/",
}

REVOCATIONS_2026 = {
    "2026-08-25": f"{NEWS}/News/Contractors%20license%20revocation%20August%2025.txt",
    "2026-06-23": f"{NEWS}/boards/Contractors/license%20revocation%20June%2023.txt",
    "2026-04-28": f"{NEWS}/News/4.28.26%20Contractor%20Revocation%20List.txt",
    "2026-02-24": f"{NEWS}/News/2.24.26%20license%20revocation%20list.txt",
}

REVOCATIONS_2025 = {
    "2025-12-09": f"{NEWS}/News/12.9.2025%20license%20revocation%20list.txt",
    "2025-10-07": f"{NEWS}/News/10.7.2025%20license%20revocation%20list.txt",
    "2025-08-19": f"{NEWS}/News/08.19.25%20license%20revocation%20template%20for%20website.txt",
    "2025-06-24": f"{NEWS}/News/06.24.25%20license%20revocation%20template%20for%20website.txt",
    "2025-04-29": f"{NEWS}/News/Revocated%20Licenses%20-%204.29.25%20BFC%20Mtg.txt",
    "2025-03-11-addtl": f"{NEWS}/2025-07/Revocated%20Licenses%20-%203.11.25%20addtl%20BFC%20Mtg.txt",
    "2025-03-11": f"{NEWS}/News/Revocated%20Licenses%20-%203.11.25d%20BFC%20Mtg.txt",
}

CTX = ssl.create_default_context()


def fetch(url: str) -> tuple[bytes, int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=90) as resp:
            data = resp.read()
            return data, resp.status, resp.headers.get("Last-Modified") or ""
    except Exception as exc:  # noqa: BLE001
        return b"", 0, str(exc)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def parse_tsv(text: str) -> list[dict]:
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not lines:
        return []
    header = lines[0].split("\t")
    # Some files have no header and start with board code "27"
    has_header = any(tok.upper() in {"BOARD", "OCCUPATION", "CERTIFICATE #", "BUSINESS NAME"} for tok in header)
    rows = []
    start = 1 if has_header else 0
    for ln in lines[start:]:
        parts = ln.split("\t")
        if len(parts) < 10:
            continue
        if has_header:
            rec = {header[i].strip(): (parts[i].strip() if i < len(parts) else "") for i in range(len(header))}
        else:
            rec = {
                "BOARD": parts[0].strip(),
                "OCCUPATION": parts[1].strip(),
                "CERTIFICATE #": parts[2].strip(),
                "INDIVIDUAL NAME": parts[3].strip() if len(parts) > 3 else "",
                "BUSINESS NAME": parts[4].strip() if len(parts) > 4 else "",
                "FIRST LINE ADDRESS": parts[5].strip() if len(parts) > 5 else "",
                "SECOND LINE ADDRESS": parts[6].strip() if len(parts) > 6 else "",
                "P O BOX #": parts[7].strip() if len(parts) > 7 else "",
                "CITY": parts[8].strip() if len(parts) > 8 else "",
                "STATE": parts[9].strip() if len(parts) > 9 else "",
                "FIVE DIGIT ZIP CODE": parts[10].strip() if len(parts) > 10 else "",
                "EXPIRATION DATE": parts[15].strip() if len(parts) > 15 else "",
                "CERTIFICATION DATE": parts[16].strip() if len(parts) > 16 else "",
                "LICENSE RANK": parts[17].strip() if len(parts) > 17 else "",
                "LICENSE SPECIALTY": parts[18].strip() if len(parts) > 18 else "",
            }
        rows.append(rec)
    return rows


def license_number(rec: dict) -> str:
    board = rec.get("BOARD", "").zfill(2)
    occ = rec.get("OCCUPATION", "").zfill(2)
    cert = rec.get("CERTIFICATE #", "").zfill(6)
    return f"{board}{occ}{cert}"


def specialties(rec: dict) -> list[str]:
    raw = rec.get("LICENSE SPECIALTY", "") or rec.get("LICENSE SPECIALTY ", "")
    return [p for p in re.split(r"\s+", raw.strip()) if p]


def profile_file(key: str, rows: list[dict], grain: str) -> dict:
    licenses = [license_number(r) for r in rows]
    ranks = Counter((r.get("LICENSE RANK") or "").strip() or "UNKNOWN" for r in rows)
    spec_rows = 0
    spec_counts: Counter[str] = Counter()
    multi = 0
    for r in rows:
        specs = specialties(r)
        if specs:
            spec_rows += 1
            spec_counts.update(specs)
            if len(specs) > 1:
                multi += 1
    names = [(r.get("BUSINESS NAME") or r.get("INDIVIDUAL NAME") or "").strip() for r in rows]
    return {
        "grain": grain,
        "rows": len(rows),
        "distinct_license_numbers": len(set(licenses)),
        "duplicate_license_rows": len(licenses) - len(set(licenses)),
        "rank_counts": dict(ranks),
        "rows_with_specialty": spec_rows,
        "rows_with_multiple_specialties": multi,
        "top_specialties": spec_counts.most_common(25),
        "blank_business_name": sum(1 for n in names if not n),
        "row_ne_unique_business": True,
        "specialty_row_ne_unique_contractor": True,
    }


LICENSE_RE = re.compile(r"\b(27[\s\-]?0[135][\s\-]?\d{5,7})\b", re.I)
CASE_RE = re.compile(r"\b(?:File|Case|Docket)\s*(?:No\.?|Number|#)?\s*[:#]?\s*([A-Z0-9\-]{5,})\b", re.I)


def parse_revocation_text(text: str, meeting: str, url: str) -> list[dict]:
    observations = []
    # Split on blank-line blocks when possible
    blocks = re.split(r"\n\s*\n", text)
    if len(blocks) < 3:
        blocks = text.splitlines()
    for block in blocks:
        chunk = " ".join(block.split())
        if len(chunk) < 20:
            continue
        licenses = [re.sub(r"[\s\-]", "", m) for m in LICENSE_RE.findall(chunk)]
        cases = CASE_RE.findall(chunk)
        if not licenses and "license" not in chunk.lower() and "contractor" not in chunk.lower():
            continue
        if not licenses and not re.search(r"LLC|INC|CORP|COMPANY|CO\b", chunk, re.I):
            # skip headers
            if chunk.lower().startswith(("the board", "richmond", "media", "contact", "for immediate")):
                continue
        observations.append(
            {
                "meeting_date": meeting,
                "source_url": url,
                "licenses": licenses,
                "cases": cases,
                "excerpt": chunk[:400],
                "has_exact_license": bool(licenses),
                "identity": "EXACT_LICENSE" if licenses else "UNSAFE_NAME_ONLY",
            }
        )
    return observations


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    STAGE.mkdir(parents=True, exist_ok=True)
    retrieved = datetime.now(timezone.utc).isoformat()
    downloads = {}
    for key, url in FILES.items():
        data, status, last_mod = fetch(url)
        path = RAW / f"{key}{Path(url.split('?')[0]).suffix or '.bin'}"
        if data:
            path.write_bytes(data)
        downloads[key] = {
            "url": url,
            "http_status": status,
            "bytes": len(data),
            "sha256": sha256(data) if data else None,
            "last_modified": last_mod,
            "path": str(path.relative_to(ROOT)) if data else None,
        }
        print(key, status, len(data), last_mod[:40] if last_mod else "")

    list_html = (RAW / "regulant_lists_page.html").read_text(encoding="utf-8", errors="replace") if (RAW / "regulant_lists_page.html").exists() else ""
    m = re.search(r"Updated:\s*([A-Za-z]+,\s*[A-Za-z]+\s+\d{1,2},?\s*\d{4})", list_html)
    lists_source_as_of = m.group(1) if m else None

    profiles = {}
    all_business_licenses: set[str] = set()
    class_a_licenses: set[str] = set()
    class_b_licenses: set[str] = set()
    class_c_licenses: set[str] = set()
    identity_index = []

    for key, grain, dest in [
        ("2705a_class_a.txt", "contractor_business_class_a", class_a_licenses),
        ("2705b_class_b.txt", "contractor_business_class_b", class_b_licenses),
        ("2705c_class_c.txt", "contractor_business_class_c", class_c_licenses),
        ("2701_class_a_legacy.txt", "contractor_business_class_a_legacy_file", class_a_licenses),
        ("2703_temporary.txt", "temporary_contractor_business", None),
        ("2710_tradesman_person.txt", "tradesman_person", None),
        ("2709_residential_tradesman.txt", "residential_tradesman_person", None),
        ("2707_rbea_firm.txt", "rbea_firm", None),
        ("2722_rbea_person.txt", "rbea_person", None),
    ]:
        path = RAW / key
        if not path.exists() or path.stat().st_size == 0:
            profiles[key] = {"acquired": False, "grain": grain}
            continue
        rows = parse_tsv(path.read_text(encoding="latin-1", errors="replace"))
        prof = profile_file(key, rows, grain)
        prof["acquired"] = True
        profiles[key] = prof
        if dest is not None:
            for r in rows:
                lic = license_number(r)
                dest.add(lic)
                all_business_licenses.add(lic)
                if grain.startswith("contractor_business_class_"):
                    identity_index.append(
                        {
                            "license": lic,
                            "class": r.get("LICENSE RANK") or "",
                            "name": (r.get("BUSINESS NAME") or "").strip(),
                            "city": (r.get("CITY") or "").strip(),
                            "state": (r.get("STATE") or "").strip(),
                            "zip": (r.get("FIVE DIGIT ZIP CODE") or "").strip(),
                            "specialties": specialties(r),
                            "expires": r.get("EXPIRATION DATE") or "",
                            "file": key,
                        }
                    )
        elif grain == "temporary_contractor_business":
            for r in rows:
                all_business_licenses.add(license_number(r))

    rev_obs = []
    rev_files = {}
    for meeting, url in {**REVOCATIONS_2026, **REVOCATIONS_2025}.items():
        data, status, last_mod = fetch(url)
        fname = f"revocation_{meeting}.txt"
        if data:
            (RAW / fname).write_bytes(data)
        rev_files[meeting] = {
            "url": url,
            "http_status": status,
            "bytes": len(data),
            "sha256": sha256(data) if data else None,
            "year": meeting[:4],
        }
        print("revocation", meeting, status, len(data))
        if data and status == 200:
            text = data.decode("latin-1", errors="replace")
            rev_obs.extend(parse_revocation_text(text, meeting, url))

    exact = [o for o in rev_obs if o["has_exact_license"]]
    unsafe = [o for o in rev_obs if not o["has_exact_license"]]
    licenses_found = sorted({lic for o in exact for lic in o["licenses"]})
    cases_found = sorted({c for o in rev_obs for c in o["cases"]})

    compact_index = []
    seen = set()
    for row in identity_index:
        if row["license"] in seen:
            continue
        seen.add(row["license"])
        compact_index.append(row)

    (STAGE / "identity-index.json").write_text(json.dumps(compact_index), encoding="utf-8")
    report = {
        "ticket": "VA-CON-001A",
        "retrieved_at": retrieved,
        "regulant_lists_source_as_of_label": lists_source_as_of,
        "regulant_lists_updated_page": "https://www.dpor.virginia.gov/node/10230",
        "downloads": downloads,
        "profiles": profiles,
        "business_roster": {
            "class_a_distinct": len(class_a_licenses),
            "class_b_distinct": len(class_b_licenses),
            "class_c_distinct": len(class_c_licenses),
            "class_a_plus_b_plus_c_if_summed": len(class_a_licenses) + len(class_b_licenses) + len(class_c_licenses),
            "distinct_class_abc_licenses": len(class_a_licenses | class_b_licenses | class_c_licenses),
            "overlap_ab": len(class_a_licenses & class_b_licenses),
            "overlap_ac": len(class_a_licenses & class_c_licenses),
            "overlap_bc": len(class_b_licenses & class_c_licenses),
            "temporary_not_added_to_abc": True,
            "tradesman_not_added": True,
        },
        "identity_index_rows": len(compact_index),
        "revocations": {
            "files": rev_files,
            "observation_blocks": len(rev_obs),
            "exact_license_observations": len(exact),
            "unsafe_name_only_blocks": len(unsafe),
            "distinct_licenses": len(licenses_found),
            "distinct_cases": len(cases_found),
            "coverage": "DPOR contractor revocation news releases, not all Board discipline",
            "subset_of_all_discipline": True,
        },
        "no_license_lookup_scrape": True,
    }
    (STAGE / "acquire-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("wrote", STAGE / "acquire-report.json")
    print("ABC distinct", report["business_roster"])
    print("revocations exact", len(exact), "unsafe", len(unsafe), "licenses", len(licenses_found))


if __name__ == "__main__":
    main()
