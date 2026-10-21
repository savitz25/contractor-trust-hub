"""Parameterized exact / strong / weak OSHA identity match.

Exact and strong require an identical normalized name. A 0.92 similar name
stays weak. A comma-form person name without a company suffix is capped at weak.
Strong also requires county_name to name a county in the Census crosswalk, and
the OSHA site or mail ZIP to fall in that county. An OSHA row whose site state
differs from the license state is ignored. No license is created for an
unmatched inspection.
"""

from __future__ import annotations

from collections import defaultdict
from difflib import SequenceMatcher

from scripts.osha.crosswalk import Crosswalk
from scripts.osha.normalize import (
    activity_number,
    display_name,
    iso_date,
    is_person_name,
    normalize_name,
    suffix_pattern,
    zip5,
    county_key,
)
from scripts.osha.states import STATES

RANK = {"exact": 3, "strong": 2, "weak": 1}
SIMILARITY = 0.92


def _similar(left: str, right: str) -> bool:
    if left == right:
        return True
    shortest, longest = (left, right) if len(left) <= len(right) else (right, left)
    if len(shortest) < 0.851 * len(longest):
        return False
    matcher = SequenceMatcher(None, left, right)
    if matcher.real_quick_ratio() < SIMILARITY or matcher.quick_ratio() < SIMILARITY:
        return False
    return matcher.ratio() >= SIMILARITY


def _money(value: str) -> float:
    text = (value or "").strip()
    if not text or text.upper() in {"NAN", "NONE", "NULL"}:
        return 0.0
    return float(text)


def _license_counties(license_row: dict, crosswalk: Crosswalk, state: str) -> set[str]:
    """Use county_name only when it is a real county in this state.

    A blank or unrecognized value does not borrow a county from the license ZIP.
    The crosswalk is applied to the OSHA ZIP, not used to fill the roster.
    """
    recorded = county_key(license_row.get("county_name") or "")
    if recorded and recorded in crosswalk.known_counties.get(state, ()):
        return {recorded}
    return set()


def _classify(license_row: dict, inspection: dict, counties: set[str], crosswalk: Crosswalk, state: str) -> str | None:
    if inspection["site_state"] != state:
        return None
    same_name = license_row["norm_name"] == inspection["norm_name"]
    if not same_name:
        if not _similar(license_row["norm_name"], inspection["norm_name"]):
            return None
        return "weak"
    license_zip = license_row["zip"]
    if license_zip and license_zip in (inspection["site_zip"], inspection["mail_zip"]):
        return "exact"
    osha_counties = set()
    osha_counties.update(crosswalk.counties_for(state, inspection["site_zip"]))
    osha_counties.update(crosswalk.counties_for(state, inspection["mail_zip"]))
    if counties and osha_counties.intersection(counties):
        return "strong"
    return "weak"


def _prepare_licenses(rows: list[dict], state: str) -> list[dict]:
    spec = STATES[state]
    suffix_re = suffix_pattern(spec["name_tokens"])
    prepared = []
    for row in rows:
        if (row.get("source_system") or "") != spec["source_system"]:
            continue
        shown = display_name(row.get("dba_name_raw") or "", row.get("licensee_name_raw") or "")
        norm = normalize_name(shown, suffix_re)
        if len(norm) < 4:
            continue
        prepared.append(
            {
                "license_key": (row.get("external_key") or "").strip(),
                "source_system": spec["source_system"],
                "mailing_state": (row.get("state") or "").strip().upper(),
                "display_name": shown,
                "norm_name": norm,
                "zip": zip5(row.get("postal_code") or ""),
                "county_name": (row.get("county_name") or "").strip(),
                "person": is_person_name(shown, suffix_re),
            }
        )
    return prepared


def _prepare_inspections(rows: list[dict], state: str, suffix_re) -> tuple[list[dict], int]:
    by_activity: dict[str, dict] = {}
    duplicates = 0
    for row in rows:
        site_state = (row.get("site_state") or row.get("SITE_STATE") or "").strip().upper()
        if site_state != state:
            continue
        activity = activity_number(row.get("activity_nr") or row.get("ACTIVITY_NR") or "")
        if not activity:
            continue
        name = normalize_name(row.get("estab_name") or row.get("ESTAB_NAME") or "", suffix_re)
        if len(name) < 4:
            continue
        prepared = {
            "activity_nr": activity,
            "norm_name": name,
            "site_zip": zip5(row.get("site_zip") or row.get("SITE_ZIP") or ""),
            "mail_zip": zip5(row.get("mail_zip") or row.get("MAIL_ZIP") or ""),
            "site_state": site_state,
            "open_date": iso_date(row.get("open_date") or row.get("OPEN_DATE") or ""),
            "raw_open": row.get("open_date") or row.get("OPEN_DATE") or "",
        }
        if activity in by_activity:
            duplicates += 1
            continue
        by_activity[activity] = prepared
    return list(by_activity.values()), duplicates


def _violation_index(rows: list[dict]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        if (row.get("delete_flag") or row.get("DELETE_FLAG") or "").strip().upper() == "X":
            continue
        activity = activity_number(row.get("activity_nr") or row.get("ACTIVITY_NR") or "")
        if not activity:
            continue
        grouped[activity].append(row)
    return grouped


def match_state(
    state: str,
    licenses: list[dict],
    inspections: list[dict],
    violations: list[dict],
    crosswalk: Crosswalk,
) -> dict:
    if state not in STATES:
        raise KeyError(state)
    spec = STATES[state]
    suffix_re = suffix_pattern(spec["name_tokens"])
    prepared_licenses = _prepare_licenses(licenses, state)
    prepared_inspections, duplicate_inspections = _prepare_inspections(inspections, state, suffix_re)
    violations_by_activity = _violation_index(violations)
    by_name: dict[str, list[dict]] = defaultdict(list)
    unique_names_by_prefix: dict[str, list[str]] = defaultdict(list)
    seen_names: set[tuple[str, str]] = set()
    by_activity = {inspection["activity_nr"]: inspection for inspection in prepared_inspections}
    for inspection in prepared_inspections:
        by_name[inspection["norm_name"]].append(inspection)
        prefix = inspection["norm_name"][:4]
        marker = (prefix, inspection["norm_name"])
        if marker not in seen_names:
            seen_names.add(marker)
            unique_names_by_prefix[prefix].append(inspection["norm_name"])
    licenses_by_name: dict[str, list[dict]] = defaultdict(list)
    for license_row in prepared_licenses:
        licenses_by_name[license_row["norm_name"]].append(license_row)

    matches = []
    unparsed_dates = 0
    checked_names = 0
    name_total = len(licenses_by_name)
    for norm_name, group in licenses_by_name.items():
        checked_names += 1
        if checked_names % 5000 == 0:
            print("PROGRESS", state, checked_names, name_total, flush=True)
        fuzzy_rows = []
        for other_name in unique_names_by_prefix.get(norm_name[:4], ()):
            if other_name != norm_name and _similar(norm_name, other_name):
                fuzzy_rows.extend(by_name[other_name])
        same_rows = by_name.get(norm_name, ())
        for license_row in group:
            counties = _license_counties(license_row, crosswalk, state)
            hits: dict[str, str] = {}
            for inspection in same_rows:
                tier = _classify(license_row, inspection, counties, crosswalk, state)
                if tier:
                    hits[inspection["activity_nr"]] = tier
            for inspection in fuzzy_rows:
                if inspection["activity_nr"] not in hits:
                    hits[inspection["activity_nr"]] = "weak"
            if license_row["person"]:
                hits = {activity: "weak" for activity in hits}
            if not hits:
                continue
            best = max(hits.values(), key=RANK.get)
            kept_ids = sorted((activity for activity, tier in hits.items() if tier == best), key=int)
            kept = [by_activity[activity] for activity in kept_ids]
            citation_rows = [row for activity in kept_ids for row in violations_by_activity.get(activity, ())]
            dates = []
            for inspection in kept:
                if inspection["open_date"]:
                    dates.append(inspection["open_date"])
                elif (inspection["raw_open"] or "").strip():
                    unparsed_dates += 1
            dates.sort()
            current = round(sum(_money(row.get("current_penalty") or row.get("CURRENT_PENALTY") or "") for row in citation_rows))
            initial = round(sum(_money(row.get("initial_penalty") or row.get("INITIAL_PENALTY") or "") for row in citation_rows))
            matches.append(
                {
                    "state": state,
                    "source_system": spec["source_system"],
                    "license_key": license_row["license_key"],
                    "mailing_state": license_row["mailing_state"],
                    "display_name": license_row["display_name"],
                    "norm_name": license_row["norm_name"],
                    "postal_code": license_row["zip"],
                    "county_name": license_row["county_name"],
                    "person_name_licensee": "yes" if license_row["person"] else "no",
                    "match_tier": best,
                    "n_inspections": len(kept),
                    "osha_activity_nrs": ";".join(kept_ids),
                    "first_open": dates[0] if dates else "",
                    "last_open": dates[-1] if dates else "",
                    "n_citation_items": len(citation_rows),
                    "n_serious": sum((row.get("viol_type") or row.get("VIOL_TYPE") or "").strip().upper() == "S" for row in citation_rows),
                    "n_willful_repeat": sum((row.get("viol_type") or row.get("VIOL_TYPE") or "").strip().upper() in {"W", "R"} for row in citation_rows),
                    "current_penalty_amount": current,
                    "initial_penalty_amount": initial,
                    "n_with_final_order": sum(bool(iso_date(row.get("final_order_date") or row.get("FINAL_ORDER_DATE") or "")) for row in citation_rows),
                    "n_contested": sum(bool(iso_date(row.get("contest_date") or row.get("CONTEST_DATE") or "")) for row in citation_rows),
                }
            )
    matches.sort(key=lambda row: (row["license_key"], row["match_tier"]))
    return {
        "state": state,
        "source_system": spec["source_system"],
        "licenses_considered": len(prepared_licenses),
        "inspections_in_state": len(prepared_inspections),
        "duplicate_inspection_rows": duplicate_inspections,
        "unparsed_open_dates": unparsed_dates,
        "matches": matches,
    }
