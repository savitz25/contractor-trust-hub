#!/usr/bin/env python3
"""Controlled Stage E for Miami-Dade Open Data issued permits.

Path A: store all official source rows. Public contractor activity uses
CONFIRMED attribution only. No City of Miami. No TEST_ONLY.
"""
from __future__ import annotations

import hashlib
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ingest.env import load_dotenv_files  # noqa: E402
from ingest.mdc_opendata import (  # noqa: E402
    PARSER_VERSION,
    SOURCE_SYSTEM,
    contact_observations,
    iter_jsonl,
    parse_row,
    stage_c,
)

EXPECTED_SHA = "9e9fe2d711dd8c2ec13d4832b70fe41ae9440c7a3be0b51910c22f8eb6c3effa"
JSONL = ROOT / "data/raw/mdc_opendata_permits/permits.jsonl"
OUT = ROOT / "data/raw/mdc_opendata_permits/stage_e_report.json"
HUB = "https://opendata.miamidade.gov/datasets/6db5f56e886446df88313ca279e59120"
BATCH = 80


def load_env() -> tuple[str, str]:
    import os

    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    url = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not url or not key:
        raise SystemExit("missing supabase env")
    return url, key


def rest(url: str, key: str, method: str, path: str, body=None, extra=None) -> tuple[int, object]:
    headers = {
        "apikey": key,
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    if extra:
        headers.update(extra)
    data = None if body is None else json.dumps(body, default=str).encode("utf-8")
    req = urllib.request.Request(url + "/rest/v1/" + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} {path}: {err[:600]}") from e


def lookup_licenses(url: str, key: str, ids: list[str]) -> dict[str, str]:
    found: dict[str, str] = {}
    for i in range(0, len(ids), 80):
        chunk = ids[i : i + 80]
        quoted = ",".join(urllib.parse.quote(v, safe="") for v in chunk)
        path = f"licenses?select=id,external_key,contractor_id&source_system=eq.fl_dbpr&external_key=in.({quoted})"
        _, rows = rest(url, key, "GET", path)
        for r in rows or []:
            ek = (r.get("external_key") or "").upper()
            if ek:
                found[ek] = r
        if i % 800 == 0:
            print(f"license lookup {i}/{len(ids)} hits={len(found)}", flush=True)
    return found


def source_row(p: dict, sha: str, retrieved: str) -> dict:
    payload = {
        "process_kind": p.get("process_kind"),
        "contractor_namespace": p.get("contractor_namespace"),
        "ProcessNumber": (p.get("raw_payload") or {}).get("ProcessNumber"),
        "PermitType": p.get("permit_type_raw"),
        "FolioNumber": p.get("parcel_id"),
    }
    return {
        "source_system": SOURCE_SYSTEM,
        "source_jurisdiction": p["source_jurisdiction"],
        "county_slug": "miami-dade",
        "municipality": None,
        "permit_number": p["permit_number"],
        "source_record_id": p.get("source_record_id"),
        "permit_type_raw": p.get("permit_type_raw"),
        "permit_type_normalized": (p.get("permit_type_raw") or "").lower() or None,
        "work_description": p.get("work_description"),
        "property_address": p.get("property_address"),
        "parcel_id": p.get("parcel_id"),
        "contractor_name_raw": p.get("contractor_name_raw"),
        "contractor_license_raw": p.get("contractor_license_raw"),
        "contractor_license_normalized": p.get("contractor_license_normalized"),
        "local_contractor_id": p.get("local_contractor_id"),
        "application_date": p.get("application_date") or None,
        "issue_date": p.get("issue_date") or None,
        "status_raw": "issued",
        "status_normalized": "issued",
        "valuation": p.get("valuation"),
        "fees": p.get("fees"),
        "parser_version": PARSER_VERSION,
        "source_fingerprint": sha,
        "retrieved_at": retrieved,
        "source_url": HUB,
        "raw_payload": payload,
    }


def main() -> int:
    if not JSONL.is_file():
        print("missing", JSONL, file=sys.stderr)
        return 2
    sha = hashlib.sha256(JSONL.read_bytes()).hexdigest()
    if sha != EXPECTED_SHA:
        print("SHA mismatch", sha, file=sys.stderr)
        return 3
    url, key = load_env()
    retrieved = datetime.now(timezone.utc).isoformat()
    print("parsing + license census", flush=True)
    parsed: list[dict] = []
    dbpr_ids: set[str] = set()
    for rec in iter_jsonl(JSONL):
        p = parse_row(rec)
        p["raw_payload"] = None
        parsed.append(p)
        if p.get("contractor_namespace") == "DBPR_FULL_PREFIXED" and p.get("contractor_license_normalized"):
            dbpr_ids.add(p["contractor_license_normalized"])
    print("rows", len(parsed), "distinct prefixed", len(dbpr_ids), flush=True)
    licenses = lookup_licenses(url, key, sorted(dbpr_ids))
    known = set(licenses)
    parsed = stage_c(parsed, known_dbpr=known)
    for p in parsed:
        lic = p.get("contractor_license_normalized")
        hit = licenses.get(lic or "")
        p["matched_license_id"] = hit["id"] if hit and p.get("identity_state") == "CONFIRMED" else None
        p["matched_contractor_id"] = (
            hit.get("contractor_id") if hit and p.get("identity_state") == "CONFIRMED" else None
        )

    rest(
        url,
        key,
        "POST",
        "enhanced_source_files?on_conflict=sha256",
        [
            {
                "sha256": sha,
                "original_filename": "permits.jsonl",
                "county_slug": "miami-dade",
                "agency": "Miami-Dade RER GIS / Open Data Hub",
                "source_name": "Building Permits Issued By Miami-Dade County — 2 Previous Years to Present",
                "requested_date_range": "rolling ~2 prior years to present (issued-only)",
                "file_format": "jsonl",
                "row_count": len(parsed),
                "parser_version": PARSER_VERSION,
                "notes": "Prompt 3 Stage E. Issued-only county RER source. Not municipal histories. Not open/pending census.",
            }
        ],
        extra={"Prefer": "resolution=merge-duplicates,return=minimal"},
    )

    inserted = 0
    attrs = 0
    conflicts = 0
    by_state = {"CONFIRMED": 0, "HIGH_CONFIDENCE": 0, "REVIEW_REQUIRED": 0, "UNRESOLVED": 0}
    extra_src = {"Prefer": "resolution=merge-duplicates,return=representation"}
    extra_attr = {"Prefer": "resolution=merge-duplicates,return=minimal"}
    for i in range(0, len(parsed), BATCH):
        chunk = parsed[i : i + BATCH]
        payload = [source_row(p, sha, retrieved) for p in chunk]
        try:
            _, saved = rest(
                url,
                key,
                "POST",
                "permit_source_records?on_conflict=source_system,source_jurisdiction,permit_number",
                payload,
                extra=extra_src,
            )
        except RuntimeError as e:
            print("batch fail", i, e, flush=True)
            conflicts += len(chunk)
            continue
        saved = saved or []
        index = {(r["source_jurisdiction"], r["permit_number"]): r["id"] for r in saved}
        attr_rows = []
        for p in chunk:
            sid = index.get((p["source_jurisdiction"], p["permit_number"]))
            if not sid:
                conflicts += 1
                continue
            state = p.get("identity_state") or "UNRESOLVED"
            by_state[state] = by_state.get(state, 0) + 1
            attr_rows.append(
                {
                    "permit_source_record_id": sid,
                    "identity_state": state,
                    "identity_method": p.get("identity_method") or "UNRESOLVED",
                    "matched_license_id": p.get("matched_license_id") if state == "CONFIRMED" else None,
                    "matched_contractor_id": p.get("matched_contractor_id") if state == "CONFIRMED" else None,
                }
            )
        if attr_rows:
            rest(
                url,
                key,
                "POST",
                "permit_attributions?on_conflict=permit_source_record_id",
                attr_rows,
                extra=extra_attr,
            )
            attrs += len(attr_rows)
        inserted += len(saved)
        if i % 4000 == 0:
            print(f"source {inserted}/{len(parsed)} attrs={attrs} conflicts={conflicts}", flush=True)
        time.sleep(0.02)

    contacts = contact_observations(parsed)
    # Attach license ids
    lic_to_id = {k: v["id"] for k, v in licenses.items()}
    phone_n = addr_n = 0
    contact_ok = 0
    contact_dup = 0
    agency_rejected = 0
    distinct_lic: set[str] = set()
    rows_out = []
    for c in contacts:
        if c.get("is_agency_number"):
            agency_rejected += 1
            continue
        if c.get("attribution_class") != "CONFIRMED":
            continue
        lid = lic_to_id.get(c.get("license_normalized") or "")
        if not lid:
            continue
        distinct_lic.add(lid)
        if c["kind"] == "phone":
            phone_n += 1
        else:
            addr_n += 1
        rows_out.append(
            {
                "source_system": SOURCE_SYSTEM,
                "source_url": HUB,
                "kind": c["kind"],
                "value": c["value"],
                "value_normalized": c["value_normalized"],
                "attributed_entity_kind": "license",
                "attributed_license_id": lid,
                "attribution_class": "CONFIRMED",
                "is_agency_number": False,
                "currentness": "permit_record",
                "retrieved_at": retrieved,
                "raw_payload": {"license_normalized": c.get("license_normalized")},
            }
        )
    extra_c = {"Prefer": "resolution=ignore-duplicates,return=minimal"}
    for i in range(0, len(rows_out), BATCH):
        chunk = rows_out[i : i + BATCH]
        try:
            rest(url, key, "POST", "public_contact_observations", chunk, extra=extra_c)
            contact_ok += len(chunk)
        except RuntimeError:
            for one in chunk:
                try:
                    rest(url, key, "POST", "public_contact_observations", [one], extra=extra_c)
                    contact_ok += 1
                except RuntimeError:
                    contact_dup += 1

    report = {
        "decision": "A_all_source_records_fail_closed_attribution",
        "why": "011 separates permit_source_records (provenance) from permit_attributions (identity). Public contractor activity queries CONFIRMED only.",
        "sha256": sha,
        "source_rows": len(parsed),
        "stored_source_records": inserted,
        "attributions": attrs,
        "CONFIRMED": by_state.get("CONFIRMED", 0),
        "HIGH_CONFIDENCE": by_state.get("HIGH_CONFIDENCE", 0),
        "REVIEW_REQUIRED": by_state.get("REVIEW_REQUIRED", 0),
        "UNRESOLVED": by_state.get("UNRESOLVED", 0),
        "conflicts": conflicts,
        "contacts_predicted": len(contacts),
        "contacts_inserted_batches": contact_ok,
        "contact_phone_candidates": phone_n,
        "contact_address_candidates": addr_n,
        "contact_distinct_licenses": len(distinct_lic),
        "contact_duplicates_rejected": contact_dup,
        "agency_numbers_rejected": agency_rejected,
        "city_of_miami_stage_e": False,
        "stage_e": "LOADED",
    }
    OUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
