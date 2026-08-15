# Production readiness (Florida Verify)

## Required environment (Vercel)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | **Yes** | Supabase **Session pooler** URI only: host `*.pooler.supabase.com`, **port 5432** (Session), user `postgres.<project-ref>`. **Not** Transaction pooler (`:6543`). **Not** direct `db.*.supabase.co` if the runtime is IPv4-only. Single Production value — no duplicate env keys. |
| `NEXT_PUBLIC_SITE_URL` | **Required in production** | Must be `https://www.contractortrusthub.com` — see [SEO.md](./SEO.md) |
| `NEXT_PUBLIC_CORRECTIONS_EMAIL` | Recommended | Mailto target for `/corrections` (default `corrections@contractortrusthub.com`) |
| Stage 5 migration `005_stage5_accounts_passport.sql` | For durable accounts | Magic link, workspace, alerts |
| Stage 6 migration `006_stage6_permits_activity.sql` | For DB permit/activity | `npm run verify:stage6` then `npm run load:permits` |
| Stage 8C migration `007_stage8c_ops_load_runs.sql` | Load history / freshness ops | Optional but recommended |
| `RESEND_API_KEY` | Optional | Magic-link + watch alert email |
| `AUTH_FROM_EMAIL` | Optional | Resend from address |

Framework: Next.js (`vercel.json`). Python under `ingest/` is offline only.

## Live data ops (Stage 8C)

Full runbook: [STAGE_8C_LIVE_DATA_OPS.md](./STAGE_8C_LIVE_DATA_OPS.md).

```bash
# After migrations 006 (+ 007)
npm run load:permits          # FL Waves A–C (idempotent)
npm run verify:ops            # counts, freshness, NJ, last runs
npm run audit:production      # join-rate proxy from DB
npm run ops:snapshot          # JSON health snapshot

# NJ Verify pilot load
python -m ingest.adapters.nj_dca --input data/samples/nj_dca_hic_sample.csv --out-dir data/staging/nj_dca
python scripts/load_nj_dca_to_postgres.py --staging-dir data/staging/nj_dca
```

Matching: exact license/registration keys only · no name-only joins · no completeness claims.

## Smoke checklist (after each deploy)

1. `/verify?q=CBC015082` → WORSHAM (or current) result  
2. `/verify?q=Worsham%20Construction` → name matches  
3. `/florida` → county + trade grids  
4. `/florida/miami-dade` and `/florida/miami-dade/roofers` → cards  
5. `/contractors/…` Trust Report → Evidence at a glance + Request a correction  
6. `/independence`, `/corrections`, `/disclaimer`, `/methodology` → 200  
7. `/robots.txt` → Sitemap URL  
8. `/sitemap/0.xml` → static + discovery + contractors  
9. `/tools/coverage` → production vs file mode banner + wave ops  
10. `/property` demo Wave A address → partial coverage + freshness  
11. After permit load: contractor with activity key shows Live/Partial activity  
12. `/verify?state=nj` after NJ load → search + Trust Report source badges  

## Post-load smoke (data ops)

See [STAGE_8C_LIVE_DATA_OPS.md](./STAGE_8C_LIVE_DATA_OPS.md) § Post-load UI smoke.

## Performance notes

- County pages use a single occupation group-by for trade facets (not N list queries).  
- Combined county+trade pages are the lightest discovery lists.  
- County matching uses board names **and** known `county_code` values when names are null.

## Verify search reliability (Phase 11)

| Topic | Rule |
|-------|------|
| Pool on Vercel | `lib/db.ts` uses **max 1** client per isolate (Session pooler safe) |
| Connect timeout | ~8s; one safe retry on connect/capacity errors only |
| Statement timeout | `SET LOCAL statement_timeout` per query (~8s) so one search cannot pin the pool |
| Name search | Candidate set capped before entity/discipline joins; non-FL/NJ skip Sunbiz entity lateral |
| Error copy | State-agnostic when DB is down — no “Florida Verify remains” on CA/TX/etc. |
| Logs | `[db] kind=connect_timeout\|query_timeout\|capacity` plus `[verify] search failed state=…` |

Symptoms of pooler saturation: many simultaneous `timeout exceeded when trying to connect` across states. Mitigation: confirm Session pooler URI, reduce long SSR work, check Supabase pooler client usage — do not raise serverless pool `max` above 1 without raising pooler capacity.

## Deferred

- Full map of numeric-only DBPR codes without names (~tens of thousands of rows)  
- Server-side corrections inbox (currently mailto)  
- Multi-state activation  
- Trust Scores / lead gen / calculators  
