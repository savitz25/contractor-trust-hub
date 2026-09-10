"""Reparse acquired DPOR raw files with the hardened TSV parser. No new bulk download."""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "virginia"))
from dpor_revocations import audit_revocations, parse_revocation_file  # noqa: E402
from dpor_tsv import license_number, parse_tsv, profile_rows, specialties  # noqa: E402

RAW = ROOT / "data" / "raw" / "virginia"
STAGE = ROOT / "data" / "virginia" / "va-con-001"

CLASS_FILES = [
    ("2705a_class_a.txt", "contractor_business_class_a", "A"),
    ("2705b_class_b.txt", "contractor_business_class_b", "B"),
    ("2705c_class_c.txt", "contractor_business_class_c", "C"),
    ("2701_class_a_legacy.txt", "contractor_business_class_a_legacy_file", "A"),
]
OTHER_FILES = [
    ("2703_temporary.txt", "temporary_contractor_business", None),
    ("2710_tradesman_person.txt", "tradesman_person", None),
    ("2709_residential_tradesman.txt", "residential_tradesman_person", None),
    ("2707_rbea_firm.txt", "rbea_firm", None),
    ("2722_rbea_person.txt", "rbea_person", None),
]

REV_META = {
    "2026-08-25": "https://www.dpor.virginia.gov/sites/default/files/News/Contractors%20license%20revocation%20August%2025.txt",
    "2026-06-23": "https://www.dpor.virginia.gov/sites/default/files/boards/Contractors/license%20revocation%20June%2023.txt",
    "2026-04-28": "https://www.dpor.virginia.gov/sites/default/files/News/4.28.26%20Contractor%20Revocation%20List.txt",
    "2026-02-24": "https://www.dpor.virginia.gov/sites/default/files/News/2.24.26%20license%20revocation%20list.txt",
    "2025-12-09": "https://www.dpor.virginia.gov/sites/default/files/News/12.9.2025%20license%20revocation%20list.txt",
    "2025-10-07": "https://www.dpor.virginia.gov/sites/default/files/News/10.7.2025%20license%20revocation%20list.txt",
    "2025-08-19": "https://www.dpor.virginia.gov/sites/default/files/News/08.19.25%20license%20revocation%20template%20for%20website.txt",
    "2025-06-24": "https://www.dpor.virginia.gov/sites/default/files/News/06.24.25%20license%20revocation%20template%20for%20website.txt",
    "2025-04-29": "https://www.dpor.virginia.gov/sites/default/files/News/Revocated%20Licenses%20-%204.29.25%20BFC%20Mtg.txt",
    "2025-03-11": "https://www.dpor.virginia.gov/sites/default/files/News/Revocated%20Licenses%20-%203.11.25d%20BFC%20Mtg.txt",
    "2025-03-11-addtl": "https://www.dpor.virginia.gov/sites/default/files/2025-07/Revocated%20Licenses%20-%203.11.25%20addtl%20BFC%20Mtg.txt",
}

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}


def http_date_iso(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return parsedate_to_datetime(value).date().isoformat()
    except (TypeError, ValueError, IndexError):
        return None


def parse_updated_label(html: str) -> dict[str, str | None]:
    text = html.replace("\xa0", " ").replace("&nbsp;", " ")
    m = re.search(
        r"Updated:\s*([A-Za-z]+,\s*([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4}))",
        text,
        re.I,
    )
    if not m:
        return {"source_text": None, "iso": None}
    source_text = re.sub(r"\s+", " ", m.group(1)).strip()
    month = MONTHS.get(m.group(2).lower())
    day = int(m.group(3))
    year = int(m.group(4))
    iso = f"{year:04d}-{month:02d}-{day:02d}" if month else None
    return {"source_text": source_text, "iso": iso}


def main() -> None:
    prev = json.loads((STAGE / "acquire-report.json").read_text(encoding="utf-8"))
    html_path = RAW / "regulant_lists_page.html"
    if not html_path.exists():
        html_path = RAW / "regulant_lists_page.bin"
    html = html_path.read_text(encoding="utf-8", errors="replace") if html_path.exists() else ""
    updated = parse_updated_label(html)

    profiles = {}
    sets: dict[str, set[str]] = {"2705a": set(), "2705b": set(), "2705c": set(), "2701": set(), "2701_rank_a": set()}
    identity_index = []
    for fname, grain, expected in CLASS_FILES + OTHER_FILES:
        path = RAW / fname
        rows = parse_tsv(path.read_text(encoding="latin-1", errors="replace"), expected_rank=expected)
        prof = profile_rows(rows, grain)
        profiles[fname] = prof
        key = fname.split("_")[0]
        for r in rows:
            lic = license_number(r)
            if fname.startswith("2705a"):
                sets["2705a"].add(lic)
            elif fname.startswith("2705b"):
                sets["2705b"].add(lic)
            elif fname.startswith("2705c"):
                sets["2705c"].add(lic)
            elif fname.startswith("2701"):
                sets["2701"].add(lic)
                if r.get("LICENSE RANK") == "A":
                    sets["2701_rank_a"].add(lic)
            if fname.startswith(("2705a", "2705b", "2705c", "2701")):
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
                        "file": fname,
                        "parse_status": r.get("parse_status"),
                    }
                )

    a, b, c, legacy = sets["2705a"], sets["2705b"], sets["2705c"], sets["2701"]
    class_a_union = a | legacy
    abc_union = class_a_union | b | c

    rev_rows = []
    for meeting, url in REV_META.items():
        path = RAW / f"revocation_{meeting}.txt"
        if path.exists():
            rev_rows.extend(parse_revocation_file(path, meeting, url))
    unique_rev, rev_audit = audit_revocations(rev_rows)
    rev_licenses = {r["license_number"] for r in unique_rev}
    roster_matches = sorted(rev_licenses & abc_union)
    not_in_roster = sorted(rev_licenses - abc_union)

    compact = []
    seen = set()
    for row in identity_index:
        if row["license"] in seen:
            continue
        seen.add(row["license"])
        compact.append(row)
    (STAGE / "identity-index.json").write_text(json.dumps(compact), encoding="utf-8")
    (STAGE / "revocation-observations.json").write_text(json.dumps(unique_rev, indent=2) + "\n", encoding="utf-8")

    file_lm = http_date_iso(prev.get("downloads", {}).get("2705a_class_a", {}).get("last_modified"))
    prev["regulant_lists_source_as_of_label"] = updated["source_text"]
    prev["regulant_lists_source_as_of_iso"] = updated["iso"]
    prev["regulant_lists_html_path"] = str(html_path.relative_to(ROOT)) if html_path.exists() else None
    prev["regulant_lists_file_last_modified"] = file_lm
    prev["profiles"] = profiles
    prev["parser"] = {
        "root_cause": "A minority of official TSV rows contain an extra tab inside BUSINESS NAME, producing 21 columns and shifting CITY/STATE/ZIP/dates/rank/specialty. License-number fields are unshifted.",
        "repair": "Merge the split business-name fields and realign remaining columns. Do not overwrite rank from the filename.",
        "2705a": profiles["2705a_class_a.txt"]["parse_audit"],
        "2705b": profiles["2705b_class_b.txt"]["parse_audit"],
        "2705c": profiles["2705c_class_c.txt"]["parse_audit"],
        "2701": profiles["2701_class_a_legacy.txt"]["parse_audit"],
    }
    prev["business_roster"] = {
        "file_2705a_distinct": len(a),
        "file_2701_distinct": len(legacy),
        "file_2705a_intersect_2701": len(a & legacy),
        "class_a_union": len(class_a_union),
        "class_a_union_method": "set union of 2705A licenses and 2701 licenses (DPOR labels both files Class A Contractor)",
        "class_b_distinct": len(b),
        "class_c_distinct": len(c),
        "overlap_ab": len(class_a_union & b),
        "overlap_ac": len(class_a_union & c),
        "overlap_bc": len(b & c),
        "distinct_class_abc_licenses": len(abc_union),
        "class_a_plus_b_plus_c_if_summed": len(class_a_union) + len(b) + len(c),
        "classes_are_disjoint": len(class_a_union & b) == 0 and len(class_a_union & c) == 0 and len(b & c) == 0,
        "2701_source_native_rank_a": len(sets["2701_rank_a"]),
        "2701_source_native_rank_not_a": len(legacy) - len(sets["2701_rank_a"]),
        "temporary_not_added_to_abc": True,
        "tradesman_not_added": True,
        "class_a_distinct": len(class_a_union),
        "class_a_2705a_rows": profiles["2705a_class_a.txt"]["rows"],
        "class_a_2701_legacy_rows": profiles["2701_class_a_legacy.txt"]["rows"],
        "class_b_rows": profiles["2705b_class_b.txt"]["rows"],
        "class_c_rows": profiles["2705c_class_c.txt"]["rows"],
        "duplicate_license_rows_2705a": profiles["2705a_class_a.txt"]["duplicate_license_rows"],
        "duplicate_license_rows_2705b": profiles["2705b_class_b.txt"]["duplicate_license_rows"],
        "duplicate_license_rows_2705c": profiles["2705c_class_c.txt"]["duplicate_license_rows"],
        "class_a_rows_with_multiple_specialties": profiles["2705a_class_a.txt"]["rows_with_multiple_specialties"],
        "one_row_one_license": True,
        "multiple_specialties_may_appear_on_one_license": True,
        "do_not_sum_specialty_tokens_as_contractors": True,
        "temporary_rows": profiles["2703_temporary.txt"]["rows"],
        "sha256": {
            "2705a": prev["downloads"]["2705a_class_a"]["sha256"],
            "2705b": prev["downloads"]["2705b_class_b"]["sha256"],
            "2705c": prev["downloads"]["2705c_class_c"]["sha256"],
            "2701": prev["downloads"]["2701_class_a_legacy"]["sha256"],
        },
        "status": "ACQUIRED",
        "source": "https://www.dpor.virginia.gov/node/10230",
        "refresh_cadence": "Updated to the website every 5 business days (usually Mondays)",
    }
    prev["revocation_audit"] = rev_audit
    prev["revocation_roster_crosswalk"] = {
        "REVOCATION_DISTINCT_LICENSES": len(rev_licenses),
        "CURRENT_ROSTER_EXACT_MATCHES": len(roster_matches),
        "NOT_IN_CURRENT_ROSTER": len(not_in_roster),
        "not_in_current_roster_ids": not_in_roster,
        "absence_from_current_roster_ne_bad_identity": True,
        "do_not_infer_current_status_from_historical_revocation": True,
    }
    prev["identity_index_rows"] = len(compact)
    prev["reparsed_at"] = datetime.now(timezone.utc).isoformat()
    (STAGE / "acquire-report.json").write_text(json.dumps(prev, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "updated": updated,
        "file_last_modified": file_lm,
        "parser": prev["parser"],
        "roster": {
            "2705a": len(a),
            "2701": len(legacy),
            "overlap": len(a & legacy),
            "class_a_union": len(class_a_union),
            "b": len(b),
            "c": len(c),
            "abc": len(abc_union),
            "ab": len(class_a_union & b),
            "ac": len(class_a_union & c),
            "bc": len(b & c),
            "2701_not_a": len(legacy) - len(sets["2701_rank_a"]),
        },
        "revocation_audit": rev_audit,
        "crosswalk": prev["revocation_roster_crosswalk"],
        "2705a_specialties_multi": profiles["2705a_class_a.txt"]["rows_with_multiple_specialties"],
        "2705a_rank_counts": profiles["2705a_class_a.txt"]["rank_counts"],
    }, indent=2))


if __name__ == "__main__":
    main()
