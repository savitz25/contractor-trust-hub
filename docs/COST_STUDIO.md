# Cost Studio

Interactive Florida project cost planning at **`/studio/cost`**.

For roofing specifically, prefer the dedicated **[Roofing Cost Calculator](./ROOFING_COST_CALCULATOR.md)** at **`/studio/roofing`**. For kitchens, use the **[Kitchen Cost Calculator](./KITCHEN_COST_CALCULATOR.md)** at **`/studio/kitchen`**. For bathrooms, use the **[Bathroom Cost Calculator](./BATHROOM_COST_CALCULATOR.md)** at **`/studio/bathroom`**.

## What it is

- Elevated planning tool on top of `data/plan/fl-cost-ranges.json`
- Optional scope factors from `data/plan/cost-studio-factors.json`
- Strong “planning only — not a bid” framing
- Path into verification: `/plan/results` (matched licenses) and Trust Reports

## What it is not

- Not contractor-specific pricing
- Not a formal bid, quote, or guarantee
- Not a lead marketplace
- Not 3D design or photo tools

## Architecture

| Asset | Role |
|-------|------|
| `data/plan/fl-cost-ranges.json` | Base low / mid / high by project type + scale |
| `data/plan/cost-studio-factors.json` | Scope factor questions + multipliers + education |
| `lib/plan/cost-model.ts` | Base range lookup |
| `lib/plan/cost-studio.ts` | Apply factors, round, assemble studio estimate |
| `components/studio/CostStudio.tsx` | Interactive UI |
| `app/studio/cost/page.tsx` | Route |

## How estimates are computed

1. Load base band for `projectType` + `scale` from `fl-cost-ranges.json`
2. For each factor option selected, multiply `lowMul` / `midMul` / `highMul`
3. Round to homeowner-friendly increments
4. Enforce `low ≤ mid ≤ high`
5. Show band hints + drivers from base data; show applied factor labels in UI

## How to update

### Change base money bands

Edit `data/plan/fl-cost-ranges.json` only.

### Change questions or multipliers

Edit `data/plan/cost-studio-factors.json`:

- `globalFactors` — apply to all project types  
- `byProjectType.<id>.extraFactors` — type-specific (e.g. roof system)  
- `byProjectType.<id>.education` — short calm notes  
- `floridaNotes` — statewide educational bullets  

Use `1.0` multipliers for the neutral default option.

## User path to verification

1. Cost Studio → **Find verified contractors** → `/plan/results?type=&scale=&zip=&city=`
2. Or **Open full Plan flow** → `/plan` with prefilled query  
3. From results → Trust Reports / compare / optional introduction request  

Location in the studio is used for matching handoff; it does **not** currently adjust statewide money bands (reserved for future metro refinements).
