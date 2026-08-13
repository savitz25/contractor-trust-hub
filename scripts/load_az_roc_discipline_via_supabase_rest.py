#!/usr/bin/env python3
"""
Load staged Arizona ROC disciplinary actions into Supabase via PostgREST.

1) Soft-link to existing az_roc licenses by exact license number (incl. zero-padding variants).
2) For unmatched license numbers (common: Revoked not on active list), seed a thin
   contractor + license shell from the official disciplinary CSV only — no invented fields.
3) Upsert discipline_actions with contractor_id / license_id when resolved.

Usage:
  python scripts/load_az_roc_discipline_via_supabase_rest.py --staging-dir data/staging/az_roc
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
SOURCE_SYSTEM = "az_roc"
SOURCE_URL = "https://roc.az.gov/posting-list"
LICENSE_SOURCE = "az_roc"


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


def license_number_keys(raw: str) -> list[str]:
    n = (raw or "").strip()
    if not n:
        return []
    keys = [n]
    stripped = n.lstrip("0") or "0"
    if stripped != n:
        keys.append(stripped)
    if stripped.isdigit() and len(stripped) < 6:
        keys.append(stripped.zfill(6))
    return list(dict.fromkeys(keys))


def class_code_from_type(license_type: str) -> str:
    """Extract leading code from 'CR-39 Air Conditioning…' → CR-39."""
    t = (license_type or "").strip()
    if not t:
        return "ROC"
    m = re.match(r"^([A-Za-z0-9-]+)", t)
    return m.group(1) if m else "ROC"


def status_from_disposition(disp: str) -> tuple[str, str]:
    d = (disp or "").strip().upper()
    if d in {"REVOKED", "SUSPENDED", "CANCELLED", "CANCELED", "EXPIRED"}:
        return disp.strip() or d.title(), "inactive"
    if d in {"ACTIVE", "CURRENT"}:
        return disp.strip() or "Active", "active"
    return disp.strip() or "Disciplinary action", "inactive"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--staging-dir", type=Path, default=ROOT / "data/staging/az_roc")
    ap.add_argument("--batch-size", type=int, default=200)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument(
        "--no-seed-missing",
        action="store_true",
        help="Do not create thin license shells for discipline-only license numbers",
    )
    args = ap.parse_args()

    disc_path = args.staging_dir / "discipline_normalized.csv"
    if not disc_path.is_file():
        print(f"Missing {disc_path}", file=sys.stderr)
        print(
            "Run: python -m ingest.adapters.az_roc_discipline --input data/raw/az_roc/ROC_Disciplinary-Actions_….csv",
            file=sys.stderr,
        )
        return 1

    base, key = load_json_env()
    rows = list(csv.DictReader(disc_path.open(encoding="utf-8")))
    if args.limit:
        rows = rows[: args.limit]
    print(f"Loading {len(rows)} AZ ROC discipline rows → {base}")

    manifest = {}
    mp = args.staging_dir / "discipline_batch_manifest.json"
    if mp.exists():
        manifest = json.loads(mp.read_text(encoding="utf-8"))

    batch_body = {
        "source_system": SOURCE_SYSTEM,
        "source_dataset": manifest.get("source_dataset") or "roc_disciplinary_actions",
        "source_url": manifest.get("source_url") or SOURCE_URL,
        "source_file": str(disc_path.as_posix()),
        "extracted_at": manifest.get("extracted_at") or datetime.now(timezone.utc).isoformat(),
        "row_count": len(rows),
        "checksum_sha256": manifest.get("checksum_sha256"),
        "notes": manifest.get("notes")
        or "AZ ROC disciplinary actions posting-list load via PostgREST",
    }
    _, raw, _ = rest(
        base, key, "POST", "ingest_batches", batch_body, {"Prefer": "return=representation"}
    )
    batch_id = json.loads(raw)[0]["id"]
    print(f"ingest_batch {batch_id}")

    all_nums: list[str] = []
    for r in rows:
        all_nums.extend(license_number_keys(r.get("license_number_raw") or ""))
    all_nums = sorted(set(all_nums))

    lic_map: dict[str, dict[str, str]] = {}

    def refresh_lic_map(nums: list[str]) -> None:
        for i in range(0, len(nums), 40):
            chunk = nums[i : i + 40]

            def q(s: str) -> str:
                return '"' + s.replace('"', "") + '"'

            filt = ",".join(q(s) for s in chunk)
            path = (
                f"licenses?select=id,license_number,contractor_id"
                f"&source_system=eq.{LICENSE_SOURCE}&license_number=in.({filt})"
            )
            _, body, _ = rest(base, key, "GET", path)
            for row in json.loads(body):
                ln = (row.get("license_number") or "").strip()
                if not ln or not row.get("contractor_id"):
                    continue
                for k in license_number_keys(ln):
                    lic_map[k] = {
                        "id": row["id"],
                        "contractor_id": row["contractor_id"],
                        "license_number": ln,
                    }

    refresh_lic_map(all_nums)
    matched_before_seed = sum(
        1
        for r in rows
        if any(k in lic_map for k in license_number_keys(r.get("license_number_raw") or ""))
    )
    print(
        f"Matched existing az_roc licenses for {matched_before_seed}/{len(rows)} "
        f"discipline rows ({len(lic_map)} keys)"
    )

    # Seed thin shells for license numbers only present on disciplinary file
    if not args.no_seed_missing:
        # Prefer one representative row per license number
        by_lic: dict[str, dict] = {}
        for r in rows:
            ln = (r.get("license_number_raw") or "").strip()
            if not ln:
                continue
            if any(k in lic_map for k in license_number_keys(ln)):
                continue
            # keep first / prefer Revoked as published
            if ln not in by_lic:
                by_lic[ln] = r

        contractors: list[dict] = []
        licenses: list[dict] = []
        seen_slug: set[str] = set()
        for ln, r in by_lic.items():
            name = (r.get("respondent_name") or f"ROC license {ln}").strip()
            external_key = f"AZ-ROC:{ln}"
            slug = slugify("az", external_key, name)
            primary_status, status_norm = status_from_disposition(r.get("disposition") or "")
            class_code = class_code_from_type(r.get("license_type") or "")
            occ_desc = (r.get("license_type") or "Arizona ROC contractor").strip()
            city = r.get("city") or None
            state = ((r.get("state") or "AZ")[:2].upper()) if r.get("state") else "AZ"
            if slug not in seen_slug:
                seen_slug.add(slug)
                contractors.append(
                    {
                        "slug": slug,
                        "display_name": name,
                        "legal_name": name,
                        "dba_name": None,
                        "home_state": state,
                        "primary_city": city,
                        "primary_county": None,
                        # Must be searchable (product queries filter is_thin_profile = FALSE)
                        "is_thin_profile": False,
                    }
                )
            licenses.append(
                {
                    "_slug": slug,
                    "source_system": SOURCE_SYSTEM,
                    "source_board": "ROC",
                    "external_key": external_key,
                    "occupation_code": class_code,
                    "occupation_description": occ_desc,
                    "license_number": ln,
                    "class_code": class_code,
                    "licensee_name_raw": name,
                    "dba_name_raw": None,
                    "primary_status": primary_status,
                    "secondary_status": (
                        f"From ROC disciplinary actions list · {primary_status}. "
                        "Not on current active posting list. Confirm standing on ROC search."
                    )[:500],
                    "status_normalized": status_norm,
                    "address_line_1": r.get("address_line_1") or None,
                    "city": city,
                    "state": state,
                    "postal_code": r.get("postal_code") or None,
                    "board_number": "ROC",
                    "raw_payload": {
                        "seeded_from": "roc_disciplinary_actions",
                        "disposition": r.get("disposition"),
                        "case_number": r.get("complaint_number"),
                    },
                    "ingest_batch_id": batch_id,
                }
            )

        print(f"Seeding {len(contractors)} thin contractors / {len(licenses)} licenses from discipline CSV")
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
            print(f"seed contractors {min(i + bs, len(contractors))}/{len(contractors)}")

        slug_to_id: dict[str, str] = {}
        slugs = list(seen_slug)
        for i in range(0, len(slugs), 40):
            chunk = slugs[i : i + 40]

            def q(s: str) -> str:
                return '"' + s.replace('"', "") + '"'

            filt = ",".join(q(s) for s in chunk)
            _, body, _ = rest(base, key, "GET", f"contractors?select=id,slug&slug=in.({filt})")
            for row in json.loads(body):
                slug_to_id[row["slug"]] = row["id"]

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
            print(f"seed licenses {min(i + bs, len(lic_payloads))}/{len(lic_payloads)}")

        # Re-resolve license map including seeds
        refresh_lic_map(all_nums)
        print(f"License keys after seed: {len(lic_map)}")

    payloads: list[dict] = []
    linked = 0
    unlinked = 0
    for d in rows:
        dkey = (d.get("external_key") or "").strip()
        if not dkey:
            continue
        ln_raw = (d.get("license_number_raw") or "").strip()
        match = None
        for k in license_number_keys(ln_raw):
            if k in lic_map:
                match = lic_map[k]
                break
        if match:
            linked += 1
        else:
            unlinked += 1
        try:
            raw_payload = json.loads(d.get("raw_payload_json") or "{}")
        except json.JSONDecodeError:
            raw_payload = {"_raw": d.get("raw_payload_json")}

        payload: dict = {
            "source_system": d.get("source_system") or SOURCE_SYSTEM,
            "source_dataset": d.get("source_dataset") or "roc_disciplinary_actions",
            "external_key": dkey,
            "complaint_number": d.get("complaint_number") or None,
            "license_type": d.get("license_type") or None,
            "license_number_raw": ln_raw or None,
            "respondent_name": (d.get("respondent_name") or "Unknown").strip(),
            "classification": d.get("classification") or None,
            "entered_date": parse_date(d.get("entered_date")),
            "disposition": d.get("disposition") or None,
            "disposition_date": parse_date(d.get("disposition_date")),
            "discipline_description": d.get("discipline_description") or None,
            "violation_code": d.get("violation_code") or None,
            "address_line_1": d.get("address_line_1") or None,
            "city": d.get("city") or None,
            "state": ((d.get("state") or "AZ")[:2].upper() if d.get("state") else "AZ"),
            "postal_code": d.get("postal_code") or None,
            "county_name": d.get("county_name") or None,
            "raw_payload": raw_payload if isinstance(raw_payload, dict) else {},
            "ingest_batch_id": batch_id,
        }
        if match:
            payload["contractor_id"] = match["contractor_id"]
            payload["license_id"] = match["id"]
        payloads.append(payload)

    bs = args.batch_size
    for i in range(0, len(payloads), bs):
        chunk = payloads[i : i + bs]
        rest(
            base,
            key,
            "POST",
            "discipline_actions?on_conflict=source_system,external_key",
            chunk,
            {"Prefer": "resolution=merge-duplicates,return=minimal"},
        )
        print(f"discipline {min(i + bs, len(payloads))}/{len(payloads)}")

    print(
        f"linked={linked} unlinked={unlinked} "
        f"link_rate={linked / max(len(payloads), 1):.1%} "
        f"matched_active_before_seed={matched_before_seed}"
    )

    _, _, headers = rest(
        base,
        key,
        "GET",
        "discipline_actions?source_system=eq.az_roc&source_dataset=eq.roc_disciplinary_actions&select=id&limit=1",
        extra_headers={"Prefer": "count=exact"},
    )
    print("az_roc discipline", headers.get("Content-Range") or headers.get("content-range"))

    _, _, h2 = rest(
        base,
        key,
        "GET",
        "discipline_actions?source_system=eq.az_roc&source_dataset=eq.roc_disciplinary_actions&contractor_id=not.is.null&select=id&limit=1",
        extra_headers={"Prefer": "count=exact"},
    )
    print(
        "az_roc discipline linked to contractor",
        h2.get("Content-Range") or h2.get("content-range"),
    )

    _, _, h3 = rest(
        base,
        key,
        "GET",
        "licenses?source_system=eq.az_roc&select=id&limit=1",
        extra_headers={"Prefer": "count=exact"},
    )
    print("az_roc licenses total", h3.get("Content-Range") or h3.get("content-range"))
    print("DONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
