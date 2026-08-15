# Discovery layer (Florida first)

State-agnostic browse architecture for contractor evidence. **Florida is the first live adapter**; new states plug in via config without rewriting route components.

## URL structure

Public paths use a full state name slug (SEO-friendly):

| Pattern | Example | Purpose |
|---------|---------|---------|
| `/{state}` | `/florida` | State landing — stats, counties, trades, search CTA |

Florida landing aggregations (`countCountiesBatch` / `countTradesBatch` / cheap stats) are cached for 30 minutes (`lib/discovery/landing-cache.ts`) with a 6s timeout. If counts fail or time out, the page still renders curated county and trade links — never an empty “No categories” grid or a hanging skeleton.
| `/{state}/{county}` | `/florida/miami-dade` | County browse + trade facets |
| `/{state}/{trade}` | `/florida/roofers` | Statewide trade browse + county facets |
| `/{state}/{county}/{trade}` | `/florida/miami-dade/roofers` | Combined high-value SEO page |
| `/{state}/{county}/{city}/{trade}` | `/florida/broward/fort-lauderdale/air-conditioning` | Florida city landing (indexed only when enough records) |

Single segments under `/{state}/` are resolved as **county first, then trade** via curated slug registries (no collision in the Florida set).

Query filters (`?status=`, `?city=`, `?sort=`, `?page=`, …) are **noindex**. Clean county + trade and qualifying city + trade URLs stay indexable.

Future example: `/new-jersey/bergen/roofers` once NJ is `live: true` in discovery config.

## Config (state adapter)

| File | Role |
|------|------|
| `lib/discovery/types.ts` | Shared types |
| `lib/discovery/config.ts` | `DISCOVERY_STATES` registry + path helpers |
| `lib/discovery/counties.ts` | Curated counties + match names |
| `lib/discovery/trades.ts` | Consumer trades → occupation codes |
| `lib/discovery/queries.ts` | Listings, counts, facets |
| `lib/discovery/metadata.ts` | Titles, descriptions, canonicals |

Evidence DB keys still use short codes (`fl`) via `evidenceSlug` → `lib/states/config.ts`.

### Adding a state later

1. Ingest licenses into the shared schema with a new `source_system`.
2. Add `EvidenceState` in `lib/states/config.ts` (`live: true` only when Verify is ready).
3. For Texas: specialty TDLR only — never imply statewide GC browse (see `docs/DATA_SOURCES_TX.md`).
3. Add counties/trades modules + entry in `DISCOVERY_STATES` with `publicSlug` (e.g. `new-jersey`).
4. Add `app/{publicSlug}/...` routes (copy Florida tree) **or** introduce a dynamic `app/[state]/...` router once a second state is ready.
5. Extend sitemap via `getLiveDiscoveryStates()`.

## Data rules

- Only `is_thin_profile = false` contractors.
- County filter: case-insensitive match on `licenses.county_name` / `contractors.primary_county` using curated `matchNames`.
- Trade filter: `occupation_code = ANY(trade.occupationCodes)`.
- Sunbiz on cards: same high-confidence rule (`role = sunbiz_entity`, `confidence >= 0.90`).

## Florida browse (filters, sort, roll-up)

Florida county / trade / city pages use `lib/discovery/florida-list.ts`. Other discovery states still use `listDiscoveryContractors`.

### Filters (evidence fields only)

| Query | Values | Meaning |
|-------|--------|---------|
| `city` | city slug | License / primary city on the extract |
| `status` | `any` (default), `active`, `inactive` | Published license status |
| `entity` | `any`, `linked`, `unlinked` | High-confidence Sunbiz link only |
| `discipline` | `any`, `present`, `none` | Linked board action in our extract |
| `tenure` | `any`, `lt5`, `5to15`, `gt15` | `original_licensure_date` bands when present |

No quality scores. Unknown issue dates are excluded from tenure bands.

### Browse order (disclosed, not a ranking)

| `sort` | Order |
|--------|--------|
| `name` (default) | Display name A–Z |
| `longest` | Earliest original issue date first |
| `updated` | Most recently verified in our extract |
| `entity` | High-confidence Sunbiz link first, then name |

On-page copy must say this is browse order, not a ranking or paid placement.

### Firm roll-up

When two contractor rows share the **same high-confidence Sunbiz entity**, they appear as **one card**. Extra credentials show as badges that still open the license-level Trust Report.

Do **not** merge on name or DBA alone. Unlinked rows stay separate (`solo:{contractor_id}`).

### City pages

Indexed only when the city + county + trade slice has at least **8** contractor rows (`CITY_INDEX_MIN`). Thinner city URLs render when they have any matches but stay `noindex`. City slugs are normalized from the published license city (`Fort Lauderdale` → `fort-lauderdale`).

City landings are linked from county + trade pages (chip row + **By city** cluster view). Metadata titles include city + county + trade so they stay unique.

### UI polish (Phase 4A)

- **Active filter chips** with clear-all on the filter card
- **Browse order** always shown (header chip + labeled control) — not a ranking
- Empty filter results list concrete “what to loosen” hints
- Mobile jump links to `#filters` / `#cities`

### Map / list-by-city

**Map deferred.** Florida DBPR browse rows expose city/county text on the license extract but **no lat/lng**. A pin map would need geocoding + storage work outside this pass.

**Shipped instead:** list-by-city cluster view (`?view=cities`) using published license cities with firm counts → city landings. Documented gap: true map when coordinates exist.

## Indexes

```bash
# Session pooler
node -e "/* or psql */"
psql "$DATABASE_URL" -f schema/migrations/003_discovery_indexes.sql
```

## Homepage research entry

The homepage splits two consumer intents:

1. **I already have a contractor** → hero search (`#search`) → `/verify` → Trust Report  
2. **I need to research contractors** → guided browse (`#research` / `ResearchBrowse`) → discovery URLs:
   - County + trade → `/{state}/{county}/{trade}`
   - Trade only → `/{state}/{trade}`
   - County only → `/{state}/{county}`
   - Neither → `/{state}` (full landing)

Component: `components/discovery/ResearchBrowse.tsx` (client). Uses curated counties/trades from discovery config — no lead forms.

## Product tone

- Verification / research only
- No lead forms, paid placement, or Trust Scores on discovery pages
- Shared `ResultCard` trust signals with search
