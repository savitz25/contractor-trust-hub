# Production readiness (Florida Verify)

## Required environment (Vercel)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | **Yes** | Supabase **Session pooler** URI (`*.pooler.supabase.com:5432`, user `postgres.<ref>`) |
| `NEXT_PUBLIC_SITE_URL` | **Required in production** | Must be `https://www.contractortrusthub.com` — see [SEO.md](./SEO.md) |
| `NEXT_PUBLIC_CORRECTIONS_EMAIL` | Recommended | Mailto target for `/corrections` (default `corrections@contractortrusthub.com`) |
| Stage 5 migration `005_stage5_accounts_passport.sql` | For durable accounts | Magic link, workspace, alerts |
| `RESEND_API_KEY` | Optional | Magic-link + watch alert email |
| `AUTH_FROM_EMAIL` | Optional | Resend from address |

Framework: Next.js (`vercel.json`). Python under `ingest/` is offline only.

## Smoke checklist (after each deploy)

1. `/verify?q=CBC015082` → WORSHAM (or current) result  
2. `/verify?q=Worsham%20Construction` → name matches  
3. `/florida` → county + trade grids  
4. `/florida/miami-dade` and `/florida/miami-dade/roofers` → cards  
5. `/contractors/…` Trust Report → Evidence at a glance + Request a correction  
6. `/independence`, `/corrections`, `/disclaimer`, `/methodology` → 200  
7. `/robots.txt` → Sitemap URL  
8. `/sitemap/0.xml` → static + discovery + contractors  

## Performance notes

- County pages use a single occupation group-by for trade facets (not N list queries).  
- Combined county+trade pages are the lightest discovery lists.  
- County matching uses board names **and** known `county_code` values when names are null.

## Deferred

- Full map of numeric-only DBPR codes without names (~tens of thousands of rows)  
- Server-side corrections inbox (currently mailto)  
- Multi-state activation  
- Trust Scores / lead gen / calculators  
