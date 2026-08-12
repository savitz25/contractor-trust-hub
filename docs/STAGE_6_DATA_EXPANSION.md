# Stage 6 — Data Expansion

**Permit coverage · Contractor–permit joins · Trust Report live activity**

Evidence-first expansion. High-confidence matches only. Explicit coverage limits always.

## Waves

| Wave | Counties (partial) |
|------|--------------------|
| A | Miami-Dade, Broward, Orange, Hillsborough |
| B | Palm Beach, Duval, Pinellas, Lee |
| C | Collier, Sarasota, Pasco, Polk |
| Future | Brevard, Volusia, Seminole (unsupported listed) |

Source of truth: `lib/property/coverage.ts`  
Extract samples: `data/property/sample-permits.json`  
DB (batch): `schema/migrations/006_stage6_permits_activity.sql`

## Coverage levels

- `full` — broad extract (still confirm AHJ)
- `partial` — connected but incomplete
- `jurisdiction_unsupported` — not connected
- `source_unavailable` — temporary / resolution failure

Public matrix: `/tools/coverage` · API: `GET /api/property/coverage`

## Matching rulebook

Preferred order:

1. **Exact license number** (normalized alphanumeric)
2. Never invent joins from **name alone**
3. Refuse when license on permit disagrees with candidate keys

UI labels:

- “Matched by license number”
- “High-confidence match”
- “Contractor identity not confidently linked”
- “Name-only contractor data — not auto-linked”

Code: `lib/property/matcher.ts`  
Smoke: `node scripts/test_permit_matcher.mjs`

## Trust Report activity

`getActivitySignalsAsync` (`lib/contractors/activity-signals.ts`):

1. Try `contractor_permit_activity` table (if migrated/loaded)
2. Fall back to Wave extract rollups by license key
3. Else honest empty state + property tool links

Shows: count, window, counties, categories, sample types, source, freshness, match method.

## Property page

- Resolution notes (normalization, ZIP→county, coverage wave)
- Flags: open/issued, finalization missing, expired
- Source freshness per row
- DB enrich for license → slug when available

## Analytics snapshot fields

- Jurisdictions enabled by wave
- Sample/extract row counts
- Activity license key counts
- Matching policy summary

## Language standards

Prefer:

- “Associated in available datasets”
- “Appears open in available records”
- “Finalization not shown in current extracts”
- “Not shown in current extracts”

Avoid:

- Top-rated / high-volume quality claims
- Complete statewide coverage claims
- Weak fuzzy joins

## Repeatable expansion process

1. Add jurisdiction to coverage matrix (wave + freshness + notes)
2. Load extract rows into JSON and/or `permit_records`
3. Roll up license activity into JSON and/or `contractor_permit_activity`
4. Update `/tools/coverage` counts
5. Run matcher smoke tests
6. Spot-check Trust Report activity for known license keys
