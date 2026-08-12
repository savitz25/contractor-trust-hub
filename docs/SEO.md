# SEO (Contractor Trust Hub)

Canonical production origin: **`https://www.contractortrusthub.com`**

## Critical env

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_SITE_URL` | `https://www.contractortrusthub.com` |

Set this on **Vercel Production** (and Preview if you want previews to self-reference; production default in code already prefers the custom domain).

**Do not** rely on `VERCEL_URL` for public SEO. Preview hosts were previously baked into `robots.txt` and Open Graph image URLs.

Code defaults: `lib/site.ts` → `PRODUCTION_SITE_URL`. Any `*.vercel.app` value is rejected and replaced with the production domain.

## robots.txt

- Source: `app/robots.ts` (`dynamic = force-dynamic`)
- Host: `www.contractortrusthub.com`
- Sitemap: `https://www.contractortrusthub.com/sitemap.xml`
- Disallow: `/api/`, `/plan/results` (personalized, noindex)

After deploy, verify:

```bash
curl -s https://www.contractortrusthub.com/robots.txt
```

## Sitemaps

**Explicit route handlers** (not Next metadata `app/sitemap.ts` + `generateSitemaps`):

| Public URL | Handler |
|------------|---------|
| `/sitemap.xml` | `app/sitemap.xml/route.ts` — sitemap **index** |
| `/sitemap/0.xml`, `/sitemap/1.xml`, … | rewrite → `app/sitemap/[id]/route.ts` |
| Builders | `lib/seo/sitemap-data.ts` |

**Why not metadata sitemaps?** With `generateSitemaps`, shards at `/sitemap/0.xml` worked but **`/sitemap.xml` returned HTML 404** (global `not-found`). The metadata index route was not reliable on this App Router + multi-shard setup, so we own the paths with Route Handlers and correct `Content-Type: application/xml`.

- Shard 0: static product pages + Florida discovery + first contractor page  
- Further shards: contractor Trust Report profiles (`SITEMAP_PAGE_SIZE` in `lib/contractors/queries.ts`)  
- Absolute URLs via `absoluteUrl()` → `https://www.contractortrusthub.com`

After deploy:

```bash
curl -sI https://www.contractortrusthub.com/sitemap.xml
# expect: 200, content-type application/xml
curl -s https://www.contractortrusthub.com/sitemap.xml | head
# expect: <sitemapindex ...>
curl -sI https://www.contractortrusthub.com/sitemap/0.xml
# expect: 200, application/xml, <urlset>
```

If a shard is empty of contractors, confirm `DATABASE_URL` on Production (static+discovery still emit on shard 0).

## Metadata

| Helper | Role |
|--------|------|
| `lib/site.ts` | Canonical origin + `absoluteUrl` |
| `lib/seo/page-meta.ts` | Title, description, canonical, OG, Twitter |
| `app/layout.tsx` | `metadataBase`, defaults, sitewide tags |
| Per-route `pageMetadata({...})` | Unique copy per template |
| `lib/discovery/metadata.ts` | County / trade discovery pages |

`metadataBase` resolves relative canonical/OG paths to the production domain.

Plan results and compare are **noindex** (query-specific / utility).

## JSON-LD

| Component | Where |
|-----------|--------|
| `SitewideJsonLd` | Root layout — Organization + WebSite + SearchAction (verify) |
| `BreadcrumbJsonLd` | Discovery breadcrumbs + Trust Reports |
| `ContractorJsonLd` | Trust Reports — ProfilePage + Organization (no ratings) |

Schema is evidence-oriented only — never AggregateRating or invented review data.

## Host canonicalization

`next.config.ts` redirects apex `contractortrusthub.com` → `https://www.contractortrusthub.com`.

Ensure both hosts are attached in Vercel DNS.

## Internal crawl paths

- Homepage hero: Cost Studio, Roofing calculator, Verify search, Florida browse
- Header: Plan, Cost Studio, Roofing, Florida, About, Verify
- Footer: studios, plan, verify, Florida, trust pages
- Trust Report: breadcrumbs + related discovery links

## Monitoring after launch

1. Google Search Console → property for `https://www.contractortrusthub.com`
2. Submit `https://www.contractortrusthub.com/sitemap.xml`
3. Spot-check:
   - robots Host + Sitemap URLs (no vercel.app)
   - Homepage + Trust Report `link rel=canonical` and `og:url` / `og:image`
   - `/studio/cost`, `/studio/roofing`, `/florida`, sample `/contractors/[slug]`
4. Coverage: monitor 404s on studio routes after deploy
5. Re-fetch sample URLs after each production deploy that touches `lib/site.ts` or sitemap

## Known limits

- Very large contractor sitemaps depend on DB health; shard cap `MAX_SITEMAP_SHARDS` protects generateSitemaps
- ZIP/query result pages stay noindex by design
- Board data lag means Trust Reports are research extracts, not live board pages — reflected in copy and schema
