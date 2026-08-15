# Trust Report — summary rules & state-scoped copy

**Route:** `/contractors/[slug]`  
**Related:** [TRUST_REPORT_2.md](./TRUST_REPORT_2.md) (depth modules), [VERIFY_PRODUCT.md](./VERIFY_PRODUCT.md)

## First screen (20-second answer)

Above the fold, every Trust Report shows:

1. **Identity** — name, state/board context, license badge, extract freshness  
2. **Evidence summary** (`#evidence-summary`) — calm status cards, **no score**  
   - License status  
   - Entity **only** when the state auto-links entities (FL Sunbiz; NJ high-confidence when present) or a state-specific secondary field (trade type, bond as published, specialty type)  
   - Discipline / coverage honesty in extract  
   - Insurance path (official links or “ask contractor” — **never invent coverage**)  
3. **What this means for you** (`#what-this-means`) — 3–5 plain-language bullets from evidence already on the report  
4. **Primary actions** (`#report-actions`)  
   - Open official board verify  
   - Watch this contractor  
   - **Share summary** / **Print summary** → clean shareable surface  
   - Request correction (secondary)

Full dossier (license rows, discipline, entity detail, FL insurance/activity, tools) stays **below**.

## Florida entity lineage (Phase 7)

**Section id:** `#entity-lineage` — **Florida only**, only when a high-confidence Sunbiz link exists **and** there is something reliable to show (officers and/or related entities).

| Shown | Source |
|-------|--------|
| Linked entity name, status, document number, formation, match method | `entities` + `contractor_entities` (confidence ≥ 0.90, role sunbiz/linked) |
| Officers / principals | `entities.officers` JSONB as published |
| Related entities | Other `fl_sunbiz` rows whose officers share an **exact** normalized principal name key |
| Official confirm | Link to Sunbiz search (document number for homeowner confirmation) |

**Rules**

- Exact officer-name association only (normalize: upper, strip punctuation/suffixes, collapse spaces).  
- Require multi-token names (length ≥ 8) — no single-token weak keys; skip corporate-looking agent strings.  
- Do **not** invent links or lower DBPR↔Sunbiz match thresholds.  
- No phoenix score, risk rating, or “avoid” language.  
- **Hide the section entirely** when lineage is empty/weak (no empty scare block).  
- Non-FL reports never render this block.

Helper: `lib/contractors/entity-lineage.ts` (`loadFloridaEntityLineage`).  
UI: `components/contractor/EntityLineageSection.tsx` (collapsible when dense).

## Shareable evidence summary (Phase 4B)

**Route:** `/contractors/[slug]/summary` (always `noindex`)

Clean, mobile-friendly, print-optimized page with:

- Contractor name + location  
- License id, class/type, published status  
- Entity status when the state links entities (or when present)  
- Discipline / enforcement-in-extract line  
- State/board source + extract freshness  
- Plain-language “what this means” (from `buildConsumerMeaning`)  
- Independent research badge — **not a recommendation**, no scores  
- Confirm on official board + link back to the **full live report**

| Action | Behavior |
|--------|----------|
| Share summary | Web Share API or copy absolute summary URL |
| Print summary | Navigate to `/summary?print=1` → browser print dialog |
| PDF | Use browser “Save as PDF” from the print dialog — no server PDF dependency |

Site chrome (header, footer, shortlist bar) is `print:hidden` so the printed page stays clean.

## Summary generation

| Helper | Module | Rules |
|--------|--------|--------|
| `buildEvidencePillars` | `lib/contractors/trust-report.ts` | Branch on `homeState` / evidence slug; no FL default for non-FL |
| `buildConsumerMeaning` | same | Educational tone; absence of discipline ≠ clean history |
| `officialBoardVerifyUrl` / `Label` | same | State-correct official search URLs |
| `stateHasEntityLinking` | same | `fl`, `nj` today |

Tones: `good` | `warn` | `bad` | `neutral` — status language only, not rankings.

## State-scoped copy requirements

| Requirement | Detail |
|-------------|--------|
| No FL leakage | Non-FL reports must not say DBPR, Sunbiz, or Florida WC Proof of Coverage in hiring/summary/sources body |
| Board language | Use that state’s board short name and extract name |
| Specialty honesty | TX / NJ / KY (and similar) state “no statewide GC” where true |
| No invention | Bond, insurance, discipline narrative only when present in extracts |
| Sources footer | One coverage note per state; methodology + disclaimer once at bottom |

Shared components must **branch on state**, not fall through to Florida prose.

## Layout

- **Mobile:** summary → meaning → actions; sticky bar with Official board / Watch / Share  
- **Desktop:** same stack in first viewport; full sections below  
- **Print:** hide sticky chrome and action chrome where marked `print:hidden`

## Acceptance checks

1. FL report still dense below the fold (entity, discipline, insurance, activity, tools)  
2. AZ / WA / KY (and other non-FL) main body free of FL-only source language  
3. First screen answers “what do I know?” without scrolling the dossier  
4. Share and Watch visible without hunting  
