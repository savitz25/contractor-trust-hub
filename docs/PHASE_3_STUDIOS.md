# Project Studios — Framework + Live Studios

**Get clearer on scope. See realistic ranges. Verify the right licensed contractors.**

## Live studios

| Slug | Name | Plan project type(s) |
|------|------|----------------------|
| `kitchen` | Kitchen Remodel | `kitchen_remodel` |
| `bathroom` | Bathroom Remodel | `bathroom_remodel` |
| `roofing` | Roofing | `roofing` |
| `addition` | Addition / Extension | `addition` |
| `basement` | Basement Finish | `basement_finish` |
| `exterior` | Exterior & Deck | `deck_outdoor`, `siding_exterior` |
| `whole-home` | Whole-Home Renovation | `full_home_renovation` |

Routes: `/studios`, `/studios/[slug]`, `/studios/[slug]/results`

## Framework

Add a studio with config only:

1. Create `lib/studios/<name>.ts` exporting `StudioDefinition`
2. Register in `lib/studios/registry.ts`
3. Optional: `relatedProjectTypes` for `/plan` deep-links
4. Optional: `resolveProjectType` when one studio spans multiple cost models (exterior)

### StudioDefinition highlights

- `primaryOccupationCodes` / `secondaryOccupationCodes` / `strictMatching`
- `steps[]` with single/multi fields
- `driverByAnswer` + `resolveScale` (+ optional `resolveUnitNote`)
- Client loads by **slug only** (functions never cross RSC boundary)

## APIs

- `POST /api/studios/match` — answers → cost + contractors
- `POST /api/plan/quote-request` — includes `studioSlug`, `answerSummary`, `studioAnswers`

## Matching

- Primary codes first; secondary only when local primary is thin
- Roofing: `strictMatching: true`
- Exterior may resolve cost model to siding vs deck from answers

## Out of scope

3D design, material SKUs, photo upload, multi-state engines, public ratings
