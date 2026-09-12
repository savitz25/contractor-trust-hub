#!/usr/bin/env python3
"""Acquire bounded ACRIS Real Property Master + Legals and join exact BBLs."""
from __future__ import annotations

import gzip
import hashlib
import json
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "new-york" / "nyc-con-003"
OUT.mkdir(parents=True, exist_ok=True)
UA = "ContractorTrustHub-NYC-CON-003A/1.0"
BASE = "https://data.cityofnewyork.us"
PAGE = 50000
WINDOW_START = "2024-09-12"
WINDOW_END = "2026-09-12"
MASTER_FIELDS = "document_id,crfn,recorded_borough,doc_type,document_date,document_amt,recorded_datetime"
LEGAL_FIELDS = "document_id,borough,block,lot,property_type,street_number,street_name,unit"
DEED_TYPES = {"DEED", "DEED, TS", "DEED, LE", "DEEDO", "CORRD", "TODD"}
MORTGAGE_TYPES = {"MTGE", "M&CON", "MCON", "CORRM"}
ASSIGNMENT_TYPES = {"ASST", "ASPM"}
SATISFACTION_TYPES = {"SAT"}
RELEASE_TYPES = {"REL", "PREL"}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def get_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        return resp.read()


def soda(dataset: str, params: dict, attempts: int = 4) -> list[dict]:
    url = f"{BASE}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    last: Exception | None = None
    for i in range(attempts):
        try:
            raw = get_bytes(url)
            rows = json.loads(raw.decode("utf-8"))
            if not isinstance(rows, list):
                raise SystemExit(f"{dataset} unexpected payload")
            return rows
        except Exception as exc:
            last = exc
            print(f"  retry {i + 1}/{attempts} {dataset} {exc}")
            time.sleep(2 + i * 3)
    raise SystemExit(f"{dataset} failed: {last}")


def view_meta(dataset_id: str) -> dict:
    view = json.loads(get_bytes(f"{BASE}/api/views/{dataset_id}.json").decode("utf-8"))
    ts = view.get("rowsUpdatedAt")
    return {
        "dataset_id": dataset_id,
        "dataset_name": view.get("name"),
        "attribution": view.get("attribution"),
        "rowsUpdatedAt_unix": ts,
        "rowsUpdatedAt": datetime.fromtimestamp(int(ts), tz=timezone.utc).date().isoformat() if ts else None,
        "viewLastModified_unix": view.get("viewLastModified"),
    }


def paginate(dataset: str, params: dict) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        page = dict(params)
        page["$limit"] = str(PAGE)
        page["$offset"] = str(offset)
        chunk = soda(dataset, page)
        rows.extend(chunk)
        print(f"  {dataset} +{len(chunk)} total={len(rows)}")
        if len(chunk) < PAGE:
            break
        offset += PAGE
        time.sleep(0.12)
    return rows


def write_gz(path: Path, rows: list[dict]) -> dict:
    payload = json.dumps(rows, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
    gz = gzip.compress(payload)
    path.write_bytes(gz)
    return {"path": str(path.relative_to(ROOT)).replace("\\", "/"), "raw_bytes": len(payload), "gz_bytes": len(gz), "sha256": hashlib.sha256(gz).hexdigest(), "rows": len(rows)}


def load_gz(path: Path) -> list[dict]:
    return json.loads(gzip.decompress(path.read_bytes()).decode("utf-8"))


def norm_bbl(borough: object, block: object, lot: object) -> str | None:
    try:
        b = int(float(str(borough)))
        k = int(float(str(block)))
        t = int(float(str(lot)))
    except (TypeError, ValueError):
        return None
    if b < 1 or b > 5 or k < 0 or t < 0:
        return None
    return f"{b}{k:05d}{t:04d}"


def dob_bbls() -> set[str]:
    out: set[str] = set()
    for name, field in (("dobnow-permits.json.gz", "bbl"), ("legacy-permits.json.gz", "bbl")):
        path = ROOT / "data" / "new-york" / "nyc-con-002" / name
        for row in load_gz(path):
            raw = str(row.get(field) or "").split(".")[0]
            digits = "".join(ch for ch in raw if ch.isdigit())
            if digits:
                out.add(digits.zfill(10)[-10:])
    return out


def display_group(doc_type: str) -> str:
    if doc_type in DEED_TYPES:
        return "deed"
    if doc_type in MORTGAGE_TYPES:
        return "mortgage"
    if doc_type in ASSIGNMENT_TYPES:
        return "assignment"
    if doc_type in SATISFACTION_TYPES:
        return "satisfaction"
    if doc_type in RELEASE_TYPES:
        return "release"
    return "other"


def main() -> None:
    retrieved = utc_now()
    master_path = OUT / "acris-master.json.gz"
    legal_path = OUT / "acris-legals.json.gz"
    print("MASTER")
    master_meta = view_meta("bnx9-e6tj")
    if master_path.is_file():
        master = load_gz(master_path)
        print("  reused", len(master))
    else:
        master = paginate(
            "bnx9-e6tj",
            {
                "$select": MASTER_FIELDS,
                "$where": f"recorded_datetime >= '{WINDOW_START}T00:00:00.000'",
            },
        )
        write_gz(master_path, master)
    master_ids = {str(r.get("document_id") or "").strip() for r in master if str(r.get("document_id") or "").strip()}
    print("master ids", len(master_ids))

    print("LEGALS")
    legal_meta = view_meta("8h5j-fqxa")
    if legal_path.is_file():
        legals = load_gz(legal_path)
        print("  reused", len(legals))
    else:
        scanned = 0
        kept: list[dict] = []
        months = [ym for y in (2024, 2025, 2026) for m in range(1, 13) for ym in [f"{y}{m:02d}"] if "202409" <= ym <= "202609"]
        for ym in months:
            offset = 0
            while True:
                chunk = soda(
                    "8h5j-fqxa",
                    {
                        "$select": LEGAL_FIELDS,
                        "$where": f"document_id like '{ym}%'",
                        "$limit": str(PAGE),
                        "$offset": str(offset),
                    },
                )
                scanned += len(chunk)
                for row in chunk:
                    if str(row.get("document_id") or "").strip() in master_ids:
                        kept.append(row)
                print(f"  {ym} +{len(chunk)} scanned {scanned} kept {len(kept)}")
                if len(chunk) < PAGE:
                    break
                offset += PAGE
                time.sleep(0.1)
        old_ids = [i for i in master_ids if i < "20240912"]
        print("old document_ids for extra legal fetch", len(old_ids))
        for i in range(0, len(old_ids), 25):
            batch = old_ids[i : i + 25]
            quoted = ",".join(f"'{x}'" for x in batch)
            extra = soda("8h5j-fqxa", {"$select": LEGAL_FIELDS, "$where": f"document_id in ({quoted})", "$limit": str(PAGE)})
            kept.extend(extra)
            if i % 250 == 0:
                print(f"  extra legals {i}/{len(old_ids)} kept {len(kept)}")
            time.sleep(0.08)
        legals = kept
        write_gz(legal_path, legals)

    doc_bbls: dict[str, set[str]] = defaultdict(set)
    legal_rows_by_doc: Counter[str] = Counter()
    legal_bbls: set[str] = set()
    invalid_legal = 0
    si_legal = 0
    condo_unit = 0
    docs_with_unit: set[str] = set()
    property_types: Counter[str] = Counter()
    addr_bbls: dict[tuple[str, str, str], set[str]] = defaultdict(set)
    for row in legals:
        did = str(row.get("document_id") or "").strip()
        legal_rows_by_doc[did] += 1
        property_types[str(row.get("property_type") or "").strip() or "(blank)"] += 1
        bbl = norm_bbl(row.get("borough"), row.get("block"), row.get("lot"))
        if not bbl:
            invalid_legal += 1
            continue
        legal_bbls.add(bbl)
        doc_bbls[did].add(bbl)
        if str(row.get("borough")) in {"5", "5.0"}:
            si_legal += 1
        if str(row.get("unit") or "").strip():
            condo_unit += 1
            docs_with_unit.add(did)
        street_no = str(row.get("street_number") or "").strip()
        street = str(row.get("street_name") or "").strip().upper()
        borough = str(row.get("borough") or "").strip()
        if street_no and street and borough:
            addr_bbls[(borough, street_no, street)].add(bbl)

    docs_with_bbl = {d for d, s in doc_bbls.items() if s}
    multi = {d: len(s) for d, s in doc_bbls.items() if len(s) > 1}
    one = sum(1 for s in doc_bbls.values() if len(s) == 1)
    multi_legal = {d: n for d, n in legal_rows_by_doc.items() if n > 1}
    same_addr_multi = {k: v for k, v in addr_bbls.items() if len(v) > 1}
    spine = dob_bbls()
    acris_in_spine = legal_bbls & spine
    type_counts = Counter(str(r.get("doc_type") or "").strip() or "(blank)" for r in master)
    group_counts: Counter[str] = Counter()
    for row in master:
        group_counts[display_group(str(row.get("doc_type") or "").strip())] += 1
    recorded_boroughs = Counter(str(r.get("recorded_borough") or "") for r in master)
    docs_without_legal = len(master_ids - {str(r.get("document_id") or "").strip() for r in legals})

    report = {
        "ticket": "NYC-CON-003A",
        "snapshot_version": "contractor-nyc-acris-intel-v1",
        "window_start": WINDOW_START,
        "window_end": WINDOW_END,
        "date_field": "recorded_datetime",
        "date_field_why": "Official RECORDED / FILED timestamp is the consumer-relevant recording date. document_date can predate recording and is not the window basis.",
        "acquired_at": retrieved,
        "master": {
            **master_meta,
            "source_url": "https://data.cityofnewyork.us/City-Government/ACRIS-Real-Property-Master/bnx9-e6tj",
            "resource_url": f"{BASE}/resource/bnx9-e6tj.json",
            "where": f"recorded_datetime >= '{WINDOW_START}T00:00:00.000'",
            "select": MASTER_FIELDS,
            "retrievedAt": retrieved,
            **(write_gz(master_path, master) if not master_path.is_file() else {
                "path": str(master_path.relative_to(ROOT)).replace("\\", "/"),
                "raw_bytes": master_path.stat().st_size,
                "gz_bytes": master_path.stat().st_size,
                "sha256": hashlib.sha256(master_path.read_bytes()).hexdigest(),
                "rows": len(master),
            }),
            "parsed_rows": len(master),
            "distinct_document_ids": len(master_ids),
            "doc_type_counts": dict(type_counts.most_common(40)),
            "display_group_counts": dict(group_counts),
            "recorded_borough_counts": dict(recorded_boroughs),
            "recorded_min": min((str(r.get("recorded_datetime") or "")[:10] for r in master if r.get("recorded_datetime")), default=None),
            "recorded_max": max((str(r.get("recorded_datetime") or "")[:10] for r in master if r.get("recorded_datetime")), default=None),
        },
        "legals": {
            **legal_meta,
            "source_url": "https://data.cityofnewyork.us/City-Government/ACRIS-Real-Property-Legals/8h5j-fqxa",
            "resource_url": f"{BASE}/resource/8h5j-fqxa.json",
            "where": "document_id >= '20240912' kept if in bounded master set, plus IN-fetch for older master IDs",
            "select": LEGAL_FIELDS,
            "retrievedAt": retrieved,
            "parsed_rows": len(legals),
            "invalid_bbl_rows": invalid_legal,
            "staten_island_property_rows": si_legal,
            "rows_with_unit": condo_unit,
            "property_type_counts": dict(property_types.most_common(30)),
        },
        "linking": {
            "documents_with_legal_rows": len({str(r.get("document_id") or "").strip() for r in legals}),
            "documents_without_legal_rows": docs_without_legal,
            "distinct_bbls": len(legal_bbls),
            "documents_with_bbl": len(docs_with_bbl),
            "documents_with_1_bbl": one,
            "documents_with_gt1_bbl": len(multi),
            "max_bbls_per_document": max(multi.values()) if multi else 1,
            "documents_with_gt1_legal_row": len(multi_legal),
            "max_legal_rows_per_document": max(legal_rows_by_doc.values()) if legal_rows_by_doc else 0,
            "documents_with_unit_legal_row": len(docs_with_unit),
            "addresses_with_gt1_bbl": len(same_addr_multi),
            "acris_bbls_in_permit_spine": len(acris_in_spine),
            "acris_bbls_not_in_permit_spine": len(legal_bbls - spine),
            "permit_bbls_with_acris": len(acris_in_spine),
            "permit_spine_bbls": len(spine),
            "name_only": "UNSAFE",
            "address_only": "REJECTED",
        },
        "multi_lot": {
            "documents_with_1_legal_row": sum(1 for n in legal_rows_by_doc.values() if n == 1),
            "documents_with_gt1_legal_row": len(multi_legal),
            "max_legal_rows_per_document": max(legal_rows_by_doc.values()) if legal_rows_by_doc else 0,
            "documents_with_1_bbl": one,
            "documents_with_gt1_bbl": len(multi),
            "max_bbls_per_document": max(multi.values()) if multi else 1,
            "legal_rows_with_unit": condo_unit,
            "documents_with_unit_legal_row": len(docs_with_unit),
            "property_type_counts": dict(property_types.most_common(30)),
            "addresses_with_gt1_bbl": len(same_addr_multi),
            "max_bbls_per_address": max((len(v) for v in same_addr_multi.values()), default=1),
            "no_source_native_condo_flag": True,
            "note": "ACRIS Legals has unit and property_type, not a condo_flag. Unit-populated legal rows are the source-native condo/unit signal.",
        },
        "coverage": {
            "recorded_borough_5_staten_island": int(recorded_boroughs.get("5", 0)),
            "staten_island_recording_office": "ABSENT",
            "staten_island_property_legal_rows": si_legal,
            "coverage_state": "PARTIAL",
            "staten_island_note": "ACRIS recorded_borough has no Richmond County (5) filings in this window. Some legal rows reference borough 5 properties recorded elsewhere. Not a Richmond County Clerk extract.",
        },
        "no_parties_acquired": True,
        "no_acris_images": True,
        "no_title_chain": True,
        "no_hpd": True,
    }
    def artifact_meta(path: Path, rows: list[dict]) -> dict:
        return {
            "path": str(path.relative_to(ROOT)).replace("\\", "/"),
            "gz_bytes": path.stat().st_size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "rows": len(rows),
        }

    report["legals"].update(artifact_meta(legal_path, legals))
    report["master"].update(artifact_meta(master_path, master))
    (OUT / "acquire-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "master": len(master),
        "legals": len(legals),
        "bbls": len(legal_bbls),
        "multi": len(multi),
        "spine_overlap": len(acris_in_spine),
        "si_legal": si_legal,
        "deeds": group_counts["deed"],
        "mtge": group_counts["mortgage"],
    }, indent=2))


if __name__ == "__main__":
    main()
