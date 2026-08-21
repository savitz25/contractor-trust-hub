# Brand assets — Contractor Trust Hub

**Official slogan:** `BEFORE YOU HIRE, VERIFY.`

**Migration:** CONTRACTOR-BRAND-001 — heavy filled brackets retired. Canonical TrustHub stroke geometry (Ask/Move family) is mandatory.

## Official files

| File | Use |
|------|-----|
| `contractor-trust-hub-logo.svg` | **FULL** official lockup (mark + CONTRACTOR + TRUST HUB + slogan) — footer, marketing, JSON-LD |
| `contractor-trust-hub-logo-compact.svg` | **COMPACT** network header lockup (no slogan) — 36/33/30 optical slot |
| `contractor-trust-hub-logo-on-dark.svg` | Full lockup for dark surfaces |
| `contractor-trust-hub-logo-compact-on-dark.svg` | Compact dark-surface header |
| `contractor-trust-hub-logo.png` / `-h160.png` | Raster of full lockup (light) |
| `contractor-trust-hub-logo-on-dark.png` / `-h160.png` | Raster of full lockup (dark) |
| `contractor-trust-hub-mark.svg` / `.png` | Square mark only (canonical thin brackets) |
| `favicon-192.png` / `favicon-512.png` | PWA / browser icons from mark |
| `apple-touch-icon.png` | iOS home screen from mark |
| `contractor-trust-hub-og.png` | 1200×630 Open Graph fallback |

**Owner-approved source raster:** `docs/artifacts/contractor-brand-001/contractor_trust_hub_logo_with_slogan.png`  
(from `moch up design/contractor trust hub log.png`)

**Rebuild rasters:** `python scripts/export_brand_pngs.py`  
**Do not run:** `scripts/process_logo_mockup.py` (retired — exits 2)

## Header vs full lockup

| Surface | Lockup | Slogan |
|---------|--------|--------|
| Site header (36px optical) | compact | omitted (illegible at network chrome size) |
| Footer / marketing | full | `BEFORE YOU HIRE, VERIFY.` |

Network visual-standard geometry takes precedence over squeezing slogan into the header.

## Colors

| Role | Hex |
|------|-----|
| Yellow / gold (brackets + CONTRACTOR + slogan) | `#F5C518` |
| Navy (TRUST HUB + hub center + lines) | `#0A2540` |
| Node top | `#F28C28` |
| Node left | `#2F80ED` |
| Node right | `#2BBBAD` |
| Node bottom | `#8B5CF6` |

## Canonical TrustHub mark rule

> The bracket-and-four-point TrustHub mark is immutable network geometry. Hub identity changes through accent color and wordmark, not through bracket thickness, proportions, dot geometry or spacing.

| Spec | Value |
|------|-------|
| viewBox | `0 0 36 36` |
| bracket stroke | `2.4` (~6.67% of mark height) |
| outer dots | `r = 2.5` |
| center | `r = 2.1` |
| spacing | `≈ 7.8` |

## Rules

- Transparent background only (no white plate).
- Flat design: no shadows, no text gradients.
- Prefer SVG for UI chrome; PNG for social / raster fallbacks.
- Never reintroduce filled ~16%-thickness Contractor brackets.
