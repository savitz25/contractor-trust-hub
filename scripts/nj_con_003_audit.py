#!/usr/bin/env python3
"""NJ-CON-002B-R / NJ-CON-003 denominator, linkage, cost, unit, date, and jurisdiction audit.

Streams the official bulk CSV. Does not publish combined P+C cost. Does not
label net units as gained. Does not create contractor permit histories.
"""
from __future__ import annotations

import csv
import hashlib
import json
import sys
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ingest.adapters.nj_construction_permits import (  # noqa: E402
    NON_REPORTING_MUNICIPALITIES,
    canonical_value,
    classify_cost,
    iter_csv_rows,
    normalize_headers,
    parse_int,
    parse_number,
    parse_source_date,
    source_record_key,
)

CSV_PATH = ROOT / "data" / "raw" / "nj_construction_permits" / "nj_construction_permit_data.csv"
MUNI_PATH = ROOT / "data" / "raw" / "nj_municipalities" / "municipalities_of_new_jersey.csv"
ART = ROOT / "artifacts"
SOURCE_AS_OF = date(2026, 8, 13)
SOURCE_RECEIVED_AS_OF = date(2026, 8, 7)
STATED_RETENTION_MONTHS = 60
NJ_COUNTIES = (
    "ATLANTIC", "BERGEN", "BURLINGTON", "CAMDEN", "CAPE MAY", "CUMBERLAND",
    "ESSEX", "GLOUCESTER", "HUDSON", "HUNTERDON", "MERCER", "MIDDLESEX",
    "MONMOUTH", "MORRIS", "OCEAN", "PASSAIC", "SALEM", "SOMERSET", "SUSSEX",
    "UNION", "WARREN",
)
# Official Construction Reporter statewide totals (DCA PDFs acquired this ticket).
OFFICIAL = {
    "2023": {"housing_units_authorized": 21682, "new_construction_units": None, "authorized_cost": 20907647665, "source": "HOUSE_23.pdf / WORK_23.pdf", "as_of": "2024-08-07"},
    "2024": {"housing_units_authorized": 27039, "new_construction_units": 26308, "authorized_cost": 24170883245, "source": "HOUSE_24.pdf / NEWHSE_24.pdf / WORK_24.pdf", "as_of": "2025-08-07"},
    "2025": {"housing_units_authorized": 19865, "new_construction_units": None, "authorized_cost": None, "source": "HOUSE_12_2025.pdf YTD (2025 yearly PDF not published)", "as_of": "2026-02-07", "authorized_cost_note": "WORK_12_2025.pdf YTD overflowed in the official PDF"},
    "2026-01": {"housing_units_authorized": 2206, "authorized_cost": 1481238717, "source": "HOUSE_01_2026.pdf / WORK_01_2026.pdf", "as_of": "2026-03-10"},
}


def parse_date_classified(raw: Any) -> tuple[str | None, str, date | None]:
    text = canonical_value(raw)
    if not text:
        return None, "MISSING_DATE", None
    iso = parse_source_date(text)
    parsed: date | None = None
    trial = text.replace("T00:00:00.000", "").replace("T00:00:00", "")
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            parsed = datetime.strptime(trial[:10], fmt).date()
            break
        except ValueError:
            continue
    if parsed is None:
        return None, "MALFORMED_DATE", None
    if parsed.year < 1800 or parsed.year > 2100:
        return None, "INVALID_YEAR", parsed
    if iso is None and (parsed.year < 1980 or parsed.year > 2027):
        return None, "INVALID_YEAR", parsed
    if parsed > SOURCE_AS_OF:
        if parsed.year == 2026:
            return iso or parsed.isoformat(), "FUTURE_DATE_REVIEW_REQUIRED", parsed
        return iso or parsed.isoformat(), "FUTURE_DATE_REVIEW_REQUIRED", parsed
    if parsed > SOURCE_RECEIVED_AS_OF:
        return iso or parsed.isoformat(), "VALID_CURRENT_DATE", parsed
    if parsed.year < 2016:
        return iso or parsed.isoformat(), "VALID_HISTORICAL_DATE", parsed
    return iso or parsed.isoformat(), "VALID_CURRENT_DATE", parsed


def load_canonical_munis() -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {}
    if not MUNI_PATH.exists():
        return out
    with MUNI_PATH.open(encoding="utf-8-sig", newline="") as fh:
        for rec in csv.DictReader(fh):
            code = canonical_value(rec.get("MUNICIPALITY_CODE_DCA"))
            if not code:
                continue
            county = canonical_value(rec.get("COUNTY_NAME_COMMON")).replace(" County", "").upper()
            out[code] = {
                "dca_code": code,
                "dca_name": canonical_value(rec.get("MUNICIPALITY_NAME_DCA")),
                "common_name": canonical_value(rec.get("MUNICIPALITY_NAME_COMMON")),
                "county": county,
                "current_active": "true",
            }
    return out


def empty_county() -> dict[str, Any]:
    return {
        "p_rows": 0, "c_rows": 0, "update_x": 0, "state_rows": 0,
        "p_cost": 0.0, "c_cost": 0.0,
        "sale_pos": 0, "sale_neg": 0, "rent_pos": 0, "rent_neg": 0,
        "municipalities": set(),
    }


def main() -> int:
    if not CSV_PATH.exists():
        print("missing bulk CSV", CSV_PATH, file=sys.stderr)
        return 2
    ART.mkdir(parents=True, exist_ok=True)
    canonical = load_canonical_munis()
    nonrep = {x["comu"]: x for x in NON_REPORTING_MUNICIPALITIES}

    totals = Counter()
    county_stats: dict[str, dict[str, Any]] = defaultdict(empty_county)
    muni_obs: dict[str, dict[str, Any]] = {}
    state_rows: list[dict[str, Any]] = []
    cost_outliers: list[dict[str, Any]] = []
    future_dates: list[dict[str, Any]] = []
    date_class_counts = Counter()
    process_class = Counter()
    permit_class = Counter()
    work_mix_p = Counter()
    work_mix_c = Counter()
    # (comu, permitno) -> [p, c, p_cost, c_cost, p_sale, c_sale, p_rent, c_rent]
    groups: dict[tuple[str, str], list[float]] = {}
    permitno_reuse_muni = 0
    year_p_cost: dict[str, float] = Counter()
    year_p_units_pos: dict[str, int] = Counter()
    year_p_new_units_pos: dict[str, int] = Counter()
    year_p_rows: dict[str, int] = Counter()
    month_p_rows: Counter[str] = Counter()
    month_c_rows: Counter[str] = Counter()
    process_month: Counter[str] = Counter()
    process_old_permit_recent: int = 0
    update_x_and_non_x_same_key = 0
    blank_cost = 0
    zero_cost = 0
    negative_cost = 0
    p_with_cost = 0
    c_with_cost = 0
    p_cost_sum = 0.0
    c_cost_sum = 0.0
    p_cost_sum_incl_extreme = 0.0
    sale_pos = sale_neg = rent_pos = rent_neg = 0
    p_sale_pos = p_sale_neg = p_rent_pos = p_rent_neg = 0
    c_sale_pos = c_sale_neg = c_rent_pos = c_rent_neg = 0
    samples_update: list[dict[str, Any]] = []
    samples_neg_unit: list[dict[str, Any]] = []
    samples_unaudited: list[dict[str, Any]] = []

    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.reader(fh)
        header = next(reader)
        fields = normalize_headers(header)
        for i, values in enumerate(reader, start=2):
            row = {fields[j]: values[j] if j < len(values) else "" for j in range(len(fields))}
            totals["source_records"] += 1
            status = canonical_value(row.get("status")).upper()
            county = canonical_value(row.get("county")).upper()
            comu = canonical_value(row.get("comu"))
            permitno = canonical_value(row.get("permitno"))
            update = canonical_value(row.get("update")).upper()
            ptype = canonical_value(row.get("permittypedesc")) or canonical_value(row.get("permittype"))
            cost_n, cost_cls = classify_cost(row.get("constcost"))
            sale = parse_int(row.get("salegained")) or 0
            rent = parse_int(row.get("rentgained")) or 0
            permit_iso, permit_cls, permit_d = parse_date_classified(row.get("permitdate"))
            cert_iso, cert_cls, _cert_d = parse_date_classified(row.get("certdate"))
            proc_iso, proc_cls, proc_d = parse_date_classified(row.get("processdate"))
            date_class_counts[permit_cls] += 1
            permit_class[permit_cls] += 1
            process_class[proc_cls] += 1
            key = source_record_key(row)

            is_state = county == "STATE" or canonical_value(row.get("munitype")).upper() == "STATEWIDE" or comu == "9999"
            if is_state:
                totals["state_rows"] += 1
                if len(state_rows) < 80:
                    state_rows.append({
                        "line": i, "comu": comu, "muniname": row.get("muniname"), "munitype": row.get("munitype"),
                        "county": county, "recordid": row.get("recordid"), "permitno": permitno,
                        "status": status, "permitdate": row.get("permitdate"), "certdate": row.get("certdate"),
                        "processdate": row.get("processdate"), "permittypedesc": row.get("permittypedesc"),
                        "constcost": row.get("constcost"), "salegained": row.get("salegained"),
                        "rentgained": row.get("rentgained"), "usegroup": row.get("usegroup"),
                        "block": row.get("block"), "lot": row.get("lot"), "pk": key, "update": update,
                    })
            else:
                totals["municipal_rows"] += 1

            if status == "P":
                totals["permit_issued"] += 1
                work_mix_p[ptype or "unknown"] += 1
            elif status == "C":
                totals["certificate_issued"] += 1
                work_mix_c[ptype or "unknown"] += 1
            else:
                totals["other_status"] += 1
            if update == "X":
                totals["update_marked"] += 1
                if len(samples_update) < 20:
                    samples_update.append({"pk": key, "comu": comu, "permitno": permitno, "status": status, "county": county})

            if cost_cls == "missing":
                blank_cost += 1
            elif cost_cls == "reported_zero":
                zero_cost += 1
            if cost_n is not None and cost_n < 0:
                negative_cost += 1
            if cost_cls in {"extreme", "invalid"} or (cost_n is not None and cost_n < 0):
                reason = "NEGATIVE" if (cost_n is not None and cost_n < 0) else ("MALFORMED" if cost_cls == "invalid" else "EXCEEDS_500M")
                treatment = "UNRESOLVED_EXTREME"
                if cost_n is not None and cost_n > 500_000_000:
                    treatment = "UNRESOLVED_EXTREME"
                cost_outliers.append({
                    "municipality": row.get("muniname"), "county": county, "comu": comu,
                    "recordid": row.get("recordid"), "permitno": permitno, "status": status,
                    "work_type": ptype, "permitdate": row.get("permitdate"),
                    "certdate": row.get("certdate"), "processdate": row.get("processdate"),
                    "raw_cost": row.get("constcost"), "parsed_cost": cost_n,
                    "source_fingerprint": hashlib.sha256(json.dumps(row, sort_keys=True).encode()).hexdigest(),
                    "reason_flagged": reason, "classification": treatment,
                    "publication_treatment": "INTERNAL_REVIEW",
                    "notes": "Not discarded solely for magnitude. Manual classification required.",
                    "pk": key,
                })
            if cost_n is not None:
                if status == "P":
                    p_with_cost += 1
                    p_cost_sum_incl_extreme += cost_n
                    if cost_cls in {"ok", "reported_zero"}:
                        p_cost_sum += cost_n
                elif status == "C":
                    c_with_cost += 1
                    if cost_cls in {"ok", "reported_zero"}:
                        c_cost_sum += cost_n

            if sale > 0:
                sale_pos += sale
            elif sale < 0:
                sale_neg += sale
                if len(samples_neg_unit) < 5:
                    samples_neg_unit.append({"pk": key, "comu": comu, "county": county, "sale": sale, "rent": rent, "status": status, "type": ptype})
            if rent > 0:
                rent_pos += rent
            elif rent < 0:
                rent_neg += rent
            if status == "P":
                p_sale_pos += sale if sale > 0 else 0
                p_sale_neg += sale if sale < 0 else 0
                p_rent_pos += rent if rent > 0 else 0
                p_rent_neg += rent if rent < 0 else 0
            elif status == "C":
                c_sale_pos += sale if sale > 0 else 0
                c_sale_neg += sale if sale < 0 else 0
                c_rent_pos += rent if rent > 0 else 0
                c_rent_neg += rent if rent < 0 else 0

            if permit_cls == "FUTURE_DATE_REVIEW_REQUIRED" and len(future_dates) < 5000:
                future_dates.append({
                    "pk": key, "comu": comu, "county": county, "status": status,
                    "permitdate": row.get("permitdate"), "processdate": row.get("processdate"),
                    "parsed_permit": permit_iso, "classification": permit_cls,
                })
            if permit_d and proc_d and permit_d.year < 2016 and proc_d >= date(2024, 1, 1):
                process_old_permit_recent += 1
            if permit_d and permit_d.year >= 2026 and permit_d.month >= 6 and len(samples_unaudited) < 20:
                samples_unaudited.append({"pk": key, "permitdate": permit_iso, "status": status, "comu": comu})

            ckey = county if county in NJ_COUNTIES or county == "STATE" else "UNMAPPED"
            cs = county_stats[ckey]
            if status == "P":
                cs["p_rows"] += 1
                if cost_n is not None and cost_cls in {"ok", "reported_zero"}:
                    cs["p_cost"] += cost_n
            elif status == "C":
                cs["c_rows"] += 1
                if cost_n is not None and cost_cls in {"ok", "reported_zero"}:
                    cs["c_cost"] += cost_n
            if update == "X":
                cs["update_x"] += 1
            if is_state:
                cs["state_rows"] += 1
            cs["sale_pos"] += sale if sale > 0 else 0
            cs["sale_neg"] += sale if sale < 0 else 0
            cs["rent_pos"] += rent if rent > 0 else 0
            cs["rent_neg"] += rent if rent < 0 else 0
            if not is_state:
                cs["municipalities"].add(comu)

            if comu and not is_state:
                mo = muni_obs.setdefault(comu, {"name": row.get("muniname"), "county": county, "p": 0, "c": 0, "rows": 0})
                mo["rows"] += 1
                if status == "P":
                    mo["p"] += 1
                elif status == "C":
                    mo["c"] += 1

            if comu and permitno and permitno not in {".", "MISSING", "+A", "+"}:
                g = groups.get((comu, permitno))
                if g is None:
                    groups[(comu, permitno)] = [0, 0, 0.0, 0.0, 0, 0, 0, 0]
                    g = groups[(comu, permitno)]
                if status == "P":
                    g[0] += 1
                    g[2] += cost_n or 0
                    g[4] += sale
                    g[6] += rent
                elif status == "C":
                    g[1] += 1
                    g[3] += cost_n or 0
                    g[5] += sale
                    g[7] += rent

            if permit_d and status == "P" and not is_state:
                y = str(permit_d.year)
                year_p_rows[y] += 1
                if cost_n is not None and cost_cls in {"ok", "reported_zero"}:
                    year_p_cost[y] += cost_n
                pos_units = (sale if sale > 0 else 0) + (rent if rent > 0 else 0)
                year_p_units_pos[y] += pos_units
                if (ptype or "").lower() == "new" or canonical_value(row.get("permittype")) == "04":
                    year_p_new_units_pos[y] += pos_units
                month_p_rows[permit_d.isoformat()[:7]] += 1
            if permit_d and status == "C" and not is_state:
                month_c_rows[permit_d.isoformat()[:7]] += 1
            if proc_d:
                process_month[proc_d.isoformat()[:7]] += 1

    # Linkage summary
    one_one = one_many = many_one = many_many = unlinked_p_groups = unlinked_c_groups = 0
    p_with_c = c_with_p = 0
    cost_exact = unit_exact = cost_conflict = unit_conflict = 0
    unsafe = 0
    p_in_linked = c_in_linked = 0
    one_many_samples = []
    one_one_samples = []
    for (comu, pno), g in groups.items():
        p_n, c_n = int(g[0]), int(g[1])
        if p_n and c_n:
            p_with_c += p_n
            c_with_p += c_n
            if p_n == 1 and c_n == 1:
                one_one += 1
                if abs(g[2] - g[3]) < 0.005:
                    cost_exact += 1
                elif g[2] and g[3]:
                    cost_conflict += 1
                if g[4] == g[5] and g[6] == g[7]:
                    unit_exact += 1
                elif (g[4] or g[5] or g[6] or g[7]):
                    unit_conflict += 1
                if len(one_one_samples) < 20:
                    one_one_samples.append({"comu": comu, "permitno": pno, "p_cost": g[2], "c_cost": g[3], "p_sale": g[4], "c_sale": g[5]})
            elif p_n == 1 and c_n > 1:
                one_many += 1
                unsafe += 1
                if len(one_many_samples) < 10:
                    one_many_samples.append({"comu": comu, "permitno": pno, "p": p_n, "c": c_n})
            elif p_n > 1 and c_n == 1:
                many_one += 1
                unsafe += 1
            else:
                many_many += 1
                unsafe += 1
            p_in_linked += p_n
            c_in_linked += c_n
        elif p_n and not c_n:
            unlinked_p_groups += 1
            if p_n > 1:
                permitno_reuse_muni += 1
        elif c_n and not p_n:
            unlinked_c_groups += 1

    linkage = {
        "p_records": totals["permit_issued"],
        "c_records": totals["certificate_issued"],
        "candidate_key": "municipality_code + permit_number",
        "candidate_key_sufficient_for_project": False,
        "reason_insufficient": (
            "Permit numbers are reused within a municipality. Groups include one-to-many, "
            "many-to-one, and many-to-many P/C patterns. No official project identifier exists."
        ),
        "p_records_with_candidate_c": p_with_c,
        "c_records_with_candidate_p": c_with_p,
        "one_to_one_candidate_groups": one_one,
        "one_to_many_groups": one_many,
        "many_to_one_groups": many_one,
        "many_to_many_groups": many_many,
        "unlinked_p_groups": unlinked_p_groups,
        "unlinked_c_groups": unlinked_c_groups,
        "cost_repeated_exactly_one_to_one": cost_exact,
        "unit_fields_repeated_exactly_one_to_one": unit_exact,
        "conflicting_cost_one_to_one": cost_conflict,
        "conflicting_units_one_to_one": unit_conflict,
        "unsafe_project_grouping_records": unsafe,
        "permit_number_reused_within_municipality_p_only_groups": permitno_reuse_muni,
        "approved_analytical_treatment": (
            "Do not create a project identifier. Do not add P and C construction costs. "
            "Approved public cost metric is permit-issued municipal records only. "
            "Certificate-issued records are a separate source class."
        ),
        "one_to_one_samples": one_one_samples,
        "one_to_many_samples": one_many_samples,
    }

    # Jurisdiction
    current_codes = set(canonical.keys())
    observed_codes = set(muni_obs.keys())
    historical = sorted(observed_codes - current_codes)
    current_reporting = sorted(observed_codes & current_codes)
    current_non = [c for c in nonrep if c in current_codes]
    coverage_unknown = sorted(current_codes - observed_codes - set(nonrep))
    juris_rows = []
    for code, meta in sorted(canonical.items()):
        if code in observed_codes:
            cls = "CURRENT_REPORTING"
        elif code in nonrep:
            cls = "CURRENT_NON_REPORTING"
        else:
            cls = "CURRENT_COVERAGE_UNKNOWN"
        obs = muni_obs.get(code, {})
        juris_rows.append({
            "municipality_code": code,
            "canonical_name": meta["dca_name"],
            "county": meta["county"],
            "classification": cls,
            "observed_rows": obs.get("rows", 0),
            "observed_p": obs.get("p", 0),
            "observed_c": obs.get("c", 0),
            "no_records_is_not_zero": cls != "CURRENT_REPORTING",
        })
    for code in historical:
        obs = muni_obs[code]
        juris_rows.append({
            "municipality_code": code,
            "canonical_name": obs.get("name"),
            "county": obs.get("county"),
            "classification": "HISTORICAL_OR_INACTIVE",
            "observed_rows": obs.get("rows", 0),
            "observed_p": obs.get("p", 0),
            "observed_c": obs.get("c", 0),
            "no_records_is_not_zero": False,
        })
    juris_rows.append({
        "municipality_code": "9999",
        "canonical_name": "STATE / STATEWIDE",
        "county": "STATE",
        "classification": "STATE_LEVEL",
        "observed_rows": totals["state_rows"],
        "observed_p": "",
        "observed_c": "",
        "no_records_is_not_zero": False,
    })

    # STATE row classification
    state_class_counts = Counter()
    for rec in state_rows:
        name = canonical_value(rec.get("muniname")).upper()
        ptype = canonical_value(rec.get("permittypedesc")).upper()
        cost = parse_number(rec.get("constcost")) or 0
        if rec.get("comu") == "9999" or name in {"STATEWIDE", "STATE"}:
            rec["classification"] = "STATE_AGENCY_OR_STATEWIDE_RECORD"
            rec["additive_to_municipal_total"] = False
            rec["public_treatment"] = "Preserve separately as STATE_LEVEL. Do not add to municipality-derived statewide total until independently confirmed additive."
            rec["aggregate_summary"] = cost > 10_000_000 and rec.get("status") == "C"
        else:
            rec["classification"] = "MALFORMED_OR_UNRESOLVED"
            rec["additive_to_municipal_total"] = False
            rec["public_treatment"] = "INTERNAL_ONLY"
        state_class_counts[rec["classification"]] += 1

    # Cost outlier manual pass: keep all, classify obvious errors vs large projects
    for rec in cost_outliers:
        parsed = rec.get("parsed_cost")
        if parsed is not None and parsed < 0:
            rec["classification"] = "LIKELY_DATA_ERROR"
            rec["publication_treatment"] = "EXCLUDE_FROM_PUBLIC_COST"
        elif parsed is not None and parsed >= 1_000_000_000:
            rec["classification"] = "UNRESOLVED_EXTREME"
            rec["publication_treatment"] = "EXCLUDE_FROM_PUBLIC_COST_PENDING_REVIEW"
        elif parsed is not None and parsed >= 500_000_000:
            rec["classification"] = "UNRESOLVED_EXTREME"
            rec["publication_treatment"] = "EXCLUDE_FROM_PUBLIC_COST_PENDING_REVIEW"
            rec["notes"] = "Magnitude exceeds $500M. May be valid large project. Not discarded as a rule; excluded from the approved public cost metric until reviewed."

    # Official reconciliation rows
    recon_rows = []
    def add_recon(period, measure, official_def, record_class, date_field, micro, official, explanation, approved):
        diff = None if micro is None or official is None else micro - official
        pct = None if not official else (None if diff is None else round(100.0 * diff / official, 2))
        recon_rows.append({
            "period": period,
            "measure": measure,
            "official_report_definition": official_def,
            "microdata_record_class": record_class,
            "microdata_date_field": date_field,
            "microdata_total": micro,
            "official_reporter_total": official,
            "absolute_difference": diff,
            "difference_percentage": pct,
            "within_expected_tolerance": "unresolved" if official is None or micro is None else ("yes" if official and abs(diff) / max(official, 1) < 0.15 else "no"),
            "known_explanation": explanation,
            "unresolved_discrepancy": official is None or (diff is not None and official and abs(diff) / max(official, 1) >= 0.15),
            "publication_approved": approved,
        })

    expl = (
        "Official Construction Reporter is audited and may correct municipal submissions. "
        "Microdata is raw unaudited. Compare permit-issued municipal rows by permit date, not P+C. "
        "Housing comparison uses gross positive sale+rental units, not net change."
    )
    add_recon("2023", "housing_units_authorized", "HOUSE_23.pdf New Jersey total",
              "permit-issued municipal rows; permit date 2023; gross positive sale+rental units",
              "permitdate", year_p_units_pos.get("2023"), OFFICIAL["2023"]["housing_units_authorized"], expl,
              "APPROVED_WITH_CAVEAT" if year_p_units_pos.get("2023") else "BLOCKED_PENDING_DEFINITION")
    add_recon("2023", "authorized_construction_value", "WORK_23.pdf New Jersey total",
              "permit-issued municipal rows; permit date 2023; source-reported constcost (ok+zero, not P+C)",
              "permitdate", round(year_p_cost.get("2023", 0), 2), OFFICIAL["2023"]["authorized_cost"], expl,
              "APPROVED_WITH_CAVEAT")
    add_recon("2024", "housing_units_authorized", "HOUSE_24.pdf New Jersey total 27039",
              "permit-issued municipal rows; permit date 2024; gross positive sale+rental units",
              "permitdate", year_p_units_pos.get("2024"), OFFICIAL["2024"]["housing_units_authorized"], expl,
              "APPROVED_WITH_CAVEAT")
    add_recon("2024", "new_construction_units", "NEWHSE_24.pdf New Jersey total 26308",
              "permit-issued municipal rows; permit date 2024; permit type New; gross positive units",
              "permitdate", year_p_new_units_pos.get("2024"), OFFICIAL["2024"]["new_construction_units"], expl,
              "APPROVED_WITH_CAVEAT")
    add_recon("2024", "authorized_construction_value", "WORK_24.pdf New Jersey total 24170883245",
              "permit-issued municipal rows; permit date 2024; constcost ok+zero",
              "permitdate", round(year_p_cost.get("2024", 0), 2), OFFICIAL["2024"]["authorized_cost"], expl,
              "APPROVED_WITH_CAVEAT")
    add_recon("2025", "housing_units_authorized", "HOUSE_12_2025.pdf YTD New Jersey 19865 (yearly PDF unpublished)",
              "permit-issued municipal rows; permit date 2025; gross positive units",
              "permitdate", year_p_units_pos.get("2025"), OFFICIAL["2025"]["housing_units_authorized"], expl,
              "APPROVED_WITH_CAVEAT")
    add_recon("2025", "authorized_construction_value", "WORK_12_2025.pdf YTD overflowed in official PDF",
              "permit-issued municipal rows; permit date 2025; constcost ok+zero",
              "permitdate", round(year_p_cost.get("2025", 0), 2), None,
              "Official YTD cost not readable from the December 2025 PDF (cell overflow).",
              "BLOCKED_DUE_TO_RECONCILIATION")
    add_recon("2026-01", "housing_units_authorized", "HOUSE_01_2026.pdf New Jersey 2206",
              "permit-issued municipal rows; permit date 2026-01; gross positive units",
              "permitdate", None, OFFICIAL["2026-01"]["housing_units_authorized"],
              "January 2026 is within the agency's unaudited two-month window relative to later months; treat as unaudited when publishing trends.",
              "INTERNAL_ONLY")
    add_recon("all-extract-p-plus-c", "combined_source_records", "not an official Reporter measure",
              "all P and C source records", "n/a", totals["source_records"], None,
              "Do not publish as 2.68 million permits.", "BLOCKED_PENDING_DEFINITION")
    add_recon("all-extract-p-plus-c", "combined_construction_cost", "not an official Reporter measure",
              "P+C costs previously reported as 126101062607", "n/a", round(p_cost_sum + c_cost_sum, 2), None,
              "P and C costs are not proven additive. Not approved.", "BLOCKED_PENDING_DEFINITION")

    county_out = {}
    for cty in list(NJ_COUNTIES) + ["STATE"]:
        cs = county_stats[cty]
        county_out[cty] = {
            "permit_issued_records": cs["p_rows"],
            "certificate_issued_records": cs["c_rows"],
            "update_marked": cs["update_x"],
            "permit_issued_cost_ok_zero": round(cs["p_cost"], 2),
            "net_sale_unit_change": cs["sale_pos"] + cs["sale_neg"],
            "net_rental_unit_change": cs["rent_pos"] + cs["rent_neg"],
            "gross_positive_sale_units": cs["sale_pos"],
            "gross_negative_sale_units": cs["sale_neg"],
            "observed_municipality_codes": len(cs["municipalities"]) if cty != "STATE" else 0,
        }

    snapshot = {
        "ticket": "NJ-CON-003",
        "publication_status": "internal_only",
        "source_as_of": SOURCE_AS_OF.isoformat(),
        "source_hash": "abc0df7f4d25691f82ca80b14358fd10f94cd8841433edd935f4191e06e46c4e",
        "denominators": {
            "total_source_records": totals["source_records"],
            "permit_issued": totals["permit_issued"],
            "certificate_issued": totals["certificate_issued"],
            "update_marked": totals["update_marked"],
            "municipal": totals["municipal_rows"],
            "state": totals["state_rows"],
            "other_status": totals["other_status"],
            "equation": "permit_issued + certificate_issued + other_status = total_source_records; municipal + state = total_source_records",
        },
        "coverage_gaps": {
            "pwcr": "SOURCE_NOT_ACQUIRED",
            "prevailing_wage_debarment": "SOURCE_NOT_ACQUIRED",
            "new_home_builder": "SOURCE_NOT_ACQUIRED",
            "hec": "SOURCE_NOT_ACQUIRED",
            "board_action": "SOURCE_NOT_ACQUIRED",
            "ocp_legal_filings": "PARTIAL_SOURCE_COVERAGE",
        },
        "specialty_and_labor": "See NJ-CON-001 / NJ-CON-002A artifacts. Production execute pending.",
        "permit_certificate_market": {
            "approved_cost_metric": "permit-issued municipal source-reported estimated construction value (ok+zero). P+C combined cost is not approved.",
            "approved_unit_metric": "net housing-unit change, with gross positive and gross negative disclosed. Not labeled units gained.",
            "work_type_mix_permit_issued": dict(work_mix_p),
            "work_type_mix_certificate_issued": dict(work_mix_c),
            "county": county_out,
        },
        "credentials": "Production NJ DCA credential census not refreshed in this ticket (no authorized DB session).",
        "public_permit_attribution": 0,
    }

    ART.joinpath("nj-con-002b-permit-certificate-linkage-summary.json").write_text(json.dumps(linkage, indent=2), encoding="utf-8")
    _write_csv(ART / "nj-con-002b-state-row-audit.csv", state_rows)
    _write_csv(ART / "nj-con-002b-cost-outlier-audit.csv", cost_outliers)
    _write_csv(ART / "nj-con-002b-date-audit.csv", future_dates[:2000] or [{"note": "no future-dated sample rows collected"}])
    _write_csv(ART / "nj-con-002b-jurisdiction-reconciliation.csv", juris_rows)
    _write_csv(ART / "nj-con-003-construction-reporter-reconciliation.csv", recon_rows)
    ART.joinpath("nj-con-003-audited-state-snapshot.json").write_text(json.dumps(snapshot, indent=2, default=_json_default), encoding="utf-8")

    summary = {
        "totals": dict(totals),
        "blank_cost": blank_cost,
        "zero_cost": zero_cost,
        "negative_cost": negative_cost,
        "p_with_cost": p_with_cost,
        "c_with_cost": c_with_cost,
        "p_cost_sum_ok_zero": p_cost_sum,
        "c_cost_sum_ok_zero": c_cost_sum,
        "p_cost_sum_including_extremes": p_cost_sum_incl_extreme,
        "sale_pos": sale_pos, "sale_neg": sale_neg, "rent_pos": rent_pos, "rent_neg": rent_neg,
        "p_sale_pos": p_sale_pos, "p_sale_neg": p_sale_neg, "p_rent_pos": p_rent_pos, "p_rent_neg": p_rent_neg,
        "c_sale_pos": c_sale_pos, "c_sale_neg": c_sale_neg, "c_rent_pos": c_rent_pos, "c_rent_neg": c_rent_neg,
        "canonical_current_municipalities": len(canonical),
        "observed_codes": len(observed_codes),
        "current_reporting": len(current_reporting),
        "current_non_reporting": len(current_non),
        "coverage_unknown": len(coverage_unknown),
        "historical_or_inactive_codes": historical,
        "coverage_unknown_codes": coverage_unknown,
        "non_reporting_in_canonical": current_non,
        "date_class_permit": dict(permit_class),
        "date_class_process": dict(process_class),
        "future_dated_rows_sampled": len(future_dates),
        "old_permit_recent_process": process_old_permit_recent,
        "year_p_rows": dict(year_p_rows),
        "year_p_cost": {k: v for k, v in year_p_cost.items()},
        "year_p_units_pos": dict(year_p_units_pos),
        "year_p_new_units_pos": dict(year_p_new_units_pos),
        "cost_outliers": len(cost_outliers),
        "state_class_counts": dict(state_class_counts),
        "linkage": {k: v for k, v in linkage.items() if not k.endswith("samples")},
        "county": county_out,
        "samples_update": samples_update,
        "samples_neg_unit": samples_neg_unit,
        "samples_unaudited": samples_unaudited,
        "official": OFFICIAL,
    }
    ART.joinpath("nj-con-003-audit-summary.json").write_text(json.dumps(summary, indent=2, default=_json_default), encoding="utf-8")
    print(json.dumps({
        "source_records": totals["source_records"],
        "P": totals["permit_issued"],
        "C": totals["certificate_issued"],
        "state": totals["state_rows"],
        "update_x": totals["update_marked"],
        "one_one": one_one,
        "p_cost": p_cost_sum,
        "canonical_munis": len(canonical),
        "historical_codes": len(historical),
    }, indent=2))
    return 0


def _json_default(obj):
    if isinstance(obj, set):
        return sorted(obj)
    if isinstance(obj, date):
        return obj.isoformat()
    return str(obj)


def _write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    fields = list(rows[0].keys())
    with path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for rec in rows:
            w.writerow({k: rec.get(k) for k in fields})


if __name__ == "__main__":
    raise SystemExit(main())
