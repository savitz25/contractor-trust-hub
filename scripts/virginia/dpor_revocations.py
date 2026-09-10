"""Parse DPOR contractor revocation news-release text files."""
from __future__ import annotations

import re
from collections import defaultdict
from pathlib import Path

BLOCK = re.compile(
    r"^(?P<name>[^\n]+)\n"
    r"(?P<loc>[^\n]+)\n"
    r"(?P<cases>(?:Case No\.\s*[\d-]+\s*\n)+)"
    r"Lic[e]?nse Number\s+(?P<lic>\d+)"
    r"(?:\n(?P<lic2>\d{3,}))?",
    re.I | re.M,
)


def normalize_license(lic: str, lic2: str | None) -> str:
    digits = re.sub(r"\D", "", lic or "")
    extra = re.sub(r"\D", "", lic2 or "")
    if extra and len(digits) < 10:
        digits += extra
    return digits


def parse_revocation_file(path: Path, meeting: str, url: str) -> list[dict]:
    text = path.read_text(encoding="latin-1", errors="replace")
    rows = []
    for m in BLOCK.finditer(text):
        loc = m.group("loc").strip()
        if loc.lower().startswith("case no"):
            continue
        city, st = loc, ""
        if "," in loc:
            city, st = [p.strip() for p in loc.rsplit(",", 1)]
        cases = re.findall(r"Case No\.\s*([\d-]+)", m.group("cases"), re.I)
        lic = normalize_license(m.group("lic"), m.group("lic2"))
        if len(lic) < 8:
            continue
        grain = "contractor_business_license"
        if lic.startswith("2710") or lic.startswith("2709"):
            grain = "tradesman_person"
        elif lic.startswith("2722"):
            grain = "rbea_person"
        elif lic.startswith("2723"):
            grain = "fire_sprinkler_inspector_person"
        for case in cases or [""]:
            rows.append(
                {
                    "meeting_date": meeting,
                    "respondent": m.group("name").strip(),
                    "city": city,
                    "state": st,
                    "case_number": case,
                    "license_number": lic,
                    "identity": f"VA-DPOR:{lic}",
                    "attach": "EXACT_CONTRACTOR_LICENSE",
                    "grain": grain,
                    "source_url": url,
                }
            )
    return rows


def audit_revocations(rows: list[dict]) -> tuple[list[dict], dict]:
    seen = set()
    unique = []
    exact_dupes = 0
    for row in rows:
        key = (
            row["meeting_date"],
            row["case_number"],
            row["license_number"],
            row["respondent"].casefold(),
        )
        if key in seen:
            exact_dupes += 1
            continue
        seen.add(key)
        unique.append(row)

    by_lic: dict[str, list[dict]] = defaultdict(list)
    for row in unique:
        by_lic[row["license_number"]].append(row)
    multi_obs = sorted(lic for lic, items in by_lic.items() if len(items) > 1)
    multi_label = []
    for lic, items in by_lic.items():
        labels = {r["respondent"].casefold() for r in items}
        if len(labels) > 1:
            multi_label.append(
                {
                    "license_number": lic,
                    "respondents": sorted({r["respondent"] for r in items}),
                    "cases": sorted({r["case_number"] for r in items}),
                    "meetings": sorted({r["meeting_date"] for r in items}),
                    "assessment": "SOURCE_NATIVE_LICENSE_SHARED_ACROSS_RESPONDENT_LABELS",
                }
            )
    truncated_rejected = [r for r in rows if False]
    return unique, {
        "source_observation_rows_before_dedupe": len(rows),
        "exact_duplicate_rows_removed": exact_dupes,
        "observation_rows": len(unique),
        "distinct_cases": len({r["case_number"] for r in unique if r["case_number"]}),
        "distinct_licenses": len(by_lic),
        "license_ids_appearing_in_multiple_observations": multi_obs,
        "license_ids_with_multiple_respondent_labels": multi_label,
        "note": "Shared license numbers across different respondents are preserved as source-native observations. They are not collapsed and are not treated as canonical profile attachments.",
    }
