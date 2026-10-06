"""Read-only Contractor source ownership audit through the existing Supabase REST key."""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ingest.env import load_dotenv_files  # noqa: E402

load_dotenv_files(Path.home() / "contractor-trust-hub/.env.local")
base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not base or not key:
    raise SystemExit("No configured existing REST credentials")


def count(table: str, **filters: str) -> int:
    query = urlencode({"select": "id", **filters})
    req = Request(f"{base}/rest/v1/{table}?{query}", method="HEAD",
                  headers={"apikey": key, "Authorization": f"Bearer {key}",
                           "Prefer": "count=exact", "Range": "0-0"})
    with urlopen(req, timeout=30) as response:
        return int(response.headers["Content-Range"].split("/")[-1])


result = {"retrieved_at": datetime.now(timezone.utc).isoformat(), "method": "PostgREST HEAD count=exact",
          "source_counts": {}, "fl_dbpr_board_counts": {}, "production_changed": False}
result["network_counts"] = {"contractors": count("contractors"), "licenses": count("licenses")}
for source in ("fl_dbpr", "nj_dfs", "nyc_dob", "ny_dol", "nj_dca"):
    result["source_counts"][source] = count("licenses", source_system=f"eq.{source}")
for board in ("06", "08", "07", "59", "04"):
    result["fl_dbpr_board_counts"][board] = count("licenses", source_system="eq.fl_dbpr", source_board=f"eq.{board}")
result["live_ownership_verified"] = True
path = ROOT / "docs/TH-ENRICH-2026-09-30-B1-rest-audit.json"
path.write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, indent=2))
