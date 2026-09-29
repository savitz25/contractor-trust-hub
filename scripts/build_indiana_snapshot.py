"""IN-CON-001: freeze the bounded Indiana Plumbing Commission discipline corpus (2022-01-01 .. retrieval).

Input (gitignored, person-level): data/raw/indiana/private/in-plumbing-discipline-raw.json, harvested from the
PLA Discipline Search advanced form (Board = Plumbing Commission), split by date window below the 100-row cap.
No license-number enumeration; no name-based joins.

Output: lib/indiana-intelligence/discipline.json. Person-grain rows carry no names and no license numbers;
only a SHA-256 of the exact license number so a user-supplied labeled identifier can be matched exactly.
Business (Plumbing Corporation, CO) rows keep their public license number and PLA document id.

  python -X utf8 scripts/build_indiana_snapshot.py          # rebuild from the private raw file
  python -X utf8 scripts/build_indiana_snapshot.py --check  # verify committed JSON matches the raw file
"""
import hashlib
import json
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw/indiana/private/in-plumbing-discipline-raw.json"
OUT = ROOT / "lib/indiana-intelligence/discipline.json"
SEARCH_URL = "https://www.in.gov/apps/pla/litigation/advancedsearch.aspx"

# PLA license-number prefix -> credential class. The Discipline Search does not print the class; this mapping is
# inferred from the prefix and checked against row shape (corporate names only on CO; person names elsewhere).
PREFIX = {
    "PC": ("Plumbing Contractor", "person"),
    "JP": ("Journeyman Plumber", "person"),
    "PA": ("Plumbing Apprentice", "person"),
    "CO": ("Plumbing Corporation", "business"),
}
CATEGORY = {
    "Findings of Fact and Order": "final_order",
    "Board issued probation from application/renewal": "board_probation_on_application",
    "Complaint": "administrative_charging_complaint",
    "Hearing Notice/Case Management Order": "procedural",
    "Motions": "procedural",
    "Notice of Proposed Default": "procedural",
    "Order to Show Cause": "procedural",
    "Proposed Settlement Agreement": "procedural",
    "Admitted Exhibit": "procedural",
}
CORPORATE = re.compile(r"\b(?:inc|llc|l\.l\.c|corp|corporation|company|co|ltd)\b\.?", re.I)


def sha(license_number: str) -> str:
    return hashlib.sha256(license_number.strip().upper().encode()).hexdigest()


def build() -> dict:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    assert raw["board"] == "Plumbing Commission"
    assert not any(q["capped"] for q in raw["queries"]), "a harvest window hit the 100-row cap"
    rows = []
    for r in raw["rows"]:
        lic = r["license"].strip().upper()
        m = re.fullmatch(r"([A-Z]{2})(\d{8})", lic)
        assert m and m.group(1) in PREFIX, f"unexpected license format {lic}"
        assert r["board"] == "Indiana Plumbing Commission"
        assert r["type"] in CATEGORY, f"unmapped document type {r['type']}"
        cls, grain = PREFIX[m.group(1)]
        name_blob = f"{r['col1']} {r['col2']}"
        if grain == "business":
            assert CORPORATE.search(name_blob), f"business row without corporate name shape: {lic}"
        else:
            assert r["col2"] and not CORPORATE.search(r["col1"]), f"person row with corporate name shape: {lic}"
        date = datetime.strptime(r["date"], "%m/%d/%Y").date().isoformat()
        row = {
            "date": date,
            "documentType": r["type"],
            "category": CATEGORY[r["type"]],
            "credentialClass": cls,
            "grain": grain,
            "licenseSha256": sha(lic),
            "licenseNumber": lic if grain == "business" else None,
            "documentId": r["documentId"] if grain == "business" else None,
        }
        rows.append(row)
    rows.sort(key=lambda x: (x["date"], x["credentialClass"], x["documentType"], x["licenseSha256"]))

    def by(key, subset=None):
        return dict(sorted(Counter(r[key] for r in (subset or rows)).items()))

    distinct = {}
    for r in rows:
        distinct.setdefault(r["credentialClass"], set()).add(r["licenseSha256"])
    retrieved = raw["retrievedAt"]
    return {
        "source": {
            "regulator": "Indiana Professional Licensing Agency — Indiana Plumbing Commission",
            "searchUrl": SEARCH_URL,
            "query": "Board = Plumbing Commission; action date window",
            "window": raw["window"],
            "harvestWindows": len(raw["queries"]),
            "refreshNote": "PLA states disciplinary action information is refreshed weekly.",
        },
        "retrievedAt": retrieved,
        "generatedAt": retrieved,
        "classInference": "License-number prefix (PC, JP, PA, CO); the Discipline Search does not print a class label.",
        "summary": {
            "documentRows": len(rows),
            "distinctLicenses": len({r["licenseSha256"] for r in rows}),
            "rowsByCategory": by("category"),
            "rowsByClass": by("credentialClass"),
            "rowsByGrain": by("grain"),
            "distinctLicensesByClass": {k: len(v) for k, v in sorted(distinct.items())},
            "finalOrderRowsByClass": by("credentialClass", [r for r in rows if r["category"] == "final_order"]),
            "rowsByYear": dict(sorted(Counter(r["date"][:4] for r in rows).items())),
        },
        "rows": rows,
        "limits": {
            "exactProfileAttachments": 0,
            "nameOnlyAdverseJoins": 0,
            "newCanonicalCompanies": 0,
            "graphWrites": 0,
            "claimEligibilityChanges": 0,
            "personNamesPublished": 0,
        },
    }


def serialize(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"


if __name__ == "__main__":
    if "--check" in sys.argv:
        if not RAW.exists():
            print("IN-CON-001 raw discipline file is gitignored and absent; committed JSON not re-derived (SKIP)")
            sys.exit(0)
        ok = OUT.read_text(encoding="utf-8") == serialize(build())
        print("IN-CON-001 discipline snapshot matches raw:", "PASS" if ok else "FAIL")
        sys.exit(0 if ok else 1)
    data = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(serialize(data), encoding="utf-8")
    print(json.dumps(data["summary"], indent=1))
