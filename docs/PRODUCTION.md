# Production readiness (Florida Verify)

## Required environment (Vercel)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | **Yes** | Supabase **Session pooler** URI (`*.pooler.supabase.com:5432`, user `postgres.<ref>`) |
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

## Deferred

- Full map of numeric-only DBPR codes without names (~tens of thousands of rows)  
- Server-side corrections inbox (currently mailto)  
- Multi-state activation  
- Trust Scores / lead gen / calculators  
