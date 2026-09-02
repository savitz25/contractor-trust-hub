"""Minimal XLSX first-sheet reader (stdlib only). Sparse cells use A1 refs."""
from __future__ import annotations

import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
_COL = re.compile(r"^([A-Z]+)")


def column_index(cell_ref: str) -> int:
    match = _COL.match(cell_ref.upper())
    if not match:
        return 0
    n = 0
    for ch in match.group(1):
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def _shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    out: list[str] = []
    for si in root.findall("m:si", NS):
        out.append("".join(t.text or "" for t in si.findall(".//m:t", NS)))
    return out


def _cell_value(cell: ET.Element, shared: list[str]) -> str:
    kind = cell.attrib.get("t")
    value = cell.find("m:v", NS)
    inline = cell.find("m:is", NS)
    if kind == "s" and value is not None and value.text is not None:
        idx = int(value.text)
        return shared[idx] if 0 <= idx < len(shared) else ""
    if kind == "inlineStr" and inline is not None:
        return "".join(t.text or "" for t in inline.findall(".//m:t", NS))
    if value is not None and value.text is not None:
        return value.text
    return ""


def read_xlsx_rows(path: Path | str, *, sheet: str = "xl/worksheets/sheet1.xml") -> list[list[str]]:
    """Return rows as lists of strings, including the header row."""
    with zipfile.ZipFile(path) as zf:
        shared = _shared_strings(zf)
        if sheet not in zf.namelist():
            raise ValueError(f"xlsx sheet {sheet} missing in {path}")
        root = ET.fromstring(zf.read(sheet))
        rows_out: list[list[str]] = []
        for row in root.findall("m:sheetData/m:row", NS):
            cells: dict[int, str] = {}
            for cell in row.findall("m:c", NS):
                ref = cell.attrib.get("r") or ""
                cells[column_index(ref)] = _cell_value(cell, shared)
            if not cells:
                continue
            width = max(cells) + 1
            rows_out.append([cells.get(i, "") for i in range(width)])
        return rows_out


def read_xlsx_dicts(path: Path | str, *, sheet: str = "xl/worksheets/sheet1.xml") -> list[dict[str, str]]:
    rows = read_xlsx_rows(path, sheet=sheet)
    if not rows:
        return []
    header = [h.strip() for h in rows[0]]
    out: list[dict[str, str]] = []
    for row in rows[1:]:
        if not any(str(v).strip() for v in row):
            continue
        rec = {header[i]: (row[i].strip() if i < len(row) else "") for i in range(len(header)) if header[i]}
        out.append(rec)
    return out
