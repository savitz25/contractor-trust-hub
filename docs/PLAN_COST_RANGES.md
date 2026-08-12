# Florida plan cost ranges

Data-driven planning bands for `/plan` → `/plan/results` and as the base for **[Cost Studio](./COST_STUDIO.md)** (`/studio/cost`).

## Source of truth

| File | Role |
|------|------|
| `data/plan/fl-cost-ranges.json` | All low/mid/high amounts, drivers, band hints |
| `data/plan/cost-studio-factors.json` | Scope factors + multipliers for Cost Studio |
| `lib/plan/cost-model.ts` | Lookup + formatting only |
| `lib/plan/cost-studio.ts` | Factor multipliers on top of base bands |

**Update ranges by editing the JSON** — no code deploy logic required beyond rebuild. See `docs/COST_STUDIO.md` for interactive factor updates.

## Fields per row

| Field | Purpose |
|-------|---------|
| `projectType` + `scale` | Key (`small` / `medium` / `large`) |
| `low` / `mid` / `high` | Planning USD band |
| `unitNote` | What the scale means in plain language |
| `bandHints.low/mid/high` | What typically sits at each end of the band |
| `drivers` | Factors that move cost overall |

## Positioning

- Planning context only — never bids, quotes, or guarantees
- Not contractor-specific pricing
- Supports contractor verification section; does not replace it

## Limitations

- Statewide FL bands — no metro-level adjustment yet
- Market labor/material swings can move real bids outside bands
- Owner-supplied materials, HOA rules, and insurance claims alter reality
- Custom homes and large additions have very wide variance

Version field: `version` / `updatedAt` inside the JSON.
