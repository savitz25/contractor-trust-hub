"""CA-CON-002 bounded CSLB acquisition attempts.

Three materially different License Master attempts, then one Personnel and
one Workers' Comp attempt. A flaky bulk download must not block publication.
"""
from __future__ import annotations

import hashlib
import http.client
import json
import re
import ssl
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "raw" / "ca_cslb_master"
CLASS_OUT = ROOT / "data" / "raw" / "ca_cslb_class_lists"
ART = ROOT / "artifacts" / "ca-con-002"
PORTAL = "https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList"
CLASS_URL = "https://www.cslb.ca.gov/onlineservices/dataportal/ListByClassification.aspx"
HOST = "www.cslb.ca.gov"
PORTAL_PATH = "/onlineservices/dataportal/ContractorList"
CLASS_PATH = "/onlineservices/dataportal/ListByClassification.aspx"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://www.cslb.ca.gov",
    "Referer": PORTAL,
}

KIND_CSV = {
    "M": "ctl00$MainContent$lbMasterCSV",
    "W": "ctl00$MainContent$lbWorkerCompcsv",
    "P": "ctl00$MainContent$lbPersonnelCSV",
}
KIND_XLS = {
    "M": "ctl00$MainContent$lbMasterExcel",
    "W": "ctl00$MainContent$lbWorkerCompExcel",
    "P": "ctl00$MainContent$lbPersonnelExcel",
}
KIND_LABEL = {"M": "license_master", "W": "workers_comp", "P": "personnel"}

ATTEMPT_TIMEOUT = 180
CHUNK = 256 * 1024


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_path(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def hidden(name: str, html: str) -> str:
    m = re.search(rf'id="{re.escape(name)}"[^>]*value="([^"]*)"', html)
    if m:
        return m.group(1)
    m = re.search(rf'name="{re.escape(name)}"[^>]*value="([^"]*)"', html)
    return m.group(1) if m else ""


def asp_fields(html: str, extra: dict[str, str]) -> dict[str, str]:
    fields = {
        "__EVENTTARGET": extra.get("__EVENTTARGET", ""),
        "__EVENTARGUMENT": extra.get("__EVENTARGUMENT", ""),
        "__LASTFOCUS": extra.get("__LASTFOCUS", ""),
        "__VIEWSTATE": hidden("__VIEWSTATE", html),
        "__VIEWSTATEGENERATOR": hidden("__VIEWSTATEGENERATOR", html),
        "__EVENTVALIDATION": hidden("__EVENTVALIDATION", html),
    }
    fields.update(extra)
    return {k: v for k, v in fields.items() if v is not None}


def cookie_header(sess: requests.Session) -> str:
    return "; ".join(f"{c.name}={c.value}" for c in sess.cookies)


def count_newlines(path: Path) -> int:
    n = 0
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            n += chunk.count(b"\n")
    return n


def inspect_payload(path: Path) -> dict:
    if not path.exists():
        return {"exists": False}
    size = path.stat().st_size
    head = path.read_bytes()[:120]
    htmlish = head.lstrip().startswith(b"<") or b"Request Rejected" in head
    return {
        "exists": True,
        "bytes": size,
        "sha256": sha256_path(path) if size else None,
        "newlines": count_newlines(path) if size and not htmlish else None,
        "htmlish": htmlish,
        "head_ascii": head[:80].decode("latin-1", errors="replace"),
        "accept_ranges_hint": None,
    }


class HTTP10Connection(http.client.HTTPSConnection):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._http_vsn = 10
        self._http_vsn_str = "HTTP/1.0"


def stream_http10(path: str, body: bytes, headers: dict[str, str], dest: Path, timeout: int) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    ctx = ssl.create_default_context()
    conn = HTTP10Connection(HOST, timeout=timeout, context=ctx)
    req_headers = {
        "Host": HOST,
        "User-Agent": UA,
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://www.cslb.ca.gov",
        "Referer": f"https://{HOST}{path}",
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": str(len(body)),
        "Connection": "close",
    }
    if headers.get("Cookie"):
        req_headers["Cookie"] = headers["Cookie"]
    started = time.time()
    written = 0
    status = None
    resp_headers: dict[str, str] = {}
    error = None
    try:
        conn.request("POST", path, body=body, headers=req_headers)
        resp = conn.getresponse()
        status = resp.status
        resp_headers = {k: v for k, v in resp.getheaders()}
        with dest.open("wb") as fh:
            while True:
                chunk = resp.read(CHUNK)
                if not chunk:
                    break
                fh.write(chunk)
                written += len(chunk)
                if written and written % (5 * 1024 * 1024) < CHUNK:
                    print(f"    ... {written:,} bytes", flush=True)
    except Exception as exc:  # noqa: BLE001 — bounded attempt log
        error = f"{type(exc).__name__}: {exc}"
        print(f"    transport error after {written:,} bytes: {error}", flush=True)
    finally:
        try:
            conn.close()
        except Exception:
            pass
    return {
        "status": status,
        "bytes_written": written,
        "elapsed_s": round(time.time() - started, 2),
        "content_type": resp_headers.get("Content-Type"),
        "content_disposition": resp_headers.get("Content-Disposition"),
        "transfer_encoding": resp_headers.get("Transfer-Encoding"),
        "content_length": resp_headers.get("Content-Length"),
        "accept_ranges": resp_headers.get("Accept-Ranges"),
        "connection": resp_headers.get("Connection"),
        "error": error,
    }


def stream_requests(sess: requests.Session, url: str, data, dest: Path, timeout: int, extra_headers: dict | None = None) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    headers = dict(HEADERS)
    if extra_headers:
        headers.update(extra_headers)
    started = time.time()
    written = 0
    status = None
    resp_headers: dict[str, str] = {}
    error = None
    try:
        with sess.post(url, data=data, headers=headers, stream=True, timeout=timeout) as resp:
            status = resp.status_code
            resp_headers = dict(resp.headers)
            resp.raise_for_status()
            with dest.open("wb") as fh:
                for chunk in resp.iter_content(CHUNK):
                    if not chunk:
                        continue
                    fh.write(chunk)
                    written += len(chunk)
                    if written and written % (5 * 1024 * 1024) < CHUNK:
                        print(f"    ... {written:,} bytes", flush=True)
    except Exception as exc:  # noqa: BLE001
        error = f"{type(exc).__name__}: {exc}"
        print(f"    transport error after {written:,} bytes: {error}", flush=True)
    return {
        "status": status,
        "bytes_written": written,
        "elapsed_s": round(time.time() - started, 2),
        "content_type": resp_headers.get("Content-Type"),
        "content_disposition": resp_headers.get("Content-Disposition"),
        "transfer_encoding": resp_headers.get("Transfer-Encoding"),
        "content_length": resp_headers.get("Content-Length"),
        "accept_ranges": resp_headers.get("Accept-Ranges"),
        "error": error,
    }


def open_kind(sess: requests.Session, kind: str) -> tuple[str, str]:
    html = sess.get(PORTAL, headers=HEADERS, timeout=60).text
    select = sess.post(
        PORTAL,
        data=asp_fields(html, {"__EVENTTARGET": "ctl00$MainContent$ddlStatus", "ctl00$MainContent$ddlStatus": kind}),
        headers=HEADERS,
        timeout=60,
    )
    select.raise_for_status()
    page = select.text
    as_of_m = re.search(r"Updated as of ([0-9/]+)", page)
    as_of = as_of_m.group(1) if as_of_m else ""
    return page, as_of


def attempt_master_http10_csv(sess: requests.Session) -> dict:
    print("\n=== ATTEMPT 1: License Master CSV via HTTP/1.0 Connection: close ===", flush=True)
    page, as_of = open_kind(sess, "M")
    (OUT / "attempt1_select.html").write_text(page, encoding="utf-8")
    fields = asp_fields(page, {"__EVENTTARGET": KIND_CSV["M"], "ctl00$MainContent$ddlStatus": "M"})
    dest = OUT / "attempt1_master_http10.csv.part"
    transport = stream_http10(
        PORTAL_PATH,
        urlencode(fields).encode("utf-8"),
        {"Cookie": cookie_header(sess)},
        dest,
        ATTEMPT_TIMEOUT,
    )
    payload = inspect_payload(dest)
    complete = bool(
        payload.get("exists")
        and not payload.get("htmlish")
        and payload.get("bytes", 0) > 30_000_000
        and not transport.get("error")
    )
    result = {
        "id": 1,
        "name": "license_master_csv_http10_connection_close",
        "kind": "M",
        "format": "csv",
        "transport": "http/1.0 connection:close",
        "as_of": as_of,
        "complete_enough": complete,
        "transport_log": transport,
        "payload": payload,
    }
    print("  as_of", as_of, "bytes", payload.get("bytes"), "newlines", payload.get("newlines"), "err", transport.get("error"), flush=True)
    return result


def attempt_master_excel(sess: requests.Session) -> dict:
    print("\n=== ATTEMPT 2: License Master Excel via HTTP/1.1 stream ===", flush=True)
    page, as_of = open_kind(sess, "M")
    events = re.findall(r"__doPostBack\('([^']+)'", page)
    excel_event = KIND_XLS["M"]
    if excel_event not in page:
        xls = [e for e in events if "excel" in e.lower() or "xls" in e.lower()]
        if xls:
            excel_event = xls[0]
    print("  excel event", excel_event, "events", events, flush=True)
    fields = asp_fields(page, {"__EVENTTARGET": excel_event, "ctl00$MainContent$ddlStatus": "M"})
    dest = OUT / "attempt2_master.xls.part"
    transport = stream_requests(sess, PORTAL, fields, dest, ATTEMPT_TIMEOUT)
    payload = inspect_payload(dest)
    complete = bool(
        payload.get("exists")
        and not payload.get("htmlish")
        and payload.get("bytes", 0) > 30_000_000
        and not transport.get("error")
    )
    result = {
        "id": 2,
        "name": "license_master_excel_http11_stream",
        "kind": "M",
        "format": "xls",
        "transport": "requests HTTP/1.1 stream",
        "as_of": as_of,
        "excel_event": excel_event,
        "complete_enough": complete,
        "transport_log": transport,
        "payload": payload,
    }
    print("  as_of", as_of, "bytes", payload.get("bytes"), "err", transport.get("error"), flush=True)
    return result


def attempt_classification_slices(sess: requests.Session) -> dict:
    print("\n=== ATTEMPT 3: Official ListByClassification slices ===", flush=True)
    html = sess.get(CLASS_URL, headers={**HEADERS, "Referer": CLASS_URL}, timeout=60).text
    (CLASS_OUT / "attempt3_form.html").write_text(html, encoding="utf-8")
    options = re.findall(
        r'<option[^>]*value="([^"]+)"[^>]*>([^<]*)</option>',
        html,
        flags=re.I,
    )
    buttons = re.findall(r'name="(ctl00\$MainContent\$[^"]+)"', html)
    link_events = re.findall(r"__doPostBack\('([^']+)'", html)
    print("  options", len(options), "buttons", buttons, "events", link_events, flush=True)

    # Try Button name post (ASP.NET Button) for class B, then C-10.
    batches = [["B"], ["C-10"]]
    batch_logs = []
    any_data = False
    for i, batch in enumerate(batches, start=1):
        page = sess.get(CLASS_URL, headers={**HEADERS, "Referer": CLASS_URL}, timeout=60).text
        # Variant A: submit button name
        fields_a: list[tuple[str, str]] = [
            ("__EVENTTARGET", ""),
            ("__EVENTARGUMENT", ""),
            ("__LASTFOCUS", ""),
            ("__VIEWSTATE", hidden("__VIEWSTATE", page)),
            ("__VIEWSTATEGENERATOR", hidden("__VIEWSTATEGENERATOR", page)),
            ("__EVENTVALIDATION", hidden("__EVENTVALIDATION", page)),
            ("ctl00$MainContent$cbBondInfo", "on"),
            ("ctl00$MainContent$btnSearch", "Search"),
        ]
        for cls in batch:
            fields_a.append(("ctl00$MainContent$lbClassification", cls))
        dest = CLASS_OUT / f"attempt3_batch_{i}_{batch[0].replace('-', '')}.xls"
        print("  batch", i, batch, "variant button-name", flush=True)
        transport = stream_requests(
            sess,
            CLASS_URL,
            fields_a,
            dest,
            120,
            extra_headers={"Referer": CLASS_URL},
        )
        payload = inspect_payload(dest)
        used = "button-name"
        if payload.get("htmlish") or payload.get("bytes", 0) < 2000:
            # Variant B: EVENTTARGET search button
            page = sess.get(CLASS_URL, headers={**HEADERS, "Referer": CLASS_URL}, timeout=60).text
            fields_b: list[tuple[str, str]] = [
                ("__EVENTTARGET", "ctl00$MainContent$btnSearch"),
                ("__EVENTARGUMENT", ""),
                ("__LASTFOCUS", ""),
                ("__VIEWSTATE", hidden("__VIEWSTATE", page)),
                ("__VIEWSTATEGENERATOR", hidden("__VIEWSTATEGENERATOR", page)),
                ("__EVENTVALIDATION", hidden("__EVENTVALIDATION", page)),
                ("ctl00$MainContent$cbBondInfo", "on"),
            ]
            for cls in batch:
                fields_b.append(("ctl00$MainContent$lbClassification", cls))
            print("  batch", i, "retry EVENTTARGET btnSearch", flush=True)
            transport = stream_requests(
                sess,
                CLASS_URL,
                fields_b,
                dest,
                120,
                extra_headers={"Referer": CLASS_URL},
            )
            payload = inspect_payload(dest)
            used = "eventtarget-btnSearch"
        dataish = bool(payload.get("exists") and not payload.get("htmlish") and payload.get("bytes", 0) > 2000)
        any_data = any_data or dataish
        batch_logs.append(
            {
                "batch": batch,
                "variant": used,
                "transport": transport,
                "payload": payload,
                "dataish": dataish,
            }
        )
        print("  batch", i, "bytes", payload.get("bytes"), "htmlish", payload.get("htmlish"), flush=True)

    return {
        "id": 3,
        "name": "list_by_classification_official_slices",
        "format": "xls",
        "transport": "ASP.NET listbox postback",
        "option_count": len(options),
        "options_sample": options[:5],
        "buttons": buttons,
        "link_events": link_events,
        "complete_enough": any_data,
        "batches": batch_logs,
        "note": (
            "Currently-renewed only; cancelled/revoked/expired-renewable not included. "
            "Used only if form postback returns a real spreadsheet."
        ),
    }


def attempt_kind_http10(sess: requests.Session, kind: str, attempt_id: int) -> dict:
    label = KIND_LABEL[kind]
    print(f"\n=== ATTEMPT {attempt_id}: {label} CSV via HTTP/1.0 ===", flush=True)
    page, as_of = open_kind(sess, kind)
    (OUT / f"attempt{attempt_id}_{label}_select.html").write_text(page, encoding="utf-8")
    event = KIND_CSV[kind]
    if event not in page:
        found = re.findall(r"__doPostBack\('([^']+)'", page)
        csv_events = [e for e in found if "csv" in e.lower()]
        if csv_events:
            event = csv_events[0]
        print("  events", found, "using", event, flush=True)
    fields = asp_fields(page, {"__EVENTTARGET": event, "ctl00$MainContent$ddlStatus": kind})
    dest = OUT / f"attempt{attempt_id}_{label}_http10.csv.part"
    transport = stream_http10(
        PORTAL_PATH,
        urlencode(fields).encode("utf-8"),
        {"Cookie": cookie_header(sess)},
        dest,
        ATTEMPT_TIMEOUT,
    )
    payload = inspect_payload(dest)
    complete = bool(
        payload.get("exists")
        and not payload.get("htmlish")
        and payload.get("bytes", 0) > 1_000_000
        and not transport.get("error")
    )
    result = {
        "id": attempt_id,
        "name": f"{label}_csv_http10_connection_close",
        "kind": kind,
        "format": "csv",
        "transport": "http/1.0 connection:close",
        "as_of": as_of,
        "event": event,
        "complete_enough": complete,
        "transport_log": transport,
        "payload": payload,
        "page_blocker": False,
    }
    print("  as_of", as_of, "bytes", payload.get("bytes"), "newlines", payload.get("newlines"), "err", transport.get("error"), flush=True)
    return result


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    CLASS_OUT.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    attempts: list[dict] = []
    sess = requests.Session()
    try:
        landing = sess.get(PORTAL, headers=HEADERS, timeout=60)
        print("landing", landing.status_code, len(landing.text), "cookies", cookie_header(sess), flush=True)
        (OUT / "attempt_landing.html").write_text(landing.text, encoding="utf-8")
        attempts.append(attempt_master_http10_csv(sess))
        attempts.append(attempt_master_excel(sess))
        attempts.append(attempt_classification_slices(sess))
        attempts.append(attempt_kind_http10(sess, "P", 4))
        attempts.append(attempt_kind_http10(sess, "W", 5))
    except Exception:
        traceback.print_exc()
        attempts.append({"fatal": traceback.format_exc()})

    baseline = OUT / "license_master.part"
    report = {
        "ticket": "CA-CON-002",
        "generated_at": utc_now(),
        "baseline_ca_con_001": inspect_payload(baseline) if baseline.exists() else {"exists": False},
        "attempts": attempts,
        "rule": "Max three materially different License Master attempts. Personnel/WC are not page blockers.",
        "publication_rule": "Do not block /california if portal remains truncated.",
    }
    dest = ART / "acquisition-attempts.json"
    dest.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("\nWrote", dest, flush=True)
    for a in attempts:
        if isinstance(a, dict) and "id" in a:
            print(
                f"  attempt {a.get('id')} {a.get('name')} complete_enough={a.get('complete_enough')} "
                f"bytes={a.get('payload', {}).get('bytes') if 'payload' in a else 'n/a'}",
                flush=True,
            )


if __name__ == "__main__":
    main()
