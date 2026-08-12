# Production readiness (Florida Verify)

## Required environment (Vercel)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | **Yes** | Supabase **Session pooler** URI (`*.pooler.supabase.com:5432`, user `postgres.<ref>`) |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical origin for OG/sitemaps |
| `NEXT_PUBLIC_CORRECTIONS_EMAIL` | Recommended | Mailto target for `/corrections` (default `corrections@contractortrusthub.com`) |

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
