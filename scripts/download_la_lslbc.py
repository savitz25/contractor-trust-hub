#!/usr/bin/env python3
"""
Download official LSLBC public contractor rosters.

Source: https://arlspublic.lslbc.louisiana.gov/Public/RequestRoster
POST /Public/_RequestRoster/ returns a $0.00 CSV pointer.

The public form only offers Active status. Trade classifications and
qualifying-party names are not on this roster export.

Usage:
  python scripts/download_la_lslbc.py
  python scripts/download_la_lslbc.py --types commercial,residential
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

USER_AGENT = "ContractorTrustHub/0.1 (research; https://github.com/savitz25/contractor-trust-hub)"
BASE = "https://arlspublic.lslbc.louisiana.gov"
POST_URL = f"{BASE}/Public/_RequestRoster/"
ROSTER_PAGE = f"{BASE}/Public/RequestRoster"
SEARCH_URL = f"{BASE}/Public/Search"
VERIFY_PAGE = "https://lslbc.gov/verify-licensure/"

# AccountTypeID 20 = License/Registration (not inspector credentials).
LICENSE_TYPES: dict[str, tuple[str, str, str]] = {
    "commercial": ("23", "Commercial License Certificate", "commercial_active.csv"),
    "residential": ("25", "Residential License Certificate", "residential_active.csv"),
    "home_improvement": ("27", "Home Improvement Registration", "home_improvement_active.csv"),
    "mold": ("45", "Mold Remediation License Certificate", "mold_remediation_active.csv"),
}

KEEP_FIELDS = [
    "LicenseNumber",
    "CompanyName",
    "Credential Type",
    "Status",
    "MailingAddress1",
    "MailingAddress2",
    "City",
    "StateCode",
    "ZipCode",
    "Phone",
    "Parish",
    "EffectiveDate",
    "ExpirationDate",
    "FirstEffectiveDate",
    "OutOfStateFlag",
    "Email",
]


def _abs_uri(uri: str) -> str:
    uri = (uri or "").replace("\\", "/").strip()
    if not uri:
        return ""
    if uri.startswith("http"):
        return uri
    if uri.startswith("/"):
        return BASE + uri
    return BASE + "/" + uri.lstrip("/")


def request_roster(definition_id: str) -> tuple[dict, bytes]:
    fields = [
        ("AccountTypeID", "20"),
        ("AccountDefinitionIdnt", definition_id),
        ("StatusTypes", "1"),
        ("SystemCountyIdnts", ""),
    ]
    data = urllib.parse.urlencode(fields).encode("utf-8")
    req = urllib.request.Request(
        POST_URL,
        data=data,
        method="POST",
        headers={
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": ROSTER_PAGE,
            "Origin": BASE,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Roster POST HTTP {e.code}: {e.read()[:300]!r}") from e
    if not payload.get("Success"):
        raise SystemExit(f"Roster request failed: {payload.get('ErrorText')}")
    uri = _abs_uri(str(payload.get("RosterFileUri") or ""))
    if not uri:
        raise SystemExit(f"No RosterFileUri in response: {payload}")
    req2 = urllib.request.Request(uri, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req2, timeout=180) as resp:
        return payload, resp.read()


def parse_csv(raw: bytes) -> list[dict[str, str]]:
    text = raw.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    rows: list[dict[str, str]] = []
    for row in reader:
        rows.append({k: (row.get(k) or "").strip() for k in (reader.fieldnames or [])})
    return rows


def write_csv(path: Path, rows: list[dict[str, str]]) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=KEEP_FIELDS, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k) or "" for k in KEEP_FIELDS})
    return {
        "path": str(path).replace("\\", "/"),
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "row_count": len(rows),
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Download official LSLBC contractor rosters")
    p.add_argument("--out-dir", type=Path, default=Path("data/raw/la_lslbc"))
    p.add_argument(
        "--types",
        default="commercial,residential,home_improvement,mold",
        help="Comma-separated: commercial,residential,home_improvement,mold",
    )
    args = p.parse_args(argv)

    wanted = [t.strip().lower() for t in args.types.split(",") if t.strip()]
    unknown = [t for t in wanted if t not in LICENSE_TYPES]
    if unknown:
        raise SystemExit(f"Unknown types: {unknown}. Use {list(LICENSE_TYPES)}")

    print("Louisiana LSLBC official Request Roster")
    print(f"Portal: {ROSTER_PAGE}")
    combined: list[dict[str, str]] = []
    files: dict[str, dict] = {}
    by_type: dict[str, int] = {}

    for key in wanted:
        def_id, label, filename = LICENSE_TYPES[key]
        print(f"  Requesting {label} (id={def_id}) …")
        payload, raw = request_roster(def_id)
        rows = parse_csv(raw)
        dest = args.out_dir / filename
        info = write_csv(dest, rows)
        qty = payload.get("OnlineFeeQuantity")
        print(f"    {len(rows)} rows (board count {qty}) → {dest}")
        files[key] = {**info, "board_quantity": qty, "definition_id": def_id, "label": label}
        by_type[label] = len(rows)
        combined.extend(rows)

    dest_all = args.out_dir / "lslbc_contractor_roster.csv"
    all_info = write_csv(dest_all, combined)
    print(f"Wrote combined {len(combined)} rows → {dest_all}")

    manifest = {
        "source_system": "la_lslbc",
        "portal_url": ROSTER_PAGE,
        "post_endpoint": POST_URL,
        "verify_url": SEARCH_URL,
        "consumer_verify_page": VERIFY_PAGE,
        "status_filter": "Active (StatusTypes=1 — only status offered on the public form)",
        "row_count": len(combined),
        "by_type": by_type,
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
        "files": {"combined": all_info, **files},
        "coverage_note": (
            "Official LSLBC public Request Roster CSVs. Active licenses only. "
            "Commercial / residential / home improvement / mold types as published. "
            "Trade classifications and qualifying parties are not on this export. "
            "No bond, insurance, or discipline fields."
        ),
    }
    mpath = args.out_dir / "download_manifest.json"
    mpath.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {mpath}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
