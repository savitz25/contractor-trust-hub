"""Bounded extra-source probe: debarment download, public-works SODA counts."""
from __future__ import annotations

import json
import re
import ssl
import urllib.parse
import urllib.request
from pathlib import Path

CTX = ssl.create_default_context()
UA = {"User-Agent": "ContractorTrustHub/0.1 (research)"}
OUT = Path(__file__).resolve().parents[2] / "data" / "washington" / "wa-con-001"
RAW = Path(r"S:\ath-raw\wa-con-001")
if not RAW.parent.exists():
    RAW = Path(__file__).resolve().parents[2] / "data" / "raw" / "washington" / "wa-con-001"


def get(url: str, timeout: int = 90) -> tuple[bytes, dict, str]:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
        return resp.read(), dict(resp.headers), resp.geturl()


def soda(did: str, query: str):
    url = f"https://data.wa.gov/resource/{did}.json?$query={urllib.parse.quote(query)}"
    body, _, _ = get(url, timeout=120)
    return json.loads(body.decode("utf-8"))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(parents=True, exist_ok=True)
    report: dict = {}

    body, hdr, url = get("https://lni.wa.gov/ContractorDebarList")
    text = body.decode("utf-8", "replace")
    links = re.findall(r'href=["\']([^"\']+)["\']', text, flags=re.I)
    interesting = [h for h in links if any(x in h.lower() for x in ("csv", "xlsx", "download", "export", "json", "excel", "odata"))]
    report["debar_page"] = {"url": url, "bytes": len(body), "interesting_links": interesting[:40], "has_download_text": "Download all debarment data" in text}

    # try common export paths
    tried = []
    for cand in [
        "https://lni.wa.gov/ContractorDebarList/Export",
        "https://lni.wa.gov/ContractorDebarList?handler=Export",
        "https://lni.wa.gov/ContractorDebarList/Download",
        "https://secure.lni.wa.gov/debar/api/debar",
    ]:
        try:
            b, h, u = get(cand, timeout=30)
            tried.append({"url": cand, "final": u, "ctype": h.get("Content-Type"), "bytes": len(b)})
            if "csv" in (h.get("Content-Type") or "") or b.startswith(b"Company") or b[:20].lower().startswith(b"company"):
                dest = RAW / "debarment-export.bin"
                dest.write_bytes(b)
                tried[-1]["saved"] = str(dest)
        except Exception as e:
            tried.append({"url": cand, "error": str(e)[:200]})
    report["debar_tries"] = tried

    for did, name in (("qp8s-a5uf", "pw_project_details"), ("9ncw-tqjn", "affidavit_project_details")):
        try:
            rows = soda(did, "SELECT count(*)")
            report[name] = {"id": did, "count": rows}
        except Exception as e:
            report[name] = {"id": did, "error": str(e)[:200]}

    try:
        rows = soda("9ncw-tqjn", "SELECT count(primelicense) WHERE primelicense IS NOT NULL")
        report["affidavit_with_license"] = rows
    except Exception as e:
        report["affidavit_with_license"] = str(e)[:200]

    (OUT / "extra-probe.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2)[:4000])


if __name__ == "__main__":
    main()
