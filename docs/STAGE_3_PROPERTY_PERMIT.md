# Stage 3 — Property & Permit Intelligence

**Address-first research · Permit planner · Progressive coverage · Honest empty states**

Florida-first. Educational only — not a title search, not legal advice, not an AHJ determination.

## Routes

| Path | Purpose |
|------|---------|
| `/property` | Check My Address entry |
| `/property/[id]` | Property research result |
| `/property/results` | Query-param entry → redirects to id URL |
| `/tools/property`, `/tools/check-address` | Aliases → `/property` |
| `/tools/permit-planner` | Permit & Inspection Planner |
| `POST /api/property/lookup` | JSON research API |

## Coverage model

Levels: `full` | `partial` | `jurisdiction_unsupported` | `source_unavailable`

Defined in `lib/property/coverage.ts` (matrix). Expand as extracts connect.

User-facing labels always explain what was checked vs not checked.

## Property research flow

1. Address + FL ZIP → county best-effort (`lib/plan/location.ts`)
2. Coverage matrix lookup
3. Pilot extract match by normalized address key (`data/property/sample-permits.json`)
4. Result states: resolved with rows / resolved empty / limited / unresolved

### Pilot sample (UI demo only)

- `100 Ocean Drive, Miami Beach, FL 33139` — kitchen + electrical + open windows sample
- `500 E Las Olas Blvd, Fort Lauderdale, FL 33301` — re-roof sample

Samples are labeled **CTH pilot sample extract** — not a live AHJ feed.

## Permit matching rules

- Prefer license number for Trust Report deep links
- Name-only → verify search link; **no** auto slug invent
- Match confidence: `license` | `strict_name` | `none`

## Permit Planner

`lib/property/planner.ts`

Inputs: project type, ZIP/city/county, scope factors (electrical, plumbing, structural, HVAC, roofing, windows, occupied).

Outputs: likely categories, contractor questions, homeowner cautions, AHJ next step + disclaimer.

## Context handoff

- Session key: `cth-property-context`
- Chip: `PropertyContextChip` in root layout
- Flows into plan links, permit planner prefills, decision tools cards

## Trust Report activity

`lib/contractors/activity-signals.ts` joins license keys against `contractorActivityByLicense` when populated; otherwise honest empty state + links to property tools.

## Localized cost notes

`lib/property/cost-notes.ts` — qualitative coastal/county notes only. No hyperlocal multipliers without data.

## Language standards

Prefer:
- “Appears open in available records”
- “Finalization not shown in current extracts”
- “No permit records matched … does not prove a clean history”
- “Local AHJ rules control”

Avoid:
- Property scores
- Guaranteeing open-permit liability
- “Complete county history”
- Equating permit volume with quality

## Expand next

1. Real jurisdiction extracts (Miami-Dade, Broward, Orange first)
2. High-confidence license-key contractor joins from DB
3. Optional county cost band notes when data-backed
