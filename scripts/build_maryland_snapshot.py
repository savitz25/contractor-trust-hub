"""Freeze the bounded public MHIC disciplinary tables; no license-query enumeration."""
import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
import requests

BASE = "https://labor.maryland.gov/license/mhic/"
OUT = Path(__file__).resolve().parents[1] / "lib/maryland-intelligence/discipline.json"


class Tables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.depth = 0
        self.table = []
        self.tables = []
        self.row = None
        self.cell = None
        self.href = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "table":
            if self.depth == 0:
                self.table = []
            self.depth += 1
        elif self.depth and tag == "tr":
            self.row = []
        elif self.depth and tag in ("td", "th"):
            self.cell = {"text": "", "href": None}
        elif self.cell is not None and tag == "a":
            self.cell["href"] = attrs.get("href")

    def handle_data(self, data):
        if self.cell is not None:
            self.cell["text"] += data

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None and self.row is not None:
            self.cell["text"] = " ".join(self.cell["text"].split())
            self.row.append(self.cell)
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.table.append(self.row)
            self.row = None
        elif tag == "table" and self.depth:
            self.depth -= 1
            if self.depth == 0:
                self.tables.append(self.table)


def build():
    rows = []
    sources = []
    for year in range(2022, 2027):
        url = f"{BASE}mhicdisc{year}.shtml"
        try:
            response = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0 (compatible; public-evidence-research/1.0)"})
            if response.status_code != 200:
                continue
            html = response.text
        except Exception:
            continue
        parser = Tables()
        parser.feed(html)
        source_rows = 0
        for table in parser.tables:
            if not table or len(table[0]) < 5 or "COMPLAINT" not in table[0][1]["text"].upper():
                continue
            for cells in table[1:]:
                if len(cells) < 5:
                    continue
                date, complaint, decree, action, case = [c["text"] for c in cells[:5]]
                if not re.fullmatch(r"\d{1,2}/\d{1,2}/\d{4}", date) or not complaint:
                    continue
                amount = re.search(r"\$\s*([\d,]+(?:\.\d{2})?)\s+Guaranty\s+Fund\s+Award", action, re.I)
                rows.append({
                    "fiscalYear": year,
                    "date": datetime.strptime(date, "%m/%d/%Y").date().isoformat(),
                    "complaintNumber": complaint,
                    "decree": decree,
                    "actionSummary": action,
                    "caseName": case,
                    "licenseNumber": None,
                    "documentUrl": urljoin(url, cells[4]["href"]) if cells[4]["href"] else None,
                    "sourcePage": url,
                    "guarantyFundAwardDollars": float(amount.group(1).replace(",", "")) if amount else None,
                })
                source_rows += 1
        if source_rows:
            sources.append({"fiscalYear": year, "url": url, "rows": source_rows})
    rows.sort(key=lambda row: (row["date"], row["complaintNumber"], row["decree"]))
    result = {
        "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "indexUrl": f"{BASE}mhicdisc.shtml",
        "sources": sources,
        "rows": rows,
        "limits": {"contractorRoster": "NOT_ACQUIRED", "salespersonRoster": "NOT_ACQUIRED", "exactEnforcementAttachments": 0, "exactGuarantyAttachments": 0, "nameOnlyAdverseJoins": 0, "newCanonicalCompanies": 0, "graphWrites": 0, "claimEligibilityChanges": 0},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(rows)} actions; {sum(r['guarantyFundAwardDollars'] is not None for r in rows)} Guaranty Fund rows; FYs {[s['fiscalYear'] for s in sources]}")


if __name__ == "__main__":
    build()
