# Kitchen Cost Calculator

Interactive Florida kitchen remodel planning at **`/studio/kitchen`**.

Sibling tools: [Cost Studio](./COST_STUDIO.md) · [Bathroom Cost Calculator](./BATHROOM_COST_CALCULATOR.md) · [Roofing Cost Calculator](./ROOFING_COST_CALCULATOR.md) · Kitchen Studio Q&A at `/studios/kitchen`.

## What it is

- Config-driven planning bands on `fl-cost-ranges.json` (`kitchen_remodel`)
- Scope factors from `data/plan/kitchen-calculator.json`
- Strong “planning only — not a bid” framing
- Handoff into `/plan/results` for verified CGC / CBC / CRC matches

## What it is not

- Not contractor-specific pricing
- Not a formal bid, quote, or guarantee
- Not a lead marketplace
- Not available for Texas (Florida planning only)

## Architecture

| Asset | Role |
|-------|------|
| `data/plan/fl-cost-ranges.json` | Base low / mid / high by kitchen scale |
| `data/plan/kitchen-calculator.json` | Size, depth, layout, finish multipliers |
| `lib/plan/kitchen-calculator.ts` | Apply factors, round, assemble estimate |
| `components/studio/KitchenCostCalculator.tsx` | Interactive UI |
| `app/studio/kitchen/page.tsx` | Route |

## User path to verification

1. Kitchen calculator → **Find verified contractors** → `/plan/results?type=kitchen_remodel&…`
2. Or **Kitchen Studio Q&A** → `/studios/kitchen`
3. From results → Trust Reports (evidence only)
