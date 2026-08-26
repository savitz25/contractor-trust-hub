"""
Florida DBPR Related License Information — business-first portal client.

Lookup chain (verified in Prompt 3):
  1. GET wl11.asp?mode=1&search=Name  (session cookie)
  2. POST Board=06, hDDChange=Y to load Construction license types
  3. POST OrgName search (optionally LicenseType=Construction Business Information)
  4. Parse result rows: LicenseDetail id, name-type, rank/occupation, license cell
  5. For Construction Business Information rows, recover licid:
       a. licenseRelation.asp is keyed by numeric licid
       b. Search HTML / LicenseDetail redirect may expose licid
       c. Related-license printer/openList(licid,...)
  6. GET licenseRelation.asp?licid=... and parse Related License Information table

Never numeric-core identity. Fail closed on ambiguous names.

Stage A verified: classic search HTML has no licid= param. SPA LicenseDetail
hidden input id=ID value={licid} is the deterministic portal business key.
"""
from __future__ import annotations

import hashlib
import html as htmlmod
import http.cookiejar
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

UA = "ContractorTrustHub/0.1 (public-record research; business-first; bounded)"
CTX = ssl.create_default_context()
BASE = "https://www.myfloridalicense.com"

RELATION_TYPES_CANONICAL = {
    "primary qualifying agent for business": "primary_qualifying_agent",
    "primary qualifying agent": "primary_qualifying_agent",
    "second qualifying agent for business": "secondary_qualifying_agent",
    "secondary qualifying agent for business": "secondary_qualifying_agent",
    "secondary qualifying agent": "secondary_qualifying_agent",
    "financially responsible officer": "financially_responsible_officer",
    "financial responsible officer": "financially_responsible_officer",
    "financial officer - business": "financially_responsible_officer",
    "financial officer": "financially_responsible_officer",
}


def canonical_rel_type(raw: str) -> str:
    key = re.sub(r"\s+", " ", (raw or "").strip().lower())
    if not key:
        return "unmapped"
    if key in RELATION_TYPES_CANONICAL:
        return RELATION_TYPES_CANONICAL[key]
    for phrase, canon in RELATION_TYPES_CANONICAL.items():
        if phrase in key:
            return canon
    return "other_regulator_defined"


def currentness(status_raw: str | None, ended_on: str | None) -> str:
    """CURRENT only from regulator status, never from missing end date."""
    s = (status_raw or "").lower()
    if ended_on:
        return "historical"
    if re.search(r"null\s*(&|and)?\s*void|delinquen|expired|inactive|closed|revok|relinquish", s):
        return "historical"
    if "current" in s and "active" in s:
        return "current"
    if re.search(r"\bcurrent\b", s) and not re.search(r"inactive|void|delinquen", s):
        return "current"
    if not s:
        return "unknown"
    return "unknown"


@dataclass
class SearchHit:
    detail_id: str
    name: str
    name_type: str
    license_cell: str
    occupation_label: str
    address: str
    status: str
    licid: str | None = None


@dataclass
class RelationRow:
    license_number: str
    status_raw: str
    related_party: str
    relationship_type_raw: str
    relationship_type_canonical: str
    effective_on: str | None
    expiration_on: str | None  # related credential expiration, NOT relationship end
    rank: str
    current_or_historical: str
    ended_on: str | None = None  # only when DBPR publishes a relation end date


class DbprPortal:
    def __init__(self, delay_sec: float = 1.25):
        self.delay_sec = delay_sec
        self.cj = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=CTX),
            urllib.request.HTTPCookieProcessor(self.cj),
        )
        self._last = 0.0
        self.stats = {
            "gets": 0,
            "posts": 0,
            "errors": 0,
            "retries": 0,
        }

    def _sleep(self) -> None:
        wait = self.delay_sec - (time.time() - self._last)
        if wait > 0:
            time.sleep(wait)

    def _request(self, url: str, data: dict | None = None, retries: int = 3) -> tuple[int, str, str]:
        last_err: Exception | None = None
        for attempt in range(retries):
            self._sleep()
            body = urllib.parse.urlencode(data).encode() if data else None
            headers = {"User-Agent": UA, "Accept": "text/html"}
            if data:
                headers["Content-Type"] = "application/x-www-form-urlencoded"
            req = urllib.request.Request(url, data=body, headers=headers)
            try:
                with self.opener.open(req, timeout=45) as resp:
                    self._last = time.time()
                    if data:
                        self.stats["posts"] += 1
                    else:
                        self.stats["gets"] += 1
                    return resp.status, str(resp.geturl()), resp.read().decode("utf-8", "replace")
            except urllib.error.HTTPError as e:
                self._last = time.time()
                if e.code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                    self.stats["retries"] += 1
                    time.sleep(2.0 * (attempt + 1))
                    last_err = e
                    continue
                self.stats["errors"] += 1
                return e.code, url, e.read().decode("utf-8", "replace")
            except Exception as e:
                last_err = e
                self.stats["retries"] += 1
                time.sleep(1.5 * (attempt + 1))
        self.stats["errors"] += 1
        raise RuntimeError(f"request failed {url}: {last_err}")

    def ensure_session(self) -> None:
        self._request(f"{BASE}/wl11.asp?mode=1&search=Name&SID=")

    def load_construction_types(self) -> str:
        """POST Board=06 to populate LicenseType options. Returns HTML."""
        payload = {
            "hSID": "",
            "hSearchType": "Name",
            "hDivision": "ALL",
            "hBoard": "06",
            "hDDChange": "Y",
            "Board": "06",
            "SearchType": "Name",
        }
        _s, _f, html = self._request(
            f"{BASE}/wl11.asp?mode=1&search=Name&SID=",
            payload,
        )
        return html

    def parse_license_type_options(self, html: str) -> list[tuple[str, str]]:
        block = re.search(
            r"<select[^>]*name=['\"]LicenseType['\"][^>]*>(.*?)</select>",
            html,
            re.I | re.S,
        )
        if not block:
            return []
        opts = re.findall(
            r"<option[^>]*value=['\"]([^'\"]*)['\"][^>]*>([^<]*)</option>",
            block.group(1),
            re.I,
        )
        return [(v.strip(), htmlmod.unescape(t).strip()) for v, t in opts if v.strip()]

    def search_org(
        self,
        org_name: str,
        *,
        license_type: str = "",
        historic: bool = True,
        recs: int = 50,
    ) -> tuple[str, list[SearchHit]]:
        payload = {
            "hSID": "",
            "hSearchType": "Name",
            "hOrgName": org_name,
            "hDivision": "ALL",
            "hBoard": "06",
            "hLicenseType": license_type,
            "hSearchHistoric": "Yes" if historic else "",
            "hRecsPerPage": str(recs),
            "OrgName": org_name,
            "Board": "06",
            "LicenseType": license_type,
            "RecsPerPage": str(recs),
            "Search1": "Search",
        }
        if historic:
            payload["SearchHistoric"] = "Yes"
        _s, _f, html = self._request(
            f"{BASE}/wl11.asp?mode=2&search=Name&SID=&brd=&typ=",
            payload,
        )
        return html, parse_search_hits(html)

    def search_licnbr(self, lic: str) -> tuple[str, list[SearchHit]]:
        payload = {
            "hSID": "",
            "hSearchType": "LicNbr",
            "hLicNbr": lic,
            "hDivision": "ALL",
            "hBoard": "06",
            "hRecsPerPage": "20",
            "LicNbr": lic,
            "Board": "06",
            "RecsPerPage": "20",
            "Search1": "Search",
        }
        _s, _f, html = self._request(
            f"{BASE}/wl11.asp?mode=2&search=LicNbr&SID=&brd=&typ=",
            payload,
        )
        return html, parse_search_hits(html)

    def fetch_relations(self, licid: str) -> tuple[str, list[RelationRow], dict[str, Any]]:
        url = f"{BASE}/licenseRelation.asp?licid={urllib.parse.quote(licid)}"
        _s, _f, html = self._request(url)
        rows = parse_relation_table(html)
        meta = parse_relation_header(html)
        meta["source_url"] = url
        meta["retrieved_at"] = datetime.now(timezone.utc).isoformat()
        meta["html_sha256"] = hashlib.sha256(html.encode("utf-8", "replace")).hexdigest()
        meta["licid"] = licid
        return html, rows, meta

    def fetch_license_detail(self, detail_id: str) -> tuple[str, str | None, dict[str, Any]]:
        """SPA LicenseDetail page. Hidden input ID is the numeric licid."""
        url = f"{BASE}/portalsearches/VerifyLicensee/LicenseDetail?ID={urllib.parse.quote(detail_id)}"
        _s, _f, html = self._request(url)
        licid = extract_licid_from_license_detail(html)
        meta = parse_license_detail(html)
        meta["detail_id"] = detail_id
        meta["detail_url"] = url
        meta["html_sha256"] = fingerprint(html)
        meta["retrieved_at"] = datetime.now(timezone.utc).isoformat()
        return html, licid, meta

    def resolve_cbi(
        self,
        org_name: str,
        *,
        license_type: str = "0627",
        address: str = "",
        city: str = "",
        postal_code: str = "",
        state: str = "",
    ) -> dict[str, Any]:
        """
        Business-first CBI resolution. Fail closed on ambiguity.
        Returns a dict with status: unique | address_disambiguated | ambiguous |
        unresolved | name_mismatch | no_cbi_hit | error.
        """
        html, hits = self.search_org(org_name, license_type=license_type, historic=True)
        cbi = [
            h
            for h in hits
            if "construction business information" in (h.occupation_label or "").lower()
            or (h.occupation_label or "").lower() in {"business info", "qb"}
        ]
        result: dict[str, Any] = {
            "query_name": org_name,
            "hit_count": len(hits),
            "cbi_count": len(cbi),
            "hits": [h.__dict__ for h in cbi[:20]],
            "status": "unresolved",
            "detail_id": None,
            "licid": None,
            "selected": None,
            "reason": "",
        }
        if not cbi:
            result["status"] = "no_cbi_hit"
            result["reason"] = "org search returned no Construction Business Information row"
            return result
        chosen: SearchHit | None = None
        if len(cbi) == 1:
            chosen = cbi[0]
            result["status"] = "unique"
        else:
            addr_hits = [
                h
                for h in cbi
                if address_compatible(h.address, address, city, postal_code, state)
            ]
            if len(addr_hits) == 1:
                chosen = addr_hits[0]
                result["status"] = "address_disambiguated"
            else:
                result["status"] = "ambiguous"
                result["reason"] = (
                    f"{len(cbi)} CBI hits; address matches={len(addr_hits)}; fail closed"
                )
                return result
        if not names_compatible(chosen.name, org_name):
            result["status"] = "name_mismatch"
            result["reason"] = f"CBI name {chosen.name!r} not compatible with {org_name!r}"
            result["selected"] = chosen.__dict__
            return result
        result["detail_id"] = chosen.detail_id
        result["selected"] = chosen.__dict__
        _html, licid, dmeta = self.fetch_license_detail(chosen.detail_id)
        result["licid"] = licid
        result["detail_meta"] = dmeta
        if not licid:
            result["status"] = "unresolved"
            result["reason"] = "LicenseDetail HTML did not contain hidden numeric ID/licid"
            return result
        return result


def parse_search_hits(html: str) -> list[SearchHit]:
    text_html = htmlmod.unescape(html)
    hits: list[SearchHit] = []
    # Occupation is the cell before the name link.
    row_re = re.compile(
        r"<font[^>]*>([^<]{3,80})</font></td>"
        r"<td[^>]*><font[^>]*><a href='LicenseDetail\.asp\?SID=&id=([A-F0-9]+)'>([^<]+)</a></font></td>"
        r"<td[^>]*><font[^>]*>([^<]+)</font></td>"
        r"<td[^>]*><font[^>]*>([^<]*)<br/>([^<]*)</font></td>"
        r"<td[^>]*><font[^>]*>([^<]*)<br/>([^<]*)</font></td>",
        re.I,
    )
    for m in row_re.finditer(text_html):
        hits.append(
            SearchHit(
                occupation_label=re.sub(r"\s+", " ", m.group(1)).strip(),
                detail_id=m.group(2),
                name=re.sub(r"\s+", " ", m.group(3)).strip(),
                name_type=re.sub(r"\s+", " ", m.group(4)).strip(),
                license_cell=re.sub(r"\s+", " ", m.group(5)).strip(),
                status=re.sub(r"\s+", " ", f"{m.group(7)} {m.group(8)}").strip(),
                address="",
            )
        )
    licids = set(re.findall(r"licid=(\d+)", html, re.I))
    openlist = re.findall(r"openList\(\s*'(\d+)'", html, re.I)
    # Address rows follow
    addr_re = re.compile(
        r"Main Address\*:</b></span></font></td>\s*<td[^>]*><font[^>]*>([^<]+)</font>",
        re.I,
    )
    addrs = [re.sub(r"\s+", " ", a).strip() for a in addr_re.findall(htmlmod.unescape(html))]
    for i, h in enumerate(hits):
        if i < len(addrs):
            h.address = addrs[i]
        if len(licids) == 1:
            h.licid = next(iter(licids))
        elif i < len(openlist):
            h.licid = openlist[i]
    return hits


def parse_relation_header(html: str) -> dict[str, str]:
    text = re.sub(r"<[^>]+>", "\n", htmlmod.unescape(html))
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in text.split("\n")]
    lines = [ln for ln in lines if ln]
    blob = " | ".join(lines)
    name = ""
    m = re.search(r"Name:\s*\|\s*([^|]+)", blob)
    if m:
        name = m.group(1).strip()
    rank = ""
    m = re.search(r"Rank:\s*\|\s*([^|]+)", blob)
    if m:
        rank = m.group(1).strip()
    status = ""
    m = re.search(r"Primary Status:\s*\|\s*([^|]+)", blob)
    if m:
        status = m.group(1).strip()
    orig = ""
    m = re.search(r"Original License Date:\s*\|\s*(\d{2}/\d{2}/\d{4})", blob)
    if m:
        orig = m.group(1)
    return {
        "business_name": name,
        "rank": rank,
        "primary_status": status,
        "original_license_date": orig,
    }


def parse_relation_table(html: str) -> list[RelationRow]:
    """Parse Related License Information rows from licenseRelation.asp HTML."""
    text = htmlmod.unescape(html)
    # Strip tags to pipes for the data table region
    region = text
    idx = region.lower().find("related license information")
    if idx >= 0:
        region = region[idx:]
    end = region.lower().find("related license search")
    if end > 0:
        region = region[:end]
    plain = re.sub(r"<[^>]+>", "\n", region)
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in plain.split("\n")]
    lines = [ln for ln in lines if ln]
    rows: list[RelationRow] = []
    i = 0
    while i < len(lines):
        if re.fullmatch(r"[A-Z]{2,5}\d{5,}", lines[i]):
            lic = lines[i]
            nxt = lines[i + 1 : i + 12]
            status = nxt[0] if nxt else ""
            party = nxt[1] if len(nxt) > 1 else ""
            rel = ""
            eff = None
            rank = ""
            exp = None
            for j, tok in enumerate(nxt):
                low = tok.lower()
                if "qualifying agent" in low or "financial" in low or "responsible officer" in low:
                    rel = tok
                    if j + 1 < len(nxt) and re.fullmatch(r"\d{2}/\d{2}/\d{4}", nxt[j + 1]):
                        eff = _iso(nxt[j + 1])
                    if j + 2 < len(nxt):
                        rank = nxt[j + 2]
                    if j + 3 < len(nxt) and re.fullmatch(r"\d{2}/\d{2}/\d{4}", nxt[j + 3]):
                        exp = _iso(nxt[j + 3])
                    break
            if not rel:
                # skip header-like license tokens
                i += 1
                continue
            canon = canonical_rel_type(rel)
            rows.append(
                RelationRow(
                    license_number=lic,
                    status_raw=status,
                    related_party=party,
                    relationship_type_raw=rel,
                    relationship_type_canonical=canon,
                    effective_on=eff,
                    expiration_on=exp,
                    rank=rank,
                    current_or_historical=currentness(status, None),
                    ended_on=None,
                )
            )
            i += 1
        else:
            i += 1
    return rows


def _iso(mmddyyyy: str) -> str | None:
    try:
        return datetime.strptime(mmddyyyy, "%m/%d/%Y").date().isoformat()
    except ValueError:
        return None


def fingerprint(html: str) -> str:
    return hashlib.sha256(html.encode("utf-8", "replace")).hexdigest()


def normalize_name(s: str) -> str:
    s = htmlmod.unescape(s or "").upper()
    s = re.sub(r"[.,'\"()/\\-]+", " ", s)
    s = re.sub(r"\b(INC|LLC|L L C|CORP|CORPORATION|CO|COMPANY|LTD|PLLC|PA|LP)\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def extract_licid_from_license_detail(html: str) -> str | None:
    """Numeric licid from SPA LicenseDetail hidden input (id=ID / name=ID)."""
    patterns = [
        r'<input[^>]*\bid=["\']ID["\'][^>]*\bvalue=["\'](\d+)["\']',
        r'<input[^>]*\bname=["\']ID["\'][^>]*\bvalue=["\'](\d+)["\']',
        r'<input[^>]*\bvalue=["\'](\d+)["\'][^>]*\bid=["\']ID["\']',
        r'<input[^>]*\bvalue=["\'](\d+)["\'][^>]*\bname=["\']ID["\']',
        r'action="/portalsearches/VerifyLicensee/LicenseRelation"[^>]*>\s*'
        r'<input[^>]*\bvalue=["\'](\d+)["\']',
    ]
    for pat in patterns:
        m = re.search(pat, html, re.I | re.S)
        if m:
            return m.group(1)
    return None


def parse_license_detail(html: str) -> dict[str, Any]:
    """Official CBI detail fields. Phone/email are typically absent on this page."""
    text = htmlmod.unescape(html)
    plain = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    plain = re.sub(r"<[^>]+>", "\n", plain)
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in plain.split("\n")]
    lines = [ln for ln in lines if ln]

    def after(label: str) -> str:
        for i, ln in enumerate(lines):
            if ln.lower() == label.lower() and i + 1 < len(lines):
                nxt = lines[i + 1]
                if nxt.lower() in {
                    "name",
                    "main address",
                    "county",
                    "license type",
                    "rank",
                    "license number",
                    "licensure date",
                    "expires",
                    "license information",
                }:
                    return ""
                return nxt
        return ""

    tracking = bool(re.search(r"business tracking record only", text, re.I))
    phone = after("Phone") or after("Phone Number")
    email = after("Email") or after("E-Mail")
    # Agency footer is not a licensee contact.
    if "487.1395" in (phone or "") or "myfloridalicense.com" in (email or "").lower():
        phone, email = "", ""
    return {
        "name": after("Name"),
        "main_address": after("Main Address"),
        "county": after("County"),
        "license_type": after("License Type"),
        "rank": after("Rank"),
        "license_number": after("License Number"),
        "licensure_date": after("Licensure Date"),
        "expires": after("Expires"),
        "phone": phone,
        "email": email,
        "is_business_tracking_record": tracking,
        "has_phone": bool(phone),
        "has_email": bool(email),
    }


def names_compatible(a: str, b: str) -> bool:
    na, nb = normalize_name(a), normalize_name(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    if na in nb or nb in na:
        return True
    ta, tb = set(na.split()), set(nb.split())
    if not ta or not tb:
        return False
    overlap = ta & tb
    return len(overlap) >= min(2, len(ta), len(tb)) and overlap == ta.intersection(tb) and (
        ta <= tb or tb <= ta
    )


def zip5(z: str) -> str:
    digits = re.sub(r"\D", "", z or "")
    return digits[:5]


def street_token(addr: str) -> str:
    m = re.search(r"\b(\d{1,6})\b", addr or "")
    return m.group(1) if m else ""


def address_compatible(
    hit_addr: str,
    address: str,
    city: str,
    postal_code: str,
    state: str = "",
) -> bool:
    ha = (hit_addr or "").upper()
    if not ha:
        return False
    z = zip5(postal_code)
    if z and z in re.sub(r"\D", "", ha):
        tok = street_token(address)
        if tok and tok in ha:
            return True
        if (city or "").upper() and (city or "").upper() in ha:
            return True
    city_u = (city or "").upper()
    tok = street_token(address)
    if city_u and city_u in ha and tok and tok in ha:
        return True
    return False


def portal_business_key(licid: str) -> str:
    if not re.fullmatch(r"\d+", str(licid or "")):
        raise ValueError("licid must be numeric digits as published by DBPR")
    return f"fl_dbpr:portal_licid:{licid}"


def holder_key_for_credential(external_key: str) -> str:
    key = (external_key or "").strip().upper()
    if not key or key.isdigit():
        raise ValueError("holder key requires full license identity, not numeric core")
    return f"fl_dbpr:credential:{key}"


def relation_source_identifier(
    licid: str, license_number: str, canonical: str, effective_on: str | None
) -> str:
    return f"{licid}:{license_number}:{canonical}:{effective_on or ''}"
