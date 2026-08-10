# Brand assets — Contractor Trust Hub

**Tagline:** Before you hire, verify.

## Official files

| File | Use |
|------|-----|
| `contractor-trust-hub-logo-on-dark.png` | **UI default** wordmark on dark headers (true alpha, from mockup). |
| `contractor-trust-hub-logo.png` | Wordmark for light surfaces (true alpha, from mockup). |
| `contractor-trust-hub-logo-on-dark.svg` | Vector fallback for dark UI. |
| `contractor-trust-hub-logo.svg` | Vector fallback for light UI. |
| `contractor-trust-hub-mark.svg` | Square app / favicon mark (icon only). |
| `favicon-192.png` / `favicon-512.png` | PWA / browser icons. |
| `apple-touch-icon.png` | iOS home screen. |

**Source mockup:** `moch up design/contractor trust hub logo design.png`  
**Reprocess:** `python scripts/process_logo_mockup.py` (keys white plate → alpha, crops, writes on-dark).

**UI rule:** `BrandLogo` with `surface="onDark"` on this site. Assets must be RGBA with transparent corners — never a white plate.

## Colors

| Role | Hex |
|------|-----|
| Yellow (brackets + CONTRACTOR) | `#F5C518` |
| Navy (TRUST HUB + hub center + lines) | `#0A2540` |
| Node top | `#F28C28` (orange) |
| Node left | `#2F80ED` (blue) |
| Node right | `#2BBBAD` (teal) |
| Node bottom | `#8B5CF6` (purple) |

## Rules

- Transparent background only on logo exports (no white plate).
- Flat design: no shadows, no text gradients.
- Prefer PNG wordmark for marketing screenshots; SVG for UI chrome and favicons.
