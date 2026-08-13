# Bathroom Cost Calculator

Interactive Florida bathroom remodel planning at **`/studio/bathroom`**.

Sibling tools: [Cost Studio](./COST_STUDIO.md) · [Kitchen Cost Calculator](./KITCHEN_COST_CALCULATOR.md) · [Roofing Cost Calculator](./ROOFING_COST_CALCULATOR.md) · Bathroom Studio Q&A at `/studios/bathroom`.

## What it is

- Config-driven planning bands on `fl-cost-ranges.json` (`bathroom_remodel`)
- Scope factors from `data/plan/bathroom-calculator.json`
- Strong “planning only — not a bid” framing
- Handoff into `/plan/results` for verified CRC / CBC / CGC / CFC matches

## What it is not

- Not contractor-specific pricing
- Not a formal bid, quote, or guarantee
- Not a lead marketplace
- Not available for Texas (Florida planning only)

## Inputs

| Control | Options | Effect |
|---------|---------|--------|
| Bath type | Powder / Standard full / Primary | Selects the base size band (`small` / `medium` / `large`) |
| Scope depth | Cosmetic refresh / Full remodel / Gut | Multipliers on the base band |
| Layout | Same footprint / Move fixtures slightly / Move fixtures or walls | Multipliers + may bump Plan matching scale |
| Finish | Standard / Mid / Premium | Multipliers |
| ZIP / city | Optional | Contractor matching only — does not change dollars |

## Assumptions

- Base dollars come from statewide Florida bathroom bands in `fl-cost-ranges.json`.
- Multipliers are relative planning factors, not market quotes.
- Powder + refresh stays in the small matching scale unless a gut or major layout is selected.
- Primary + gut or major layout can bump matching to the large scale.

## Architecture

| Asset | Role |
|-------|------|
| `data/plan/fl-cost-ranges.json` | Base low / mid / high by bathroom scale |
| `data/plan/bathroom-calculator.json` | Type, depth, layout, finish multipliers + copy |
| `lib/plan/bathroom-calculator.ts` | Apply factors, round, assemble estimate |
| `components/studio/BathroomCostCalculator.tsx` | Interactive UI |
| `app/studio/bathroom/page.tsx` | Route |

## How to update the model

1. Change **base money bands** in `data/plan/fl-cost-ranges.json` (`bathroom_remodel` rows).
2. Change **questions, multipliers, or Florida notes** in `data/plan/bathroom-calculator.json`.
3. Keep default option multipliers at `1.0` for the neutral “full remodel / mid finish / minor layout” path.
4. Do not invent contractor-specific prices in either file.

## User path to verification

1. Bathroom calculator → **Find verified contractors** → `/plan/results?type=bathroom_remodel&…`
2. Or **Bathroom Studio Q&A** → `/studios/bathroom`
3. From results → Trust Reports (evidence only)
