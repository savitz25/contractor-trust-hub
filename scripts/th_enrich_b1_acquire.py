"""Acquire only the eight B1 contractor sources listed in the pre-ingest inventory."""
from __future__ import annotations

import hashlib
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "docs" / "TH-ENRICH-2026-09-30-B1-preingest.json"
RAW = ROOT / "data" / "raw" / "th_enrich_b1"
AGENT = "TrustHub-enrichment/1.0 (public research)"


def acquire(source: dict) -> dict:
    filename = source.get("file") or source["dataset_id"] + ".csv"
    filename = filename.replace(" ", "_")
    target = RAW / filename
    if target.exists():
        raise FileExistsError(f"Refusing to overwrite immutable snapshot: {target}")
    url = source["official_url"]
    if source.get("dataset_id"):
        url += "?$limit=500000"
    req = Request(url, headers={"User-Agent": AGENT})
    digest = hashlib.sha256()
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        with urlopen(req, timeout=180) as response, target.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
                digest.update(chunk)
            content_type = response.headers.get("Content-Type")
            last_modified = response.headers.get("Last-Modified")
    except Exception:
        target.unlink(missing_ok=True)
        raise
    return {**source, "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "retrieved_url": url, "local_file": str(target.relative_to(ROOT)).replace("\\", "/"),
            "bytes": target.stat().st_size, "sha256": digest.hexdigest(),
            "content_type": content_type, "last_modified": last_modified}


if __name__ == "__main__":
    sources = json.loads(MANIFEST.read_text(encoding="utf-8"))["sources"]
    results = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(acquire, row): row["id"] for row in sources if not row["existing_owned"]}
        for future in as_completed(futures):
            try:
                result = future.result()
                print("OK", result["id"], result["bytes"], result["sha256"], flush=True)
                results.append(result)
            except Exception as error:
                print("FAIL", futures[future], repr(error), flush=True)
                results.append({"id": futures[future], "error": repr(error)})
    output = ROOT / "docs" / "TH-ENRICH-2026-09-30-B1-retrieval.json"
    output.write_text(json.dumps(sorted(results, key=lambda x: x["id"]), indent=2), encoding="utf-8")
    print("Manifest", output)
