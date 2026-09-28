"""Extract conservative BCC construction-license rows from public DAR PDFs.

Run with: python scripts/acquire_michigan_discipline.py
Only rows with a printed license number, class and effective date are retained.
"""
import io
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import pdfplumber
import requests

URLS = {
    "FY26": "https://www.michigan.gov/lara/-/media/Project/Websites/lara/bcc-media/DAR/Disciplinary-Action-Report-FY26.pdf?hash=40E0A203B382F5BF199017C62C7EB412&rev=39d3b33620e74950b6981c80c4d07efc",
    "FY25": "https://www.michigan.gov/lara/-/media/Project/Websites/lara/bcc-media/DAR/Disciplinary-Action-Report-FY25.pdf?hash=11C500A85512B94B05C81C8B5E0D3B42&rev=73cb04067195455488fc46ce1716fbb9",
    "FY24": "https://www.michigan.gov/lara/-/media/Project/Websites/lara/bcc-media/DAR/Disciplinary-Action-Report-FY24_2.pdf?hash=389076F212543550C9F185EBDC466CC7&rev=3ac0308d841c48188beb141f8684357d",
    "FY23": "https://www.michigan.gov/lara/-/media/Project/Websites/lara/bcc-media/DAR/Disciplinary-Action-Report-FY23.pdf?hash=F0EF50309C06646BF935FC19D9612B3C&rev=7793b949aff345368e1323ec6c25539d",
    "FY22": "https://www.michigan.gov/lara/-/media/Project/Websites/lara/bcc-media/DAR/Disciplinary-Action-Report-FY22.pdf?hash=27E5FA62A42F57D781642AD3333E1698&rev=62b26129b5c44c0192877772cfc661a5",
}
CLASSES = ("Residential Builder", "Maintenance & Alteration", "Electrical Contractor", "Master Electrician", "Electrical", "Plumbing Contractor", "Master Plumber", "Plumber", "Mechanical Contractor", "Boiler")
ACTIONS = ("Fine Ordered", "Revocation", "Suspension", "Restitution Ordered", "Probation", "Reprimand", "Censure", "Costs Ordered", "Limitation", "Other")
OUT = Path(__file__).resolve().parents[1] / "lib" / "michigan-intelligence" / "discipline.json"


def column(page, x0, x1, top, bottom):
    return " ".join((page.crop((x0, top, x1, bottom)).extract_text() or "").split())


def main():
    rows = []
    sources = []
    session = requests.Session()
    session.headers["User-Agent"] = "Mozilla/5.0"
    for fiscal, url in URLS.items():
        response = session.get(url, timeout=60)
        response.raise_for_status()
        pdf = pdfplumber.open(io.BytesIO(response.content))
        period = (pdf.pages[0].extract_text() or "").split("Orders served from ")[-1].split("\n")[0]
        sources.append({"report": fiscal, "url": url, "pages": len(pdf.pages), "ordersServed": period})
        for page_number, page in enumerate(pdf.pages, 1):
            words = page.extract_words()
            anchors = sorted((w for w in words if 125 <= w["x0"] < 275 and re.fullmatch(r"\d{7,12}", w["text"])), key=lambda w: w["top"])
            for i, anchor in enumerate(anchors):
                top = max(70, anchor["top"] - 3)
                bottom = anchors[i + 1]["top"] - 3 if i + 1 < len(anchors) else min(page.height - 20, anchor["top"] + 115)
                if bottom <= top:
                    continue
                left = column(page, 15, 159, top, bottom)
                right = column(page, 640, page.width - 10, top, bottom)
                klass = next((c for c in CLASSES if c.lower() in left.lower()), None)
                date = re.search(r"\b\d{2}/\d{2}/20\d{2}\b", right)
                if not klass or not date:
                    continue
                action = [a for a in ACTIONS if a.lower() in right.lower()]
                if not action:
                    continue
                name = left.split(klass, 1)[-1].strip(" :–-")
                if not name:
                    continue
                company_form = bool(re.search(r"\b(?:LLC|INC|CORP|LTD|COMPANY)\b", name, re.I))
                rows.append({"report": fiscal, "page": page_number, "licenseClass": klass, "licenseNumber": anchor["text"], "respondentType": "company-form name" if company_form else "unresolved", "licenseGrain": "unresolved", "effectiveDate": datetime.strptime(date.group(), "%m/%d/%Y").date().isoformat(), "actions": action})
    result = {"retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "sources": sources, "rows": rows}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print("rows", len(rows), "by report", dict(Counter(r["report"] for r in rows)), "by class", dict(Counter(r["licenseClass"] for r in rows)))


if __name__ == "__main__":
    main()
