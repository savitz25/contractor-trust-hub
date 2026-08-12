# Discovery layer (Florida first)

State-agnostic browse architecture for contractor evidence. **Florida is the first live adapter**; new states plug in via config without rewriting route components.

## URL structure

Public paths use a full state name slug (SEO-friendly):

| Pattern | Example | Purpose |
|---------|---------|---------|
| `/{state}` | `/florida` | State landing — stats, counties, trades, search CTA |
| `/{state}/{county}` | `/florida/miami-dade` | County browse + trade facets |
| `/{state}/{trade}` | `/florida/roofers` | Statewide trade browse + county facets |
| `/{state}/{county}/{trade}` | `/florida/miami-dade/roofers` | Combined high-value SEO page |

Single segments under `/{state}/` are resolved as **county first, then trade** via curated slug registries (no collision in the Florida set).

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
- Ordering: active/current licenses first, then name — **not** a quality ranking.

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
