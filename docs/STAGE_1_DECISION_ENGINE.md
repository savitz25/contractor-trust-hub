# Stage 1 — Decision Engine

**Plan scope → Analyze quote → Compare bids → Verify contractor → Checklist before signing**

Educational / research tools only. Not legal advice, not rankings, not a marketplace.

## Routes

| Path | Tool |
|------|------|
| `/tools` | Decision tools hub |
| `/tools/scope-builder` | Project Scope Builder |
| `/tools/quote-analyzer` | Single Quote Analyzer |
| `/tools/compare-bids` | Compare 2–4 bids |
| `/tools/pre-hire-checklist` | Pre-hire checklist + red flag guide |

## Library modules

| Module | Role |
|--------|------|
| `lib/decision/types.ts` | Shared types |
| `lib/decision/scope-templates.ts` | Expected line items by project type + keyword map |
| `lib/decision/scope-builder.ts` | Scope summary generation + plain text export |
| `lib/decision/quote-parse.ts` | Heuristic text / PDF string extraction |
| `lib/decision/quote-analyze.ts` | Price context, completeness, red flags |
| `lib/decision/compare-bids.ts` | Matrix + difference notes |
| `lib/decision/checklist.ts` | Checklist + red flag guide content (source of truth) |
| `lib/decision/questions.ts` | Context-aware questions-to-ask |
| `lib/decision/session.ts` | localStorage keys |
| `lib/decision/print.ts` | Copy + browser print/PDF |
| `lib/decision/disclaimers.ts` | Product disclaimers |

## Field map (quote / compare)

Common rows:

- Total quoted price
- Deposit terms
- Permit responsibility
- Timeline language
- Warranty language
- Project-type template items (included / excluded / allowance / unclear / missing)

Statuses: `included` | `excluded` | `allowance` | `unclear` | `missing`

## Parsing limits

- Paste text is primary input.
- PDF: best-effort ASCII extract only (no full PDF.js OCR).
- Images: manual entry (no client OCR in Stage 1).
- Always prefer “not clearly stated” over absolute claims.
- Manual total / deposit overrides always win over parse.

## Session storage keys

- `cth-decision-scope`
- `cth-decision-quote-analysis`
- `cth-decision-compare-bids`
- `cth-decision-checklist`

## Integrations

- Studio results + plan results: Decision tools card with deep-link query (`type`, `scale`, `zip`, `city`, `studio`)
- Trust Report: Analyze quote prefill (`contractor`, `name`)
- Header + home: Tools entry
- Controlled introductions unchanged; scope/analysis stay on-device unless user pastes into intro notes

## Out of scope (Stage 1)

- Multi-state
- Permit history ingestion
- Full contract PDF legal interpretation
- Escrow / payments
- Public reviews
- 3D design tools
