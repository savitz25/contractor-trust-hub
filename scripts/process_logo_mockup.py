#!/usr/bin/env python3
"""
Process the design mockup into true-alpha brand PNGs.

Source (default):
  C:/Users/Michael.Savitsky/moch up design/contractor trust hub logo design.png

The mockup is RGB with a solid white plate. We key white → alpha, crop to content,
and write light + on-dark variants under public/brand/.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "brand"
DEFAULT_SRC = Path(
    r"C:\Users\Michael.Savitsky\moch up design\contractor trust hub logo design.png"
)


def key_white_to_alpha(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    opx = out.load()

    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            dist = ((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2) ** 0.5
            if dist < 18:
                opx[x, y] = (0, 0, 0, 0)
                continue
            if dist < 45 and abs(r - g) < 20 and abs(g - b) < 20:
                t = (dist - 18) / 27.0
                new_a = int(255 * t)
                opx[x, y] = (0, 0, 0, 0) if new_a < 12 else (r, g, b, new_a)
                continue
            opx[x, y] = (r, g, b, 255)
    return out


def content_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    w, h = im.size
    px = im.load()
    minx, miny, maxx, maxy = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 20:
                continue
            dist = ((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2) ** 0.5
            if dist < 30 and a < 200:
                continue
            found = True
            minx = min(minx, x)
            miny = min(miny, y)
            maxx = max(maxx, x)
            maxy = max(maxy, y)
    if not found:
        return (0, 0, w, h)
    return (minx, miny, maxx + 1, maxy + 1)


def to_on_dark(im: Image.Image) -> Image.Image:
    """Lift navy hub/text to light so the mark reads on dark headers."""
    dark = im.copy()
    px = dark.load()
    w, h = dark.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 10:
                continue
            # Distressed navy pixels (text/hub/lines) — any dark cool tone
            if r < 80 and g < 90 and b < 120 and b >= r - 5:
                px[x, y] = (232, 238, 249, a)
    return dark


def main() -> None:
    src = DEFAULT_SRC
    if not src.exists():
        raise SystemExit(f"Mockup not found: {src}")

    BRAND.mkdir(parents=True, exist_ok=True)
    keyed = key_white_to_alpha(Image.open(src))
    x0, y0, x1, y1 = content_bbox(keyed)
    pad = 12
    cropped = keyed.crop(
        (
            max(0, x0 - pad),
            max(0, y0 - pad),
            min(keyed.size[0], x1 + pad),
            min(keyed.size[1], y1 + pad),
        )
    )

    light = BRAND / "contractor-trust-hub-logo.png"
    dark_path = BRAND / "contractor-trust-hub-logo-on-dark.png"
    cropped.save(light, "PNG", optimize=True)
    to_on_dark(cropped).save(dark_path, "PNG", optimize=True)

    for name, path in [("logo", light), ("logo-on-dark", dark_path)]:
        im = Image.open(path)
        th = 160
        tw = int(im.size[0] * (th / im.size[1]))
        small = im.resize((tw, th), Image.Resampling.LANCZOS)
        small.save(BRAND / f"contractor-trust-hub-{name}-h160.png", "PNG", optimize=True)
        print(f"{name}: {im.size} → {path.name}")


if __name__ == "__main__":
    main()
