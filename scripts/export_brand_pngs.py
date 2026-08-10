#!/usr/bin/env python3
"""Rasterize brand SVGs / package reference logo into public/brand PNGs."""

from __future__ import annotations

import shutil
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "brand"
REF = Path(r"C:\Users\Michael.Savitsky\moch up design\contractor trust hub logo design.png")


def write_png_rgba(path: Path, width: int, height: int, rgba: bytes) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = b""
    row = width * 4
    for y in range(height):
        raw += b"\x00" + rgba[y * row : (y + 1) * row]
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def draw_mark_png(size: int = 512) -> bytes:
    """Simple crisp raster of the square mark (RGBA)."""
    from array import array

    px = array("B", [0] * (size * size * 4))

    def setp(x: int, y: int, r: int, g: int, b: int, a: int = 255) -> None:
        if 0 <= x < size and 0 <= y < size:
            i = (y * size + x) * 4
            px[i : i + 4] = array("B", [r, g, b, a])

    def fill_circle(cx: float, cy: float, rad: float, color: tuple[int, int, int]) -> None:
        r0 = int(rad) + 1
        for y in range(int(cy) - r0, int(cy) + r0 + 1):
            for x in range(int(cx) - r0, int(cx) + r0 + 1):
                if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= rad * rad:
                    setp(x, y, *color)

    def thick_line(x0: float, y0: float, x1: float, y1: float, w: float, color: tuple[int, int, int]) -> None:
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(steps + 1):
            t = i / steps
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t
            fill_circle(x, y, w / 2, color)

    yellow = (245, 197, 24)
    navy = (10, 37, 64)
    orange = (242, 140, 40)
    blue = (47, 128, 237)
    teal = (43, 187, 173)
    purple = (139, 92, 246)

    # Bracket geometry scaled to canvas
    pad = size * 0.08
    left = pad
    right = size - pad
    top = pad
    bot = size - pad
    thickness = size * 0.09
    arm = size * 0.16

    def fill_rect(x0, y0, x1, y1, color):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                setp(x, y, *color)

    # Left bracket [
    fill_rect(left, top, left + thickness, bot, yellow)
    fill_rect(left, top, left + arm, top + thickness, yellow)
    fill_rect(left, bot - thickness, left + arm, bot, yellow)
    # Right bracket ]
    fill_rect(right - thickness, top, right, bot, yellow)
    fill_rect(right - arm, top, right, top + thickness, yellow)
    fill_rect(right - arm, bot - thickness, right, bot, yellow)

    cx = cy = size / 2
    arm_len = size * 0.22
    node_r = size * 0.055
    center_r = size * 0.075
    line_w = size * 0.028

    thick_line(cx, cy - arm_len, cx, cy + arm_len, line_w, navy)
    thick_line(cx - arm_len, cy, cx + arm_len, cy, line_w, navy)
    fill_circle(cx, cy - arm_len, node_r, orange)
    fill_circle(cx - arm_len, cy, node_r, blue)
    fill_circle(cx + arm_len, cy, node_r, teal)
    fill_circle(cx, cy + arm_len, node_r, purple)
    fill_circle(cx, cy, center_r, navy)

    return px.tobytes()


def main() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)

    if REF.exists():
        dest = BRAND / "contractor-trust-hub-logo.png"
        shutil.copy2(REF, dest)
        print(f"Copied reference logo → {dest}")
    else:
        print(f"Reference not found: {REF}")

    mark_bytes = draw_mark_png(512)
    write_png_rgba(BRAND / "contractor-trust-hub-mark.png", 512, 512, mark_bytes)
    write_png_rgba(BRAND / "favicon-512.png", 512, 512, mark_bytes)
    write_png_rgba(BRAND / "favicon-192.png", 192, 192, draw_mark_png(192))
    write_png_rgba(BRAND / "apple-touch-icon.png", 180, 180, draw_mark_png(180))
    print("Wrote mark + favicon PNGs")


if __name__ == "__main__":
    main()
