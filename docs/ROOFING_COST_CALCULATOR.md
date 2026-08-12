# Roofing Cost Calculator

Dedicated Florida roofing planning tool at **`/studio/roofing`**.

## What it is

- Interactive low / mid / high **planning** ranges for a typical home reroof or major roofing project
- Inputs that actually move cost: size, material/system, stories/access, pitch/complexity
- Optional ZIP / city for **contractor matching only** (not local price invention)
- Clear path to verified **CCC / RR** roofing licenses via Plan results

## What it is not

- Not a bid, quote, or guarantee
- Not contractor-specific pricing
- Not insurance claim pricing
- Not a lead marketplace

## Architecture

| Asset | Role |
|-------|------|
| `data/plan/fl-cost-ranges.json` | Base roofing dollars by size scale (`small` / `medium` / `large`) |
| `data/plan/roofing-calculator.json` | Size / material / stories / pitch options + multipliers + FL notes |
| `lib/plan/roofing-calculator.ts` | Apply multipliers, round, assemble drivers |
| `components/studio/RoofingCostCalculator.tsx` | Interactive UI |
| `app/studio/roofing/page.tsx` | Route |

Related: multi-trade [Cost Studio](./COST_STUDIO.md) at `/studio/cost`. Matching rules: [PLAN_MATCHING.md](./PLAN_MATCHING.md).

## Inputs

| Input | Effect |
|-------|--------|
| **Roof size** | Selects base band (`small` / `medium` / `large` from `fl-cost-ranges.json`). Home sq ft is a rough proxy for roof squares. |
| **Material / system** | Multipliers for shingle, premium shingle, metal, tile, low-slope membrane |
| **Stories / access** | Labor/staging factor (one-story easy → multi-story / hard access) |
| **Pitch / complexity** | Shape and detail factor (simple → complex) |
| **ZIP / city** | Matching handoff only |

Neutral defaults use `1.0` multipliers so the mid band tracks the base size band for a standard shingle, two-story, moderate roof.

## How the number is computed

1. Map size → `scale` and load base low/mid/high from `fl-cost-ranges.json` (`projectType: roofing`)
2. Multiply by each selected factor’s `lowMul` / `midMul` / `highMul`
3. Round to homeowner-friendly increments; enforce `low ≤ mid ≤ high`
4. Build plain-language “what is pushing” lines from each factor’s `push` + `explain`
5. Location is **not** applied to dollars

## How to update

### Change base money for roof size bands

Edit the three `roofing` rows in `data/plan/fl-cost-ranges.json`.

### Change questions, materials, or relative factors

Edit `data/plan/roofing-calculator.json`:

- `sizeOptions` — labels and which `scale` each size maps to  
- `materialOptions` / `storiesOptions` / `pitchOptions` — labels + multipliers  
- `defaults` — initial selections  
- `floridaNotes` / `education` / `disclaimer`  

Keep the baseline option (e.g. architectural shingles, moderate pitch) at `1.0` multipliers.

## Path to verification

1. **Find verified roofers** → `/plan/results?type=roofing&scale=&zip=&city=`  
2. Matching uses **CCC + RR only** (see project license map)  
3. Trust Reports from each result card  
4. Optional: full Plan flow, Verify by name, or `/florida/roofers` browse  

Cost Studio and Plan handoffs use the same `encodePlanQuery` shape.

## Assumptions and limits

- Statewide Florida planning factors — no metro price tables yet  
- Size is approximate (home footprint proxy), not a measured square count  
- Does not model layers of tear-off, deck replacement %, or claim-driven upgrades as separate line items (those sit inside band language)  
- Prefer fewer honest bands over false precision  
