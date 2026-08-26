# Miami-Dade + Pinellas — Prompt 1 index

**Phase:** official-source audit, jurisdiction map, acquisition plan, County Intelligence baseline.  
**Date:** 2026-08-26  
**Production writes:** none. No seed, no ingest, no migration 012, no PRA filing, no Enhanced.

County Intelligence UI remains Broward + Palm Beach only. Miami-Dade and Pinellas stay **Statewide Research**.

| Artifact | Role |
| --- | --- |
| `miami-dade-source-map.md` | Official contractor/permit/enforcement inventory |
| `pinellas-source-map.md` | Same for Pinellas / PCCLB |
| `miami-dade-jurisdictions.md` | AHJ denominator (35) |
| `pinellas-jurisdictions.md` | AHJ denominator (25) |
| `miami-dade-acquisition-matrix.md` | P0–SKIP |
| `pinellas-acquisition-matrix.md` | P0–SKIP |
| `proposed-seed-miami-dade-pinellas-jurisdictions.json` | Review-only AHJ metadata |
| `pra-miami-dade-*.md` | Unfiled Chapter 119 drafts |
| `pra-pinellas-*.md` | Unfiled Chapter 119 drafts |

Apply seed / file PRAs only in Prompt 2 after review.

## Schema 011 compatibility

**YES — no migration 012 required.** `enhanced_jurisdictions` unique on `(county_slug, jurisdiction_slug)`; permit unique on `(source_system, source_jurisdiction, permit_number)`; `local_credentials.currentness` already includes `CURRENT_LOCAL_AUTHORIZATION`, `STATE_ENROLLED`, `PREEMPTED_CLASS`, `HISTORICAL_LOCAL_LICENSE`. Application TypeScript currently types `countySlug` as `"broward" | "palm-beach"` — widen at Prompt 2 UI only; that is not a schema change.

Production 011 tables exist (72 Broward+PBC metadata rows). Miami-Dade / Pinellas `enhanced_jurisdictions` = **0**. `local_credentials` / `permit_source_records` remain 0.

## Statewide baseline (PostgREST 2026-08-26)

DBPR `licenses.county_code` mailing HQ: Miami-Dade **23**, Pinellas **62**. Not operating geography.

| | Miami-Dade | Pinellas |
| --- | ---: | ---: |
| all credentials | 14,579 | 6,017 |
| active | 11,261 | 4,387 |
| trade (excl. FRO, CRS1, PVDR) | 12,546 | 4,982 |
| active trade | 11,261 | 4,387 |

## County Intelligence readiness

Both counties: **NOT_READY** for local activity. Statewide Research only. **Enhanced? NO.**

Ready-if-pages-were-built later: DBPR mailing-county populations only. Mapped jurisdictions after seed = metadata, not permits.

## Prompt 2 sequence (do not start here)

1. Review/approve proposed 35+25 AHJ seed; apply metadata only.
2. No schema 012 expected.
3. Acquire MDC Open Data issued permits (DIRECT) + City of Miami GIS (City of Miami AHJ only).
4. File the six justified PRA drafts.
5. Build importers for P0 sources.
6. Then County Intelligence pages using READY metrics only.
