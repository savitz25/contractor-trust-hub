# Enhanced County Data Foundation — Broward & Palm Beach (Prompt 7)

**Stage:** architecture + source map + ingest contract. **No population load. Coverage level remains Statewide Research.**

Consumer target (when loaded): state license evidence + local authorization + local permit/activity + locally attributable regulatory observations + official contacts = Enhanced Local Research.

This prompt does **not** ship county Intelligence UI.

## Hard rules

- Jurisdiction before counts. OneStop ≠ countywide history. PZB open permits = **Unincorporated PBC**.
- Permit activity is **recorded activity**, not quality. No busiest=best. No county score.
- HQ county stays HQ. Activity is a separate layer (`coverageLevel` stays `statewide` in `lib/intelligence/coverage.ts` until ingest + readiness gate).
- Complaints ≠ findings. Failed inspection ≠ bad contractor. Expired permit ≠ discipline. Missing valuation ≠ 0.
- Prefer first-party bulk / PRA over crawling. Do not submit PRA drafts unless authorized.
- Large discovery-list slowness (Prompt 6) is a separate P1/P2; county ingest must not worsen browse.

## Files

| Path | Role |
| --- | --- |
| `source-matrix.json` | Durable source blueprint |
| `jurisdiction-coverage.md` | Every AHJ examined |
| `local-certification-status.md` | Current vs preempted classes |
| `identity-standard.md` | CONFIRMED / HC / RR / UNRESOLVED |
| `pra-*.md` | Unsubmitted Chapter 119 drafts |
| `schema/migrations/011_enhanced_county_foundation.sql` | Additive ingest contract (not applied) |
| `lib/intelligence/enhanced-county-*.ts` | Identity + jurisdiction gates |

## Pilot status

Stage A inspect: **done** (official pages, statutes, PZB/BCS portals, municipal directories).  
Stage B–E: **blocked** — no machine-readable bulk file in hand; portals are login/POSSE/Accela-class; PRA not authorized for submission.

| County | Records processed | Permits | Local credentials | Identity | Contacts |
| --- | --- | --- | --- | --- | --- |
| Broward | 0 loaded | 0 | 0 | n/a | 0 |
| Palm Beach | 0 loaded | 0 | 0 | n/a | 0 |

## Metric readiness (no loaded rows)

All activity metrics **NOT READY** until a jurisdiction-scoped extract with `issue_date` (and raw status) is loaded. Certification metrics **NOT READY**. Inspections **NOT READY**.

Open-permit mapping **designed** from PZB published statuses; not applied.

## Enhanced Local Research?

**Broward: NO.** **Palm Beach: NO.** Parsers/docs exist; no contractor-level local activity is queryable in production.

## Next

Additional source acquisition / public-record exports (option C), independently for both counties. Do not mark Enhanced or build county Intelligence UI first.
