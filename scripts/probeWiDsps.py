"""Wisconsin DSPS / LicensE Phase 0 probe. Polite, read-only, sample only."""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "wi_dsps"
RAW.mkdir(parents=True, exist_ok=True)

UA = "ContractorTrustHub-wi-phase0/1.0 (official public lookup probe; polite; no roster sync)"
BROWSER = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

URLS = [
    ("hub", "https://dsps.wi.gov/Pages/SelfService/LicenseLookUp.aspx"),
    ("legacy", "https://licensesearch.wi.gov/"),
    ("legacy_app", "https://app.wi.gov/licensesearch"),
    ("license_lookup", "https://license.wi.gov/s/license-lookup"),
    ("orders", "https://license.wi.gov/s/public-facing-orders-search"),
    ("esla", "https://esla.wi.gov/verifylicense"),
    ("order_list", "https://dsps.wi.gov/Pages/SelfService/OrderListofLicensees.aspx"),
    ("api_example", "https://prod-exp-wi-license-search-v1.us-e2.cloudhub.io/api/blp/1000%20-%2021"),
    ("counts_pdf", "https://dsps.wi.gov/Credentialing/General/LicenseCounts.pdf"),
    ("numbering_pdf", "https://dsps.wi.gov/Credentialing/Trades/LicensEnumbering.pdf"),
    ("api_guide", "https://dsps.wi.gov/Documents/DSPSLicenseAPIConnectionGuide.pdf"),
]


def fetch(name: str, url: str, ua: str) -> dict:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/pdf,application/json;q=0.9,*/*;q=0.8",
        },
    )
    out: dict = {"name": name, "url": url, "ua": ua}
    try:
        with urllib.request.urlopen(req, timeout=40) as resp:
            body = resp.read()
            out.update(
                {
                    "ok": True,
                    "status": resp.status,
                    "final": resp.geturl(),
                    "ctype": resp.headers.get("Content-Type"),
                    "server": resp.headers.get("Server"),
                    "cf_ray": resp.headers.get("CF-RAY"),
                    "bytes": len(body),
                }
            )
    except urllib.error.HTTPError as exc:
        body = exc.read()
        out.update(
            {
                "ok": False,
                "status": exc.code,
                "reason": exc.reason,
                "ctype": exc.headers.get("Content-Type") if exc.headers else None,
                "server": exc.headers.get("Server") if exc.headers else None,
                "cf_ray": exc.headers.get("CF-RAY") if exc.headers else None,
                "bytes": len(body),
            }
        )
    except Exception as exc:
        out.update({"ok": False, "error": f"{type(exc).__name__}: {exc}", "bytes": 0})
        body = b""

    suffix = "pdf" if "pdf" in (out.get("ctype") or "").lower() or url.endswith(".pdf") else "html"
    if "json" in (out.get("ctype") or "").lower():
        suffix = "json"
    path = RAW / f"{name}.{suffix}"
    if body:
        path.write_bytes(body)
        out["saved"] = str(path).replace("\\", "/")
        if suffix != "pdf":
            text = body.decode("utf-8", "replace")
            out["cloudflare_challenge"] = "Attention Required" in text or "cf-browser-verification" in text
            out["salesforce"] = "Salesforce" in text or "sfdc" in text.lower()
            out["export_hint"] = bool(
                re.search(r"csv|excel|export|download list", text, re.I)
            )
    return out


def try_salesforce_guest(html_path: Path) -> dict:
    """If the SPA shell loaded, note Aura endpoints. Do not POST a harvest."""
    if not html_path.exists():
        return {"skipped": True}
    text = html_path.read_text(encoding="utf-8", errors="replace")
    aura = sorted(set(re.findall(r"/[^\s\"']*aura[^\s\"']*", text, re.I)))[:20]
    apis = sorted(set(re.findall(r"/services/[^\s\"']+", text)))[:20]
    return {"aura_paths": aura, "service_paths": apis, "html_chars": len(text)}


results: list[dict] = []
for i, (name, url) in enumerate(URLS):
    if i:
        time.sleep(2.5)
    ua = BROWSER if name in {"license_lookup", "legacy", "legacy_app", "orders"} else UA
    print("probe", name, url)
    row = fetch(name, url, ua)
    print(" ", {k: row.get(k) for k in ("status", "ok", "final", "bytes", "cloudflare_challenge")})
    results.append(row)

sf = try_salesforce_guest(RAW / "legacy.html")
manifest = {
    "probed_at": datetime.now(timezone.utc).isoformat(),
    "note": (
        "Phase 0 probe only. No licensee roster harvested. "
        "License API is verification-only and was called without credentials (expect 401)."
    ),
    "results": results,
    "salesforce_shell": sf,
}
(RAW / "probe_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(json.dumps({"saved": str(RAW), "n": len(results), "sf": sf}, indent=2))
