# Plan matching (quality rules)

How `/plan` → `/plan/results` (and Cost Studio → results handoff) selects contractors. **Accuracy over volume.** Fewer strong matches beat a page of weak ones.

## Configuration

| File | Role |
|------|------|
| `data/plan/project-license-map.json` | Project type → primary/secondary DBPR codes + notes |
| `lib/plan/license-map.ts` | Loads JSON; used by matching |
| `lib/plan/location.ts` | ZIP5 / ZIP3 → county + discovery county codes |
| `lib/plan/matching.ts` | ZIP cascade, primary-first, notes, empty/thin handling |

## Focus trades (2026-08 quality review)

| Project type | Primary (order = preference) | Secondary | Intent |
|--------------|------------------------------|-----------|--------|
| **Roofing** | `CCC`, `RR` | *(none)* | Specialty only — never CGC as a roofing substitute |
| **Kitchen** | `CRC`, `CBC`, `CGC` | `CFC` only if local primary empty | Residential/building first so commercial CGC noise drops |
| **Bathroom** | `CRC`, `CFC`, `CBC` | `CGC` only if local primary empty | Remodel + plumbing preferred; CGC not default |
| **General / whole-home / addition** | `CRC`, `CBC`, `CGC` | *(none)* | Residential-first ranking for homeowner plans |

Edit the JSON map to maintain mappings; document tradeoffs in each entry’s `notes`.

## Location cascade

When the homeowner provides location, we **do not** immediately OR ZIP + city + county (that used to flood county-wide CGCs over true ZIP matches).

1. **ZIP only** + primary codes (if ZIP present)  
2. If fewer than **2** local matches → **city** + primary  
3. If still fewer than **2** → **county** + primary  
4. If still **0** local primary → optional **secondary** codes, same area only  
5. If still fewer than **2** local → **statewide** preferred classes only (labeled)

Thresholds in `matching.ts`: `MIN_LOCAL_STRONG = 2`, `MIN_PRIMARY_LOCAL = 1` (secondary only when primary local is empty).

## Honesty rules

- Active/current licenses only; no invented matches to fill the page.
- Secondary codes are rare and disclosed as “related class”.
- Statewide fallback is labeled on the card and in match notes.
- Result cards show chips: preferred/related class, location tier, status — plus expandable detail.

## Plan + Cost Studio handoff

Both send the same query shape to `/plan/results` / `POST /api/plan/match`:

- `type` (project type id), `scale`, `state=FL`, optional `zip`, `city`, `county`

Cost Studio does not change occupation mapping; it only carries project type + location into this matcher.

## Remaining limitations

- ZIP3→county remains approximate for some prefixes (ZIP5 overrides for common metros).
- Board rows with empty county and non-matching ZIP may miss local county steps until statewide.
- We do not filter by business name semantics (e.g. “dredging” under CGC) — only license class + location evidence.
- High-volume GC classes will still include multi-trade firms that also hold CRC/CBC/CGC; verification is the homeowner’s next step on each Trust Report.
- Rural ZIPs with sparse specialty licenses may correctly show thin local + statewide specialty (especially roofing CCC/RR).

## Audit tooling

`node scripts/audit-plan-matching.mjs` — density checks by ZIP/county for focus codes (requires `DATABASE_URL`).
