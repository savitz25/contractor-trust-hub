# Project Studios — Framework + Live Studios

**Get clearer on scope. See realistic ranges. Verify the right licensed contractors.**

## Live studios

| Slug | Name | Plan project type(s) |
|------|------|----------------------|
| `kitchen` | Kitchen Remodel | `kitchen_remodel` |
| `bathroom` | Bathroom Remodel | `bathroom_remodel` |
| `roofing` | Roofing (full replacement first-class) | `roofing` |
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

## Phase 3 — Smarter fit · Trust Report handoff · conversion

### Fit context (results cards)
- `lib/studios/fit-notes.ts` — rule-based fit note + chips (primary/secondary class, status, location tier, Sunbiz)
- `StudioMatchCard` — “Why this matched” (evidence only, no ranking)
- Coverage summary: local / mixed / statewide / secondary_heavy

### Trust Report handoff
- Query params via `lib/studios/handoff.ts` (`from=studio`, `studio`, `back`, `summary`, …)
- `StudioHandoffBanner` on `/contractors/[slug]`
- CTA: controlled introduction with studio scope pre-attached

### Thin / empty states
- `StudioThinState` — empty, statewide-only, secondary-only, thin-local
- Actionable next steps (adjust scope, verify name, browse FL, other studio)

### Introduction payload extras
- `sourcePath`: `studio_results` | `trust_report`
- `focusedContractor` when started from a specific card/profile

### Conversion polish
- Hierarchy: sticky scope → planning range (secondary) → contractors (primary) → next steps
- Jump links, mobile bottom CTA, “controlled introduction” language

## Out of scope

3D design, material SKUs, photo upload, multi-state engines, public ratings
