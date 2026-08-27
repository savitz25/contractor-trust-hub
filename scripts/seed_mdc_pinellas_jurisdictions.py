#!/usr/bin/env python3
"""Apply proposed Miami-Dade + Pinellas AHJ metadata via PostgREST.

Idempotent upsert. Metadata only — never permit activity.
Does not touch Broward / Palm Beach rows except by unique-key isolation.
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ingest.env import load_dotenv_files  # noqa: E402

SEED = ROOT / "docs/intelligence/enhanced-county/proposed-seed-miami-dade-pinellas-jurisdictions.json"


def load_env() -> tuple[str, str]:
    import os

    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    url = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not url or not key:
        raise SystemExit("Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY")
    return url, key


def rest(url: str, key: str, method: str, path: str, body=None, extra=None, query: str = "") -> tuple[int, str, dict]:
    headers = {
        "apikey": key,
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    if extra:
        headers.update(extra)
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url + "/rest/v1/" + path + query, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status, resp.read().decode("utf-8"), dict(resp.headers)
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP {e.code} {path}: {err[:800]}") from e


def count(url: str, key: str, query: str) -> int:
    req = urllib.request.Request(url + "/rest/v1/enhanced_jurisdictions" + query + "&select=id", method="GET")
    req.add_header("apikey", key)
    req.add_header("Authorization", "Bearer " + key)
    req.add_header("Prefer", "count=exact")
    req.add_header("Range", "0-0")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            cr = r.headers.get("Content-Range", "")
    except urllib.error.HTTPError as e:
        cr = e.headers.get("Content-Range", "") if e.headers else ""
        if not cr:
            raise
    tail = cr.split("/")[-1] if cr and "/" in cr else ""
    if not tail.isdigit():
        raise SystemExit(f"count failed: {cr!r}")
    return int(tail)


def validate(payload: dict) -> list[dict]:
    rows = payload["rows"]
    # Prompt 1 JSON is marked do_not_seed_production. Prompt 2 is the apply authorization.
    mdc = [r for r in rows if r["county_slug"] == "miami-dade"]
    pin = [r for r in rows if r["county_slug"] == "pinellas"]
    other = [r for r in rows if r["county_slug"] not in {"miami-dade", "pinellas"}]
    if other:
        raise SystemExit(f"unexpected counties in proposed seed: {sorted({r['county_slug'] for r in other})}")
    if len(mdc) != 35:
        raise SystemExit(f"miami-dade rows {len(mdc)} != 35")
    if len(pin) != 25:
        raise SystemExit(f"pinellas rows {len(pin)} != 25")
    for county, group, expect_muni, expect_uninc in (
        ("miami-dade", mdc, 34, 1),
        ("pinellas", pin, 24, 1),
    ):
        slugs = [r["jurisdiction_slug"] for r in group]
        if len(slugs) != len(set(slugs)):
            raise SystemExit(f"duplicate slugs in {county}")
        kinds = [r["kind"] for r in group]
        if kinds.count("unincorporated") != expect_uninc:
            raise SystemExit(f"{county} unincorporated count {kinds.count('unincorporated')}")
        if kinds.count("municipal") != expect_muni:
            raise SystemExit(f"{county} municipal count {kinds.count('municipal')}")
        if any(k not in {"unincorporated", "municipal"} for k in kinds):
            raise SystemExit(f"{county} unexpected kind")
        if "unincorporated" not in slugs:
            raise SystemExit(f"{county} missing unincorporated slug")
        if "islandia" in slugs:
            raise SystemExit("Islandia must not be seeded")
    return rows


def to_row(src: dict) -> dict:
    notes = (src.get("notes") or "").replace("PROPOSED SEED. ", "")
    vendor = src.get("vendor")
    if src["county_slug"] == "pinellas" and src["jurisdiction_slug"] == "belleair-bluffs":
        vendor = "SAFEbuilt (new from 2025-08-15); historical BDRS Accela"
        notes = (
            "AHJ still exists. BDRS through 2025-08-15; new permits SAFEbuilt thereafter. "
            "Open/active county permits remain with BDRS through final. Do not set coverage_end on the municipality. "
            + notes
        )
    return {
        "county_slug": src["county_slug"],
        "jurisdiction_slug": src["jurisdiction_slug"],
        "jurisdiction_label": src["jurisdiction_label"],
        "kind": src["kind"],
        "permitting_authority": src["permitting_authority"],
        "public_search_url": src.get("public_search_url"),
        "vendor": vendor,
        "agency": src.get("agency"),
        "coverage_type": src.get("coverage_type"),
        "source": "Prompt 2 seed from official county municipality lists (2026-08-26)",
        "expected_permit_authority": src.get("expected_permit_authority"),
        "data_availability": src.get("data_availability") or "none",
        "metadata_status": "seeded",
        "notes": notes + " METADATA ONLY — not permit activity. Not Enhanced.",
    }


def main() -> int:
    payload = json.loads(SEED.read_text(encoding="utf-8"))
    rows = [to_row(r) for r in validate(payload)]
    url, key = load_env()
    before = {
        "all": count(url, key, "?select=id"),
        "broward": count(url, key, "?county_slug=eq.broward"),
        "palm-beach": count(url, key, "?county_slug=eq.palm-beach"),
        "miami-dade": count(url, key, "?county_slug=eq.miami-dade"),
        "pinellas": count(url, key, "?county_slug=eq.pinellas"),
    }
    print("before", json.dumps(before))
    if before["broward"] + before["palm-beach"] != 72:
        raise SystemExit(f"refusing to seed: Broward+PBC expected 72, got {before}")
    extra = {
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    # PostgREST upsert on unique (county_slug, jurisdiction_slug)
    rest(
        url,
        key,
        "POST",
        "enhanced_jurisdictions?on_conflict=county_slug,jurisdiction_slug",
        rows,
        extra=extra,
    )
    after = {
        "all": count(url, key, "?select=id"),
        "broward": count(url, key, "?county_slug=eq.broward"),
        "palm-beach": count(url, key, "?county_slug=eq.palm-beach"),
        "miami-dade": count(url, key, "?county_slug=eq.miami-dade"),
        "pinellas": count(url, key, "?county_slug=eq.pinellas"),
        "mdc_unincorporated": count(url, key, "?county_slug=eq.miami-dade&kind=eq.unincorporated"),
        "mdc_municipal": count(url, key, "?county_slug=eq.miami-dade&kind=eq.municipal"),
        "pin_unincorporated": count(url, key, "?county_slug=eq.pinellas&kind=eq.unincorporated"),
        "pin_municipal": count(url, key, "?county_slug=eq.pinellas&kind=eq.municipal"),
    }
    print("after", json.dumps(after, indent=2))
    if after["broward"] != before["broward"] or after["palm-beach"] != before["palm-beach"]:
        raise SystemExit("Broward/Palm Beach counts changed — abort semantics")
    if after["miami-dade"] != 35 or after["pinellas"] != 25:
        raise SystemExit("seed counts mismatch")
    if after["all"] != 132:
        raise SystemExit(f"expected 132 total, got {after['all']}")
    print("SEED OK metadata only; no permit activity")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
