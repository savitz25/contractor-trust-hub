#!/usr/bin/env python3
"""
Load staged California CSLB licenses into Supabase via PostgREST (service role).

Usage:
  python scripts/load_ca_cslb_via_supabase_rest.py --staging-dir data/staging/ca_cslb
  python scripts/load_ca_cslb_via_supabase_rest.py --staging-dir data/staging/ca_cslb --limit 500
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SYSTEM = "ca_cslb"
SOURCE_URL = "https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx"


def slugify(*parts: str, max_len: int = 120) -> str:
    raw = "-".join(p for p in parts if p)
    s = re.sub(r"[^a-zA-Z0-9]+", "-", raw.lower()).strip("-")
    return (s or "unknown")[:max_len]


def parse_date(value: str | None) -> str | None:
    v = (value or "").strip()
    if not v:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(v, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def load_json_env() -> tuple[str, str]:
    import os

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if Path(".tmp_URL").exists():
        url = Path(".tmp_URL").read_text(encoding="utf-8").strip()
    if Path(".tmp_SERVICE").exists():
        key = Path(".tmp_SERVICE").read_text(encoding="utf-8").strip()
    if not url or not key:
        raise SystemExit("Need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or .tmp_URL/.tmp_SERVICE)")
    return url.rstrip("/"), key


def rest(
    base: str,
    key: str,
    method: str,
    path: str,
    body: object | None = None,
    extra_headers: dict | None = None,
    retries: int = 4,
) -> tuple[int, str, dict]:
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)
    data = None if body is None else json.dumps(body).encode("utf-8")
    url = f"{base}/rest/v1/{path}"
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=data, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw = resp.read().decode("utf-8")
                return resp.status, raw, dict(resp.headers)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            if e.code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
                last_err = e
                continue
            raise SystemExit(f"HTTP {e.code} {path}: {err_body[:500]}") from e
        except Exception as e:
            last_err = e
            time.sleep(1.0 * (attempt + 1))
    raise SystemExit(f"Request failed {path}: {last_err}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--staging-dir", type=Path, default=ROOT / "data/staging/ca_cslb")
    ap.add_argument("--batch-size", type=int, default=250)
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    lic_path = args.staging_dir / "licenses_normalized.csv"
    if not lic_path.is_file():
        print(f"Missing {lic_path}", file=sys.stderr)
        return 1

    base, key = load_json_env()
    rows = list(csv.DictReader(lic_path.open(encoding="utf-8")))
    if args.limit:
        rows = rows[: args.limit]
    print(f"Loading {len(rows)} CA CSLB licenses → {base}")

    manifest = {}
    mp = args.staging_dir / "batch_manifest.json"
    if mp.exists():
        manifest = json.loads(mp.read_text(encoding="utf-8"))

    batch_body = {
        "source_system": SOURCE_SYSTEM,
        "source_dataset": manifest.get("source_dataset") or "cslb_public_data_portal_county_lists",
        "source_url": manifest.get("source_url") or SOURCE_URL,
        "source_file": str(lic_path.as_posix()),
        "extracted_at": manifest.get("extracted_at") or datetime.now(timezone.utc).isoformat(),
        "row_count": len(rows),
        "checksum_sha256": manifest.get("checksum_sha256"),
        "notes": manifest.get("notes") or "CA CSLB county-list load via PostgREST",
    }
    _, raw, _ = rest(
        base, key, "POST", "ingest_batches", batch_body, {"Prefer": "return=representation"}
    )
    batch_id = json.loads(raw)[0]["id"]
    print(f"ingest_batch {batch_id}")

    contractors: list[dict] = []
    licenses: list[dict] = []
    seen_slug: set[str] = set()
    for r in rows:
        external_key = (r.get("external_key") or "").strip()
        if not external_key:
            continue
        try:
            raw_payload = json.loads(r.get("raw_payload_json") or "{}")
        except json.JSONDecodeError:
            raw_payload = {}
        display = (r.get("licensee_name_raw") or "").strip() or external_key
        slug = slugify("ca", external_key, display)
        home_state = (r.get("state") or "CA")[:2].upper()
        city = r.get("city") or None
        county = r.get("county_name") or None
        if slug not in seen_slug:
            seen_slug.add(slug)
            contractors.append(
                {
                    "slug": slug,
                    "display_name": display,
                    "legal_name": display,
                    "dba_name": r.get("dba_name_raw") or None,
                    "home_state": home_state,
                    "primary_city": city,
                    "primary_county": county,
                    "is_thin_profile": False,
                }
            )
        licenses.append(
            {
                "_slug": slug,
                "source_system": SOURCE_SYSTEM,
                "source_board": r.get("source_board") or "CSLB",
                "external_key": external_key,
                "occupation_code": r.get("occupation_code") or "GEN",
                "occupation_description": r.get("occupation_description")
                or "California contractor",
                "license_number": r.get("license_number") or None,
                "class_code": r.get("class_code") or None,
                "licensee_name_raw": display,
                "dba_name_raw": r.get("dba_name_raw") or None,
                "primary_status": r.get("primary_status") or None,
                "secondary_status": r.get("secondary_status") or None,
                "status_normalized": r.get("status_normalized") or "unknown",
                "original_licensure_date": parse_date(r.get("original_licensure_date")),
                "expiration_date": parse_date(r.get("expiration_date")),
                "address_line_1": r.get("address_line_1") or None,
                "city": city,
                "state": home_state,
                "postal_code": r.get("postal_code") or None,
                "county_name": county,
                "board_number": r.get("board_number") or "CSLB",
                "raw_payload": raw_payload if isinstance(raw_payload, dict) else {},
                "ingest_batch_id": batch_id,
            }
        )

    bs = args.batch_size
    for i in range(0, len(contractors), bs):
        chunk = contractors[i : i + bs]
        rest(
            base,
            key,
            "POST",
            "contractors?on_conflict=slug",
            chunk,
            {"Prefer": "resolution=merge-duplicates,return=minimal"},
        )
        print(f"contractors {min(i + bs, len(contractors))}/{len(contractors)}")

    slug_to_id: dict[str, str] = {}
    slugs = list(seen_slug)
    for i in range(0, len(slugs), 40):
        chunk = slugs[i : i + 40]

        def q(s: str) -> str:
            return '"' + s.replace('"', "") + '"'

        filt = ",".join(q(s) for s in chunk)
        _, raw, _ = rest(base, key, "GET", f"contractors?select=id,slug&slug=in.({filt})")
        for row in json.loads(raw):
            slug_to_id[row["slug"]] = row["id"]
    print(f"Resolved {len(slug_to_id)} contractor ids")

    lic_payloads = []
    for lic in licenses:
        slug = lic.pop("_slug")
        cid = slug_to_id.get(slug)
        if not cid:
            continue
        lic["contractor_id"] = cid
        lic_payloads.append(lic)

    for i in range(0, len(lic_payloads), bs):
        chunk = lic_payloads[i : i + bs]
        rest(
            base,
            key,
            "POST",
            "licenses?on_conflict=source_system,external_key",
            chunk,
            {"Prefer": "resolution=merge-duplicates,return=minimal"},
        )
        print(f"licenses {min(i + bs, len(lic_payloads))}/{len(lic_payloads)}")

    _, _, headers = rest(
        base,
        key,
        "GET",
        "licenses?source_system=eq.ca_cslb&select=id&limit=1",
        extra_headers={"Prefer": "count=exact"},
    )
    print("ca_cslb", headers.get("Content-Range") or headers.get("content-range"))
    print("DONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
