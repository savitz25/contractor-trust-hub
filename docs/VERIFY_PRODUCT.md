# Verify product (Florida Phase 1)

Consumer-facing “Verify a Florida contractor” experience.

## Information architecture

| Route | Purpose |
|-------|---------|
| `/` | Brand homepage + primary search CTA |
| `/verify?q=` | Search by license number or name; results list |
| `/contractors/[slug]` | **Contractor Trust Report** (evidence summary, license scope, Sunbiz, discipline, hiring notes) |
| `/about` | How it works |
| `/methodology` | Transparent matching & sources |
| `/sitemap.xml` | Sitemap index (static pages + contractor profiles) |
| `/robots.txt` | Crawler rules + sitemap pointer |

### Contractor Trust Report

Each profile is an evidence-based report (not a score or marketplace listing):

- **Evidence summary** — license status · entity status · discipline status
- **Match confidence** — e.g. “Linked on exact name + address · 0.98” when Sunbiz is linked
- **License class guidance** — plain-language “what this typically allows”
- **DBPR vs Sunbiz differences** — name / ZIP / city / status mismatches surfaced when present
- **What should I know before hiring?** — educational bullets, never hire/don’t-hire judgments
- **Sources** — board + Sunbiz links and last-verified timestamps

### SEO / metadata

Profile pages emit:

- `<title>` — `{Name} — Florida Contractor Trust Report`
- Meta description with license key, statuses, and discipline note
- Canonical URL `/contractors/{slug}`
- Open Graph + Twitter cards
- JSON-LD `ProfilePage` / `Organization`
- Multi-file sitemap of searchable (non-thin) contractor slugs

## Data flow

```
User query → lib/contractors/queries.ts
  → Postgres (Supabase) via lib/db.ts (DATABASE_URL)
  → contractors + licenses + contractor_entities + entities + discipline_actions
```

- **License search** when input looks like `CBC015082` (spaces/dashes OK) or a long numeric core.
- **Name search** otherwise — more forgiving for consumers:
  - Strips common legal suffixes (LLC, Inc, Corp, …) for matching
  - Multi-word queries require all significant tokens (AND) across name fields
  - Still ranks prefix matches highest
- Thin QB shells (`is_thin_profile = true`) are excluded from consumer search.
- **Entity linking stays strict** — Sunbiz status appears only when:
  - `contractor_entities.role = 'sunbiz_entity'`, and
  - `confidence >= 0.90` (high-confidence linker methods only).

### Entry experience

- Homepage hero is a large **Verify** search (not a lead form).
- Two consumer intents both route to search: “I already have a contractor” vs “I need to research.”
- Result cards lead with license status · entity status · location before occupation detail.

## Multi-state readiness

State metadata lives in `lib/states/config.ts`. Florida is `live: true`. New Jersey is stubbed for wave 2. UI copy and queries take a `stateSlug` so new states plug in without rewriting pages.

## Environment (required for production)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | **Yes** | Supabase **Session pooler** URI (port `5432`). Set as **sensitive** in Vercel → Project → Settings → Environment Variables for Production (and Preview if you test previews). |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical site origin for Open Graph / metadata (e.g. `https://your-app.vercel.app`). |

Copy from [`.env.example`](../.env.example). See [SUPABASE.md](./SUPABASE.md) for pooler vs direct.

### Vercel checklist

1. Framework: **Next.js** (`vercel.json` sets install/build).
2. Env: `DATABASE_URL` = Session pooler (user `postgres.<project-ref>`, host `*.pooler.supabase.com:5432`).
3. Deploy from `main`. Confirm `/verify?q=CBC015082` and a result detail page return 200.
4. Do **not** rely on direct `db.*.supabase.co` on Vercel if the platform network is IPv4-only.

### Search performance

Migration: `schema/migrations/002_search_indexes.sql`

- `pg_trgm` GIN indexes on contractor/license name fields for `ILIKE` name search
- Partial index for searchable contractors (`is_thin_profile = false`)
- Indexes for license key lookup and discipline / entity joins

Apply once against Supabase (SQL Editor or `psql` with Session pooler):

```bash
# From a machine that can reach the pooler
psql "$DATABASE_URL" -f schema/migrations/002_search_indexes.sql
```

## Local

```bash
npm install
# ensure .env.local has DATABASE_URL (Session pooler)
npm run dev
```

Open http://localhost:3000/verify

```bash
npm run build   # same command Vercel runs
npm start
```

## Brand

- Yellow `#F5C518`, Navy `#0A2540`
- Logo: `components/BrandLogo` → `/brand/contractor-trust-hub-logo-on-dark.png` (and SVG mark)

## Product rules

- Educational research only — not a board substitute
- No lead forms, quote requests, or paid placement
- Quality over coverage for entity links
- Empty states and verification summary must not imply a clean record when data is missing — only when the extract shows no linked discipline
