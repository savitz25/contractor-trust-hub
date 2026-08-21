#!/usr/bin/env python3
"""
OBSOLETE — CONTRACTOR-BRAND-001

This script previously keyed the OLD heavy-bracket mockup
(`moch up design/contractor trust hub logo design.png`) into public/brand PNGs.

That geometry is retired. Running this script would regenerate the overweight
filled brackets and is intentionally blocked.

Use instead:
  python scripts/export_brand_pngs.py

Authoritative masters:
  public/brand/contractor-trust-hub-mark.svg          (canonical thin brackets)
  public/brand/contractor-trust-hub-logo.svg          (full + slogan)
  public/brand/contractor-trust-hub-logo-compact.svg  (header, no slogan)

Owner source (reference raster):
  docs/artifacts/contractor-brand-001/contractor_trust_hub_logo_with_slogan.png
"""

from __future__ import annotations

import sys

OBSOLETE_MSG = """
CONTRACTOR-BRAND-001: process_logo_mockup.py is retired.

It would regenerate the OLD heavy filled Contractor brackets from the obsolete
mockup and must not be run.

Use:  python scripts/export_brand_pngs.py
Docs: public/brand/README.md
""".strip()


def main() -> None:
    print(OBSOLETE_MSG, file=sys.stderr)
    raise SystemExit(2)


if __name__ == "__main__":
    main()
