"""
Load staged NJ DCA licenses into Supabase via PostgREST (service role).
Used when DATABASE_URL is not available locally but Vercel SUPABASE_SERVICE_ROLE_KEY is.
Idempotent upserts on contractors.slug and licenses(source_system,external_key).
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
    # Prefer .tmp_* from vercel decrypt helper, else env
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
    ap.add_argument("--staging-dir", type=Path, default=ROOT / "data/staging/nj_dca")
    ap.add_argument("--batch-size", type=int, default=200)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument(
        "--enforcement-only",
        action="store_true",
        help="Skip license/contractor upsert; load enforcement_normalized.csv only",
    )
    args = ap.parse_args()

    lic_path = args.staging_dir / "licenses_normalized.csv"
    enf_path = args.staging_dir / "enforcement_normalized.csv"
    if not args.enforcement_only and not lic_path.is_file():
        print(f"Missing {lic_path}", file=sys.stderr)
        return 1
    if args.enforcement_only and not enf_path.is_file():
        print(f"Missing {enf_path}", file=sys.stderr)
        return 1

    base, key = load_json_env()
    rows: list[dict] = []
    if not args.enforcement_only:
        rows = list(csv.DictReader(lic_path.open(encoding="utf-8")))
        if args.limit:
            rows = rows[: args.limit]
        print(f"Loading {len(rows)} licenses via PostgREST → {base}")
    else:
        print(f"Enforcement-only load via PostgREST → {base}")

    manifest = {}
    mp = args.staging_dir / "batch_manifest.json"
    if mp.exists():
        manifest = json.loads(mp.read_text(encoding="utf-8"))

    batch_body = {
        "source_system": "nj_dca" if not args.enforcement_only else "nj_enforcement",
        "source_dataset": manifest.get("source_dataset")
        or (
            "dca_standard_files_discipline_flag"
            if args.enforcement_only
            else "contractor_hic_and_specialty_bulk"
        ),
        "source_url": manifest.get("source_url") or "https://app.box.com/v/DCAStandardFiles",
        "source_file": str(
            (enf_path if args.enforcement_only else lic_path).as_posix()
        ),
        "extracted_at": manifest.get("extracted_at") or datetime.now(timezone.utc).isoformat(),
        "row_count": len(rows) if rows else None,
        "checksum_sha256": manifest.get("checksum_sha256"),
        "notes": manifest.get("notes")
        or (
            "NJ enforcement flags load via PostgREST"
            if args.enforcement_only
            else "NJ DCA production HIC+specialty load via PostgREST service role"
        ),
    }
    status, raw, _ = rest(
        base,
        key,
        "POST",
        "ingest_batches",
        batch_body,
        {"Prefer": "return=representation"},
    )
    batch = json.loads(raw)[0]
    batch_id = batch["id"]
    print(f"ingest_batch {batch_id}")

    # Prepare contractor + license rows
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
        display = (
            (raw_payload.get("business_name") or "").strip()
            or (r.get("licensee_name_raw") or "").strip()
            or external_key
        )
        slug = slugify("nj", external_key, display)
        home_state = (r.get("state") or "NJ")[:2].upper()
        city = r.get("city") or None
        county = r.get("county_name") or None
        dba = (r.get("dba_name_raw") or "").strip() or None
        if slug not in seen_slug:
            seen_slug.add(slug)
            contractors.append(
                {
                    "slug": slug,
                    "display_name": display,
                    "legal_name": display,
                    "dba_name": dba,
                    "home_state": home_state,
                    "primary_city": city,
                    "primary_county": county,
                    "is_thin_profile": False,
                }
            )
        licenses.append(
            {
                "_slug": slug,  # temp, strip before insert
                "source_system": "nj_dca",
                "source_board": r.get("source_board") or "NJ_DCA",
                "external_key": external_key,
                "occupation_code": r.get("occupation_code") or "HIC",
                "occupation_description": r.get("occupation_description")
                or "Home Improvement Contractor",
                "license_number": r.get("license_number") or None,
                "class_code": r.get("class_code") or None,
                "licensee_name_raw": (r.get("licensee_name_raw") or display).strip(),
                "dba_name_raw": dba,
                "primary_status": r.get("primary_status") or None,
                "secondary_status": r.get("secondary_status") or None,
                "status_normalized": r.get("status_normalized") or "unknown",
                "expiration_date": parse_date(r.get("expiration_date")),
                "address_line_1": r.get("address_line_1") or None,
                "address_line_2": r.get("address_line_2") or None,
                "city": city,
                "state": home_state,
                "postal_code": r.get("postal_code") or None,
                "county_name": county,
                "board_number": r.get("board_number") or "NJ_DCA",
                "raw_payload": raw_payload if isinstance(raw_payload, dict) else {},
                "ingest_batch_id": batch_id,
            }
        )

    bs = args.batch_size
    if not args.enforcement_only and contractors:
        # Upsert contractors in batches
        for i in range(0, len(contractors), bs):
            chunk = contractors[i : i + bs]
            rest(
                base,
                key,
                "POST",
                "contractors?on_conflict=slug",
                chunk,
                {
                    "Prefer": "resolution=merge-duplicates,return=minimal",
                },
            )
            print(f"contractors {min(i+bs, len(contractors))}/{len(contractors)}")

        # Map slug → id
        slug_to_id: dict[str, str] = {}
        slugs = list(seen_slug)
        for i in range(0, len(slugs), 40):
            chunk = slugs[i : i + 40]

            def q(s: str) -> str:
                return '"' + s.replace('"', "") + '"'

            filt = ",".join(q(s) for s in chunk)
            path = f"contractors?select=id,slug&slug=in.({filt})"
            _, raw, _ = rest(base, key, "GET", path)
            for row in json.loads(raw):
                slug_to_id[row["slug"]] = row["id"]
        missing = [s for s in slugs if s not in slug_to_id]
        if missing:
            print(f"WARN missing contractor ids: {len(missing)} e.g. {missing[:3]}")
        print(f"Resolved {len(slug_to_id)} contractor ids")

        # Attach contractor_id and upsert licenses
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
            print(f"licenses {min(i+bs, len(lic_payloads))}/{len(lic_payloads)}")

    # Discipline flags → discipline_actions (soft-link by exact license_number)
    enf_path = args.staging_dir / "enforcement_normalized.csv"
    if enf_path.is_file():
        enf_rows = list(csv.DictReader(enf_path.open(encoding="utf-8")))
        print(f"Loading {len(enf_rows)} enforcement flags…")
        # Build license_number → contractor_id map for nj_dca
        lic_to_cid: dict[str, str] = {}
        # Query licenses in batches by license_number
        nums = sorted(
            {
                (r.get("license_number_raw") or "").strip().upper()
                for r in enf_rows
                if (r.get("license_number_raw") or "").strip()
            }
        )
        for i in range(0, len(nums), 40):
            chunk = nums[i : i + 40]

            def q(s: str) -> str:
                return '"' + s.replace('"', "") + '"'

            filt = ",".join(q(s) for s in chunk)
            path = (
                f"licenses?select=license_number,contractor_id,id"
                f"&source_system=eq.nj_dca&license_number=in.({filt})"
            )
            _, raw, _ = rest(base, key, "GET", path)
            for row in json.loads(raw):
                ln = (row.get("license_number") or "").strip().upper()
                if ln and row.get("contractor_id"):
                    lic_to_cid[ln] = row["contractor_id"]
        print(f"Linked license numbers for enforcement: {len(lic_to_cid)}")

        disc_payloads = []
        linked = 0
        unlinked = 0
        for d in enf_rows:
            dkey = (d.get("external_key") or "").strip()
            if not dkey:
                continue
            ln = (d.get("license_number_raw") or "").strip().upper()
            cid = lic_to_cid.get(ln)
            if cid:
                linked += 1
            else:
                unlinked += 1
            try:
                raw_payload = json.loads(d.get("raw_payload_json") or "{}")
            except json.JSONDecodeError:
                raw_payload = {"_raw": d.get("raw_payload_json")}
            payload = {
                "source_system": d.get("source_system") or "nj_enforcement",
                "source_dataset": d.get("source_dataset")
                or "dca_standard_files_discipline_flag",
                "external_key": dkey,
                "complaint_number": d.get("complaint_number") or None,
                "license_type": d.get("license_type") or None,
                "license_number_raw": d.get("license_number_raw") or None,
                "respondent_name": (d.get("respondent_name") or "Unknown").strip(),
                "classification": d.get("classification") or "public_discipline_flag",
                "entered_date": parse_date(d.get("entered_date")),
                "disposition": d.get("disposition") or None,
                "disposition_date": parse_date(d.get("disposition_date")),
                "discipline_description": d.get("discipline_description") or None,
                "violation_code": d.get("violation_code") or None,
                "city": d.get("city") or None,
                "state": (d.get("state") or "NJ")[:2] if d.get("state") else "NJ",
                "postal_code": d.get("postal_code") or None,
                "county_name": d.get("county_name") or None,
                "raw_payload": raw_payload if isinstance(raw_payload, dict) else {},
                "ingest_batch_id": batch_id,
            }
            # Soft-link only when exact license_number match on nj_dca
            if cid:
                payload["contractor_id"] = cid
            disc_payloads.append(payload)
        for i in range(0, len(disc_payloads), bs):
            chunk = disc_payloads[i : i + bs]
            rest(
                base,
                key,
                "POST",
                "discipline_actions?on_conflict=source_system,external_key",
                chunk,
                {"Prefer": "resolution=merge-duplicates,return=minimal"},
            )
            print(f"discipline {min(i+bs, len(disc_payloads))}/{len(disc_payloads)}")
        print(f"enforcement linked={linked} unlinked={unlinked}")
        _, _, headers = rest(
            base,
            key,
            "GET",
            "discipline_actions?source_system=eq.nj_enforcement&select=id&limit=1",
            extra_headers={"Prefer": "count=exact"},
        )
        print(
            "nj_enforcement",
            headers.get("Content-Range") or headers.get("content-range"),
        )
    else:
        print("No enforcement_normalized.csv — skip discipline load")

    # Final counts
    if not args.enforcement_only:
        for code in ["HIC", "ELE", "TEL", "ALM", "LCK", "PLB", "HVAC", "HRT"]:
            path = f"licenses?source_system=eq.nj_dca&occupation_code=eq.{code}&select=id&limit=1"
            _, _, headers = rest(
                base,
                key,
                "GET",
                path,
                extra_headers={"Prefer": "count=exact"},
            )
            print(code, headers.get("Content-Range") or headers.get("content-range"))
        for status in ["active", "inactive"]:
            path = f"licenses?source_system=eq.nj_dca&status_normalized=eq.{status}&select=id&limit=1"
            _, _, headers = rest(
                base,
                key,
                "GET",
                path,
                extra_headers={"Prefer": "count=exact"},
            )
            print(f"status_{status}", headers.get("Content-Range") or headers.get("content-range"))

    print("DONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
