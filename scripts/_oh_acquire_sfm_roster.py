"""Acquire Ohio State Fire Marshal no-fee fire-protection rosters.

elicense7.com.ohio.gov Generate Roster:
  50/52/53 Fire Protection Companies (No Fee Required)
  54 Fire Protection Individual (No Fee Required)
Does not acquire fireworks, hotel, UST, or explosives groups.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

import requests

BASE = "https://elicense7.com.ohio.gov"
GENERATE = f"{BASE}/Lookup/GenerateRoster.aspx"
FILE_DOWNLOAD = f"{BASE}/Lookup/FileDownload.aspx"

OUT_DIR = Path(__file__).resolve().parents[1] / "data" / "ohio" / "sfm"
RAW_DIR = OUT_DIR / "raw"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)

# Labels we want, matched against checkbox label text.
WANTED = [
    ("fire_companies", "Fire Protection Companies"),
    ("fire_individuals", "Fire Protection Individual"),
]


class FormParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.inputs: dict[str, str] = {}
        self.checkboxes: list[tuple[str, str]] = []  # (name, id)
        self.labels: dict[str, str] = {}
        self.current_label_for: str | None = None
        self.label_buf = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        d = {k: (v or "") for k, v in attrs}
        if tag == "input":
            name = d.get("name")
            typ = d.get("type", "").lower()
            val = d.get("value", "")
            iid = d.get("id", "")
            if name and typ not in {"submit", "button", "image", "checkbox", "radio"}:
                self.inputs[name] = val
            if name and typ == "checkbox":
                self.checkboxes.append((name, iid))
        if tag == "label":
            self.current_label_for = d.get("for") or ""
            self.label_buf = ""

    def handle_endtag(self, tag: str) -> None:
        if tag == "label" and self.current_label_for is not None:
            self.labels[self.current_label_for] = self.label_buf.strip()
            self.current_label_for = None

    def handle_data(self, data: str) -> None:
        if self.current_label_for is not None:
            self.label_buf += data


def dump(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def hidden_fields(html: str) -> dict[str, str]:
    p = FormParser()
    p.feed(html)
    return {k: v for k, v in p.inputs.items() if k.startswith("__")}


def parse_ready_rosters(html: str) -> list[dict]:
    rows = []
    for m in re.finditer(
        r'OpenFileDownloadWindow\((\d+),.*?aria-label="Download roster ([^"]+)".*?<td>([^<]*)</td>.*?(\d+)\s+records found.*?<td[^>]*>([^<]*)</td>',
        html,
        flags=re.I | re.S,
    ):
        rows.append(
            {
                "idnt": m.group(1),
                "aria": m.group(2).strip(),
                "name": m.group(3).strip(),
                "records": int(m.group(4)),
                "status": m.group(5).strip(),
            }
        )
    if rows:
        return rows
    for m in re.finditer(
        r'OpenFileDownloadWindow\((\d+),.*?(\d+)\s+records found',
        html,
        flags=re.I | re.S,
    ):
        rows.append({"idnt": m.group(1), "records": int(m.group(2))})
    return rows


def acquire_one(client: requests.Session, slug: str, checkbox_name: str, label: str) -> dict:
    print(f"\n=== GENERATE {slug} {label} checkbox={checkbox_name} ===", flush=True)
    r = client.get(GENERATE, timeout=90)
    r.raise_for_status()
    dump(RAW_DIR / f"{slug}_01_generate.html", r.content)
    data = hidden_fields(r.text)
    data[checkbox_name] = "on"
    # Continue button — discover name
    if "ctl00$MainContentPlaceHolder$btnRosterContinue" not in data:
        data["ctl00$MainContentPlaceHolder$btnRosterContinue"] = "Continue"
    r2 = client.post(GENERATE, data=data, timeout=180, allow_redirects=True)
    r2.raise_for_status()
    dump(RAW_DIR / f"{slug}_02_download_page.html", r2.content)
    print("after continue", r2.url, "len", len(r2.content))
    rosters = parse_ready_rosters(r2.text)
    print("parsed", rosters)
    rec_m = re.search(r"(\d+)\s+records found", r2.text, re.I)
    idnt_m = list(re.finditer(r"OpenFileDownloadWindow\((\d+)", r2.text))
    if not idnt_m:
        raise RuntimeError(f"no roster id for {slug}; snippet={re.sub(r'\\s+', ' ', r2.text)[0:600]}")
    idnt = idnt_m[-1].group(1)
    records = int(rec_m.group(1)) if rec_m else (rosters[-1].get("records") if rosters else None)
    print("downloading", idnt, "records", records)
    r3 = client.get(FILE_DOWNLOAD, params={"Idnt": idnt, "Type": "Comma"}, timeout=300)
    print("file", r3.status_code, r3.headers.get("content-type"), r3.headers.get("content-disposition"), len(r3.content))
    if "html" in (r3.headers.get("content-type") or "").lower() or r3.content[:15].lower().startswith(b"<!doctype"):
        dump(RAW_DIR / f"{slug}_03_file.html", r3.content)
        raise RuntimeError(f"HTML instead of file for {slug}")
    ext = ".csv"
    if r3.content[:2] == b"PK":
        ext = ".xlsx"
    out_path = RAW_DIR / f"sfm_{slug}_roster{ext}"
    dump(out_path, r3.content)
    digest = sha256_bytes(r3.content)
    (RAW_DIR / f"sfm_{slug}_roster.sha256").write_text(digest + "\n", encoding="utf-8")
    print("head", r3.content[:350].decode("utf-8", errors="replace").replace("\n", " | ")[:300])
    return {
        "slug": slug,
        "label": label,
        "checkbox": checkbox_name,
        "rosterIdnt": idnt,
        "sourceRecordCount": records,
        "path": str(out_path.relative_to(OUT_DIR.parent.parent)).replace("\\", "/"),
        "sha256": digest,
        "bytes": len(r3.content),
        "contentType": r3.headers.get("content-type"),
        "disposition": r3.headers.get("content-disposition"),
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    with requests.Session() as client:
        client.headers.update({"User-Agent": UA, "Referer": GENERATE})
        home = client.get(BASE + "/", timeout=90)
        print("home", home.status_code, len(home.content))
        dump(RAW_DIR / "00_home.html", home.content)
        gen = client.get(GENERATE, timeout=90)
        dump(RAW_DIR / "00_generate.html", gen.content)
        p = FormParser()
        p.feed(gen.text)
        print("checkboxes", p.checkboxes)
        print("labels", p.labels)
        mapping = {}
        html_lower = gen.text
        for name, iid in p.checkboxes:
            # Labels are sibling text, not <label for=>
            idx = html_lower.find(f'id="{iid}"')
            nearby = html_lower[idx : idx + 500] if idx >= 0 else ""
            print("cb", name, iid, "nearby", nearby[120:280].replace("\n", " ")[:160])
            if "Fire Protection Companies" in nearby:
                mapping["fire_companies"] = (name, "50 / 52 / 53 Fire Protection Companies (No Fee Required)")
            if "Fire Protection Individual" in nearby:
                mapping["fire_individuals"] = (name, "54 Fire Protection Individual (No Fee Required)")
        print("mapping", mapping)
        if len(mapping) < 2:
            raise SystemExit(f"could not map fire checkboxes")
        results = []
        for slug, needle in WANTED:
            name, label = mapping[slug]
            results.append(acquire_one(client, slug, name, label))
            time.sleep(1.0)
    manifest = {
        "source": GENERATE,
        "fileDownload": FILE_DOWNLOAD,
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "rosters": results,
    }
    (OUT_DIR / "acquire-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
