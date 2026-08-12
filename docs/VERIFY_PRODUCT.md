# Verify product (Florida Phase 1)

Consumer-facing “Verify a Florida contractor” experience.

## Information architecture

| Route | Purpose |
|-------|---------|
| `/` | Brand homepage + primary search CTA |
| `/verify?q=` | Search by license number or name; results list |
| `/contractors/[slug]` | Contractor detail (licenses, Sunbiz entity, discipline) |
| `/about` | How it works |
| `/methodology` | Transparent matching & sources |

## Data flow

```
User query → lib/contractors/queries.ts
  → Postgres (Supabase) via lib/db.ts (DATABASE_URL)
  → contractors + licenses + contractor_entities + entities + discipline_actions
```

- **License search** when input looks like `CBC015082` or a long numeric core.
- **Name search** otherwise (display / legal / DBA / licensee fields).
- Thin QB shells (`is_thin_profile = true`) are excluded from consumer search.
- Sunbiz status appears only when `contractor_entities.role = 'sunbiz_entity'`.

## Multi-state readiness

State metadata lives in `lib/states/config.ts`. Florida is `live: true`. New Jersey is stubbed for wave 2. UI copy and queries take a `stateSlug` so new states plug in without rewriting pages.

## Environment

```env
DATABASE_URL=postgresql://...   # Supabase Session pooler recommended on Vercel
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

## Local

```bash
npm install
# ensure .env.local has DATABASE_URL
npm run dev
```

Open http://localhost:3000/verify

## Brand

- Yellow `#F5C518`, Navy `#0A2540`
- Logo: `components/BrandLogo` → `/brand/contractor-trust-hub-logo-on-dark.png` (and SVG mark)

## Product rules

- Educational research only — not a board substitute
- No lead forms, quote requests, or paid placement
- Quality over coverage for entity links
