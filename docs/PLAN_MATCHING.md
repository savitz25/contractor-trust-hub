# Plan matching (quality rules)

How `/plan` → `/plan/results` selects contractors. **Accuracy over volume.**

## Configuration

| File | Role |
|------|------|
| `data/plan/project-license-map.json` | Project type → primary/secondary DBPR codes + notes |
| `lib/plan/license-map.ts` | Loads JSON; used by matching |
| `lib/plan/location.ts` | ZIP5 / ZIP3 → county + discovery county codes |
| `lib/plan/matching.ts` | Query tiers, notes, empty/thin handling |

## Project → license mapping

- **Primary** codes are preferred (e.g. roofing → `CCC`, `RR`).
- **Secondary** codes only expand when *local primary* results are thin (e.g. roofing may add `CGC` locally only if few CCC/RR).
- Matching requires `status_normalized IN ('active','current')`.
- Never mixes unrelated trades to fill the page.

Edit the JSON map to maintain mappings; document tradeoffs in each entry’s `notes`.

## Location tiers

1. **ZIP** (board postal code)  
2. **City** (exact match on license / contractor city)  
3. **County** (exact name + known DBPR `county_code`s)  
4. **Statewide** — only if local count &lt; 3; same occupation set only  

ZIP→county uses ZIP5 overrides where known, else ZIP3 (approximate; multi-county prefixes exist).

## Honesty rules

- Do not invent ratings or stretch occupation filters.
- Statewide fallback is labeled in match notes and per-card “Why this matched”.
- Empty state explains lack of strong matches and offers Plan edit / Florida browse / Verify.

## Remaining limitations

- ZIP3→county remains approximate for some prefixes.
- Board rows with numeric-only county and no known code may not match county filters.
- Secondary codes can still surface multi-trade GCs for specialty work when local specialty is thin — intentional and disclosed.
