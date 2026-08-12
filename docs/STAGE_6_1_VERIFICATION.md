# Stage 6.1 — Production Verification + Wave A Depth Pass

Hardening Florida **Wave A** (Miami-Dade, Broward, Orange, Hillsborough) without loosening matches or expanding states.

## Matching rules (unchanged)

1. Auto-join **only** on exact license number (normalized)
2. **No** name-only joins
3. UI discloses match method + join audit

## Production path

### 1. Apply migration 006

```bash
# Supabase SQL editor or psql
psql "$DATABASE_URL" -f schema/migrations/006_stage6_permits_activity.sql
```

### 2. Verify tables

```bash
npm run verify:stage6
# → node scripts/verify_stage6_migration.mjs
```

Expect `permit_records`, `contractor_permit_activity`, `permit_coverage_stats` present.

### 3. Load Wave extracts into Postgres (optional but recommended)

```bash
npm run load:wave-a
# → node scripts/load_wave_a_permits.mjs
```

Loads `data/property/sample-permits.json` into DB with **normalized status**, then re-run verify.

### 4. File-level join audit (no DB)

```bash
npm run audit:joins
```

Reports:

- records by jurisdiction
- license-bearing vs no-license rows
- activity ∩ permit key overlap
- unmatched license-bearing keys
- freshness

### 5. Matcher smoke

```bash
npm run test:matcher
```

## UI verification checklist

| Surface | Expect |
|---------|--------|
| `/property` → Wave A address with sample key | Partial coverage banner, freshness chip, resolution notes |
| Empty Wave A address | Honest empty + “does not prove clean history” |
| Permit row with license | Match label + join audit line |
| Trust Report w/ activity key | Live badge, freshness, matched keys, method=license |
| Trust Report without match | Not linked + QA reason |
| `/tools/coverage` | Wave A ops snapshot + join rate proxy |

### Demo addresses (extract samples)

- `100 Ocean Drive, Miami Beach, FL 33139` (Miami-Dade)
- `500 E Las Olas Blvd, Fort Lauderdale, FL 33301` (Broward)
- `400 S Orange Ave, Orlando, FL 32801` (Orange)
- `601 E Kennedy Blvd, Tampa, FL 33602` (Hillsborough)

## Status normalization

`lib/property/status.ts` maps common AHJ wording → `open | issued | closed | finaled | expired | unknown`.  
Raw status preserved as `statusRaw` for audit.

## Join audit fields

On each permit after enrich:

- `joinAudit.licenseKeyNorm`
- `joinAudit.method` / `confidence` / `label`
- `joinAudit.candidateSlug` (only when high-confidence license join)

## Known coverage limits

- Wave A is **partial** — empty property results remain common
- File extracts are not a full AHJ dump
- Trust Report activity only for licenses in activity rollups / DB
- No complete statewide claim
- Stages 1–5 flows unchanged (tools, passport, projects, studios)

## Ops snapshot fields

`waveAOpsSnapshot()` / `GET /api/property/coverage`:

- records by Wave A county
- join rate proxy
- unmatched license-bearing keys
- last extract freshness
- known limits list
