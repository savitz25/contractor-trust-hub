# Homepage + Journey IA

Clear entry paths for first-time visitors. Florida-first, evidence-only, not a marketplace.

## Within 5 seconds

A homeowner should know:

1. **What this is** — Independent contractor research from official public records  
2. **What to do first** — One of three primary paths  
3. **Which path fits** — Intent router with “best when…” copy  

## Message hierarchy (hero)

| Layer | Copy |
|-------|------|
| Primary | Before you hire, verify. |
| Support | Plan clearly. Verify thoroughly. Hire with confidence. |
| Subcopy | Independent Florida contractor research from official public records — plus tools to plan scope, compare quotes, and protect your project. |
| Trust line | Not a marketplace. No paid rankings. Evidence only. |

### Hero CTAs

1. Verify a contractor → `/verify`  
2. Plan a project → `/plan`  
3. Secondary: Check my address → `/property`  

## Primary intent router

| Path | Route | Best when… |
|------|-------|------------|
| Verify | `/verify` | Already have a name or license |
| Plan | `/plan` | Deciding scope / cost context |
| Check address | `/property` | Property / permit context first |

Analytics-ready: `data-entry-path` on hero, intent cards, continuity, and header Verify.

## Journey spine (6 steps)

1. Plan your scope → `/plan`  
2. Analyze & compare quotes → `/tools/quote-analyzer`  
3. Verify license + business evidence → `/verify`  
4. Review contract carefully → `/tools/contract-analyzer`  
5. Protect payments & documents → `/projects`  
6. Save records in Home Passport → `/passport`  

Studios are linked from the spine as “Need a detailed studio?” → `/studios` (not dumped on the homepage).

## Continuity module

Client component `HomeContinuity` (localStorage):

- Continue active/open project  
- Open Home Passport  
- Watched contractors  
- Saved property  

Hidden when no session data. Includes “Save my work” → `/account` for local-only users.

## Secondary tool groups

- **Decision** — Scope, Quote Analyzer, Compare Bids, Pre-Hire Checklist  
- **Protection** — Contract Analyzer, Projects, Watch  
- **Records** — Passport, Account, Permit coverage  

## Proof strip

Qualitative, not vanity metric-heavy (avoid mismatched “270k contractors” style claims):

- Searchable Florida license records (DBPR)  
- High-confidence Sunbiz entity links  
- Discipline extracts indexed  
- Decision + protection tools  

## Navigation

**Header:** Verify · Plan · Tools · Projects · Passport · Studios · Account + Verify CTA  

**Footer (journey columns):** Research · Plan · Decide · Protect & records + legal/independence  

## Components

| File | Role |
|------|------|
| `components/home/HomeHero.tsx` | Hero + CTAs |
| `components/home/IntentRouter.tsx` | 3-path chooser |
| `components/home/HomeSearchBlock.tsx` | Inline verify search |
| `components/home/JourneySpine.tsx` | Full path steps |
| `components/home/HomeContinuity.tsx` | Resume state |
| `components/home/ToolDiscovery.tsx` | Secondary tools |
| `components/home/ProofStrip.tsx` | Credibility |
| `app/page.tsx` | Composition |

## Out of scope (this release)

- New data sources  
- New major tools  
- Multi-state expansion  
- Visual redesign for its own sake  
