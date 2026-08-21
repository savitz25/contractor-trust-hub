#!/usr/bin/env python3
"""
Rasterize CONTRACTOR-BRAND-001 SVG masters into public/brand PNGs.

Uses Playwright (Chromium) to render SVG → PNG so geometry matches the
canonical stroke mark. Does NOT recreate the obsolete heavy filled brackets.

Requires: pip install playwright && playwright install chromium
Optional: pillow for OG assembly / resize.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "brand"
ART = ROOT / "docs" / "artifacts" / "contractor-brand-001"
OWNER_SRC = ART / "contractor_trust_hub_logo_with_slogan.png"

# Canonical mark geometry (must match SVG masters)
CANONICAL_STROKE = 2.4
VIEWBOX = "0 0 36 36"


def fail_if_heavy_svg(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    if 'fill="#F5C518"' in text and "M78 28" in text:
        raise SystemExit(f"Heavy legacy bracket paths still present in {path}")
    if 'stroke-width="2.4"' not in text and path.name.endswith("mark.svg"):
        raise SystemExit(f"Canonical stroke missing in {path}")


async def render_svg_png(svg_path: Path, out_path: Path, width: int, height: int) -> None:
    from playwright.async_api import async_playwright

    svg = svg_path.read_text(encoding="utf-8")
    html = f"""<!DOCTYPE html><html><head><style>
      html,body{{margin:0;padding:0;background:transparent}}
      svg{{display:block;width:{width}px;height:{height}px}}
    </style></head><body>{svg}</body></html>"""

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(
            viewport={"width": width, "height": height},
            device_scale_factor=1,
        )
        await page.set_content(html, wait_until="load")
        await page.screenshot(path=str(out_path), type="png", omit_background=True)
        await browser.close()
    print(f"Wrote {out_path.name} ({width}×{height})")


async def main_async() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)

    mark = BRAND / "contractor-trust-hub-mark.svg"
    logo = BRAND / "contractor-trust-hub-logo.svg"
    logo_dark = BRAND / "contractor-trust-hub-logo-on-dark.svg"
    compact = BRAND / "contractor-trust-hub-logo-compact.svg"

    for p in (mark, logo, logo_dark, compact):
        if not p.exists():
            raise SystemExit(f"Missing SVG master: {p}")
        fail_if_heavy_svg(p)

    # Square mark / favicons
    await render_svg_png(mark, BRAND / "contractor-trust-hub-mark.png", 512, 512)
    await render_svg_png(mark, BRAND / "favicon-512.png", 512, 512)
    await render_svg_png(mark, BRAND / "favicon-192.png", 192, 192)
    await render_svg_png(mark, BRAND / "apple-touch-icon.png", 180, 180)

    # Full lockup PNGs (light + dark)
    await render_svg_png(logo, BRAND / "contractor-trust-hub-logo.png", 720, 176)
    await render_svg_png(logo_dark, BRAND / "contractor-trust-hub-logo-on-dark.png", 720, 176)
    await render_svg_png(logo, BRAND / "contractor-trust-hub-logo-h160.png", 655, 160)
    await render_svg_png(logo_dark, BRAND / "contractor-trust-hub-logo-on-dark-h160.png", 655, 160)

    # Compact header PNG (optional fallback)
    await render_svg_png(compact, BRAND / "contractor-trust-hub-logo-compact.png", 472, 72)

    # OG 1200×630 — brand on dark navy field (inline SVG mark)
    from playwright.async_api import async_playwright

    mark_inner = mark.read_text(encoding="utf-8")
    # Strip XML declaration / outer svg attrs for embed; keep as-is scaled
    og_html = f"""<!DOCTYPE html><html><head><style>
      *{{box-sizing:border-box;margin:0}}
      body{{width:1200px;height:630px;background:linear-gradient(145deg,#071428 0%,#0a1f3d 55%,#102a4c 100%);
        font-family:Inter,system-ui,sans-serif;color:#fff;display:flex;align-items:center;padding:64px;
        border-left:10px solid #F5C518;position:relative}}
      .lock{{display:flex;align-items:center;gap:28px}}
      .mark{{width:120px;height:120px;flex-shrink:0}}
      .mark svg{{width:120px;height:120px;display:block}}
      .wm b{{display:block;font-size:54px;letter-spacing:.06em;color:#F5C518;font-weight:800}}
      .wm span{{display:block;font-size:28px;letter-spacing:.14em;font-weight:800;color:#E8EEF9;margin-top:6px}}
      .slogan{{margin-top:18px;font-size:20px;letter-spacing:.14em;font-weight:700;color:#F5C518}}
      .meta{{position:absolute;bottom:48px;left:64px;right:64px;display:flex;justify-content:space-between;
        font-size:18px;font-weight:700;color:#cbd5e1}}
      .meta strong{{color:#F5C518}}
    </style></head><body>
      <div class="lock">
        <div class="mark">{mark_inner}</div>
        <div>
          <div class="wm"><b>CONTRACTOR</b><span>TRUST HUB</span></div>
          <div class="slogan">BEFORE YOU HIRE, VERIFY.</div>
        </div>
      </div>
      <div class="meta"><span>Independent consumer research</span><strong>contractortrusthub.com</strong></div>
    </body></html>"""

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
        await page.set_content(og_html, wait_until="load")
        await page.wait_for_timeout(200)
        await page.screenshot(path=str(BRAND / "contractor-trust-hub-og.png"), type="png")
        await browser.close()
    print("Wrote contractor-trust-hub-og.png (1200×630)")

    if OWNER_SRC.exists():
        print(f"Owner source present: {OWNER_SRC.name} ({OWNER_SRC.stat().st_size} bytes)")
    else:
        print("WARNING: owner source PNG not in artifacts — SVG masters are authoritative")

    print("Canonical stroke:", CANONICAL_STROKE, "viewBox:", VIEWBOX)


def main() -> None:
    try:
        asyncio.run(main_async())
    except ImportError:
        print("Install: pip install playwright && playwright install chromium", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
