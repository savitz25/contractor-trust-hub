# Phase 3 (Studios Phase 1) — Project Studio Framework

**Get clearer on scope. See realistic ranges. Verify the right licensed contractors.**

## Routes

| Path | Purpose |
|------|---------|
| `/studios` | Hub listing live studios |
| `/studios/kitchen` | Kitchen Remodel Studio |
| `/studios/bathroom` | Bathroom Remodel Studio |
| `/studios/roofing` | Roofing Studio |
| `/studios/[slug]/results` | Cost + match + introduction |

## Framework

Add a new studio with mostly config:

1. Create `lib/studios/<name>.ts` exporting a `StudioDefinition`
2. Register in `lib/studios/registry.ts`
3. That’s it — flow UI, results, APIs, and quote payload reuse automatically

### StudioDefinition fields

- `slug`, `projectType`, copy (`headline`, `positioning`)
- `primaryOccupationCodes` / `secondaryOccupationCodes` / `strictMatching`
- `steps[]` with single/multi fields
- `baseCostDrivers`, `driverByAnswer`, `resolveScale`, optional `resolveUnitNote`

## APIs

- `POST /api/studios/match` — studio answers → cost + contractors
- `POST /api/plan/quote-request` — accepts `studioSlug`, `answerSummary`, `studioAnswers`

## Matching rules

- Primary codes first; secondary only when local primary is thin
- Roofing uses `strictMatching: true` (no over-broad CGC expansion when possible)

## Out of scope (this phase)

3D design, material SKUs, photo upload, multi-state, public ratings
