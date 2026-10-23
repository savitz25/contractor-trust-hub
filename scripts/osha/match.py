"""Parameterized exact / strong / weak OSHA identity match.

Exact and strong require an identical normalized name. A similar but unequal
name is not a match. A comma-form person name without a company suffix is
capped at weak. Strong compares the Census county of the OSHA ZIP with the
stored license county_name. A blank or unrecognized county does not become
strong, and the license ZIP is not used to invent one. Each license keeps
only the activities at its single best tier. An OSHA row whose site state
differs from the license state is ignored. No license is created for an
unmatched inspection.
"""

from __future__ import annotations

from collections import defaultdict

from scripts.osha.crosswalk import Crosswalk
from scripts.osha.normalize import (
    SUFFIX_RE,
    activity_number,
    county_key,
    display_name,
    iso_date,
    is_person_name,
    normalize_name,
    zip5,
)
from scripts.osha.states import STATES

RANK = {"exact": 3, "strong": 2, "weak": 1}
PUBLIC_TIERS = frozenset({"exact", "strong"})
FUZZY_MATCHING = False
LICENSE_ZIP_CAN_INFER_COUNTY = False
BEST_TIER_ONLY = True


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
    if license_row["norm_name"] != inspection["norm_name"]:
        return None
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
    prepared = []
    for row in rows:
        if (row.get("source_system") or "") != spec["source_system"]:
            continue
        shown = display_name(
            row.get("dba_name_raw") or "",
            row.get("licensee_name_raw") or "",
            spec["source_system"],
        )
        norm = normalize_name(shown, SUFFIX_RE)
        if len(norm) < 4:
            continue
        prepared.append(
            {
                "license_key": (row.get("external_key") or "").strip(),
                "contractor_id": (row.get("contractor_id") or "").strip(),
                "slug": (row.get("slug") or "").strip(),
                "source_system": spec["source_system"],
                "mailing_state": (row.get("state") or "").strip().upper(),
                "display_name": shown,
                "norm_name": norm,
                "zip": zip5(row.get("postal_code") or ""),
                "county_name": (row.get("county_name") or "").strip(),
                "person": is_person_name(shown, SUFFIX_RE),
            }
        )
    return prepared


def _prepare_inspections(rows: list[dict], state: str) -> tuple[list[dict], int]:
    by_activity: dict[str, dict] = {}
    duplicates = 0
    for row in rows:
        site_state = (row.get("site_state") or row.get("SITE_STATE") or "").strip().upper()
        if site_state != state:
            continue
        activity = activity_number(row.get("activity_nr") or row.get("ACTIVITY_NR") or "")
        if not activity:
            continue
        name = normalize_name(row.get("estab_name") or row.get("ESTAB_NAME") or "", SUFFIX_RE)
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


def distinct_public_activities(matches: list[dict]) -> set[str]:
    """Distinct ACTIVITY_NR values on exact and strong rows."""
    found: set[str] = set()
    for row in matches:
        if row.get("match_tier") not in PUBLIC_TIERS:
            continue
        for activity in str(row.get("osha_activity_nrs") or "").split(";"):
            if activity:
                found.add(activity)
    return found


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
    prepared_licenses = _prepare_licenses(licenses, state)
    prepared_inspections, duplicate_inspections = _prepare_inspections(inspections, state)
    violations_by_activity = _violation_index(violations)
    by_name: dict[str, list[dict]] = defaultdict(list)
    by_activity = {inspection["activity_nr"]: inspection for inspection in prepared_inspections}
    for inspection in prepared_inspections:
        by_name[inspection["norm_name"]].append(inspection)
    licenses_by_name: dict[str, list[dict]] = defaultdict(list)
    for license_row in prepared_licenses:
        licenses_by_name[license_row["norm_name"]].append(license_row)

    matches = []
    checked_names = 0
    name_total = len(licenses_by_name)
    for norm_name, group in licenses_by_name.items():
        checked_names += 1
        if checked_names % 5000 == 0:
            print("PROGRESS", state, checked_names, name_total, flush=True)
        same_rows = by_name.get(norm_name, ())
        for license_row in group:
            counties = _license_counties(license_row, crosswalk, state)
            hits: dict[str, str] = {}
            for inspection in same_rows:
                tier = _classify(license_row, inspection, counties, crosswalk, state)
                if tier:
                    hits[inspection["activity_nr"]] = tier
            if license_row["person"]:
                hits = {activity: "weak" for activity in hits}
            if not hits:
                continue
            best = max(hits.values(), key=RANK.get)
            kept_ids = sorted((activity for activity, tier in hits.items() if tier == best), key=int)
            matches.append(
                {
                    "state": state,
                    "source_system": spec["source_system"],
                    "license_key": license_row["license_key"],
                    "contractor_id": license_row["contractor_id"],
                    "slug": license_row["slug"],
                    "mailing_state": license_row["mailing_state"],
                    "display_name": license_row["display_name"],
                    "norm_name": license_row["norm_name"],
                    "postal_code": license_row["zip"],
                    "county_name": license_row["county_name"],
                    "person_name_licensee": "yes" if license_row["person"] else "no",
                    "match_tier": best,
                    "osha_activity_nrs": ";".join(kept_ids),
                    **_empty_public_aggregate(),
                }
            )
    matches.sort(key=lambda row: (row["license_key"], row["match_tier"]))
    ambiguous = apply_publication_holds(matches)
    unparsed_dates = finalize_public_aggregates(matches, by_activity, violations_by_activity)
    return {
        "state": state,
        "source_system": spec["source_system"],
        "licenses_considered": len(prepared_licenses),
        "person_licenses_considered": sum(row["person"] for row in prepared_licenses),
        "inspections_in_state": len(prepared_inspections),
        "duplicate_inspection_rows": duplicate_inspections,
        "unparsed_open_dates": unparsed_dates,
        "ambiguous_activities": ambiguous,
        "matches": matches,
    }


def _empty_public_aggregate() -> dict:
    """Public totals before any retained activity is proven."""
    return {
        "n_inspections": 0,
        "first_open": "",
        "last_open": "",
        "n_citation_items": 0,
        "n_serious": 0,
        "n_willful_repeat": 0,
        "current_penalty_amount": 0,
        "initial_penalty_amount": 0,
        "n_with_final_order": 0,
        "n_contested": 0,
    }


def _aggregate_retained_activities(
    activity_ids: list[str],
    by_activity: dict[str, dict],
    violations_by_activity: dict[str, list[dict]],
) -> dict | None:
    """Build public totals from official rows for these activity IDs.

    Returns None when any ID is missing from the inspection source. Deleted
    citations are already absent from violations_by_activity.
    """
    dates = []
    unparsed = 0
    citation_rows: list[dict] = []
    for activity in activity_ids:
        inspection = by_activity.get(activity)
        if inspection is None:
            return None
        if inspection["open_date"]:
            dates.append(inspection["open_date"])
        elif (inspection.get("raw_open") or "").strip():
            unparsed += 1
        citation_rows.extend(violations_by_activity.get(activity, ()))
    dates.sort()
    current = round(sum(_money(row.get("current_penalty") or row.get("CURRENT_PENALTY") or "") for row in citation_rows))
    initial = round(sum(_money(row.get("initial_penalty") or row.get("INITIAL_PENALTY") or "") for row in citation_rows))
    return {
        "n_inspections": len(activity_ids),
        "first_open": dates[0] if dates else "",
        "last_open": dates[-1] if dates else "",
        "n_citation_items": len(citation_rows),
        "n_serious": sum((row.get("viol_type") or row.get("VIOL_TYPE") or "").strip().upper() == "S" for row in citation_rows),
        "n_willful_repeat": sum((row.get("viol_type") or row.get("VIOL_TYPE") or "").strip().upper() in {"W", "R"} for row in citation_rows),
        "current_penalty_amount": current,
        "initial_penalty_amount": initial,
        "n_with_final_order": sum(bool(iso_date(row.get("final_order_date") or row.get("FINAL_ORDER_DATE") or "")) for row in citation_rows),
        "n_contested": sum(bool(iso_date(row.get("contest_date") or row.get("CONTEST_DATE") or "")) for row in citation_rows),
        "unparsed_open_dates": unparsed,
    }


def finalize_public_aggregates(
    matches: list[dict],
    by_activity: dict[str, dict],
    violations_by_activity: dict[str, list[dict]],
) -> int:
    """Replace public totals with metrics proven from published_activity_nrs.

    osha_activity_nrs stays the pre-hold provenance list. A license whose
    retained activities cannot all be found in the inspection source is held
    instead of keeping a stale total.
    """
    unparsed = 0
    for row in matches:
        published = [activity for activity in str(row.get("published_activity_nrs") or "").split(";") if activity]
        if row.get("profile_eligible") != "yes" or not published:
            row.update(_empty_public_aggregate())
            continue
        proven = _aggregate_retained_activities(published, by_activity, violations_by_activity)
        if proven is None:
            row["published_activity_nrs"] = ""
            row["profile_eligible"] = "no"
            row["publication_status"] = "unproven_held"
            row.update(_empty_public_aggregate())
            continue
        unparsed += proven.pop("unparsed_open_dates")
        row.update(proven)
    return unparsed


def apply_publication_holds(matches: list[dict]) -> set[str]:
    """Hold an exact or strong activity that attaches to more than one profile.

    Weak rows stay held. A license with no contractor profile is not eligible.
    Two licenses of the same contractor can share an activity.
    """
    owners: dict[str, set[str]] = defaultdict(set)
    for row in matches:
        if row.get("match_tier") not in PUBLIC_TIERS:
            continue
        contractor_id = (row.get("contractor_id") or "").strip()
        if not contractor_id:
            continue
        for activity in str(row.get("osha_activity_nrs") or "").split(";"):
            if activity:
                owners[activity].add(contractor_id)
    ambiguous = {activity for activity, contractors in owners.items() if len(contractors) > 1}
    for row in matches:
        activities = [activity for activity in str(row.get("osha_activity_nrs") or "").split(";") if activity]
        held = [activity for activity in activities if activity in ambiguous]
        published = [activity for activity in activities if activity not in ambiguous]
        contractor_id = (row.get("contractor_id") or "").strip()
        tier = row.get("match_tier")
        row["ambiguous_activity_nrs"] = ";".join(held)
        if tier == "weak":
            row["published_activity_nrs"] = ""
            row["publication_status"] = "weak_held"
            row["profile_eligible"] = "no"
        elif tier in PUBLIC_TIERS and contractor_id and published:
            row["published_activity_nrs"] = ";".join(published)
            row["publication_status"] = "eligible"
            row["profile_eligible"] = "yes"
        elif tier in PUBLIC_TIERS and contractor_id:
            row["published_activity_nrs"] = ""
            row["publication_status"] = "ambiguous_held"
            row["profile_eligible"] = "no"
        else:
            row["published_activity_nrs"] = ""
            row["publication_status"] = "no_profile"
            row["profile_eligible"] = "no"
    return ambiguous


def distinct_published_activities(matches: list[dict]) -> set[str]:
    """Distinct ACTIVITY_NR values still publishable on eligible rows."""
    found: set[str] = set()
    for row in matches:
        if row.get("profile_eligible") != "yes":
            continue
        for activity in str(row.get("published_activity_nrs") or "").split(";"):
            if activity:
                found.add(activity)
    return found
