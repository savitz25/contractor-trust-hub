# Phase 2 — Project Context Layer

**Plan clearly. Verify thoroughly. Hire with confidence.**

## User flow

1. `/plan` — multi-step intake (project type → location → scale)
2. `/plan/results` — cost ranges + verified contractors + CTAs
3. Optional quote request → `POST /api/plan/quote-request`

## Data

| Asset | Path |
|-------|------|
| Cost ranges (FL) | `data/plan/fl-cost-ranges.json` |
| Project types | `lib/plan/project-types.ts` |
| Cost lookup | `lib/plan/cost-model.ts` |
| Matching | `lib/plan/matching.ts` |
| Quote schema | `schema/migrations/004_plan_quote_requests.sql` |

## Matching rules

See **[PLAN_MATCHING.md](./PLAN_MATCHING.md)** for the full quality rules.

- Active/current license required
- Primary specialty codes first (`data/plan/project-license-map.json`); secondary only when local primary is thin
- Location tiers: ZIP → city → county → honest statewide fallback
- Per-result “why this matched” reasons; thin/empty states do not invent volume
- Trust signals from existing extract only (no invented ratings)

## Apply quote table

```bash
# Against Supabase / Postgres
psql "$DATABASE_URL" -f schema/migrations/004_plan_quote_requests.sql
```

Optional: `PLAN_QUOTE_WEBHOOK_URL` or `LEAD_WEBHOOK_URL` for notifications.

## Out of scope (this phase)

3D Design Room, photo clean-canvas, material SKUs, multi-state cost engines, public review scores.
