# INTEL-003 — Aggregation & geographic counting

Code: `lib/intelligence/aggregation.ts`, `lib/intelligence/florida-county-codes.ts`.

## Statewide vs county

**Florida statewide credential totals do not have to equal the sum of county operating totals.** A contractor may operate in multiple counties.

| Concept | Definition | Current support |
| --- | --- | --- |
| Headquarters / base county | DBPR mailing/principal `county_code` 11–77 | Yes (codes official; names were only filled for 13 counties in the loaded extract) |
| Operating county | Attributed permit/activity in that county | **No** — `permit_records` / `permit_events` are empty |
| Out of state mailing | Codes 79, 701–799 | Exclude from HQ county totals; still a Florida credential |

## Entity counting

| Metric | Count this | Do not count this |
| --- | --- | --- |
| Statewide credentials | `licenses` fl_dbpr rows | QB shells, other states |
| Statewide active credentials | `status_normalized=active` | `current` / FRO / CRS1 / PVDR |
| Distinct persons | resolved person id | `licensee_name_raw` |
| Distinct qualifiers | qualifier graph | FRO rows, QB shells |
| Distinct businesses | Sunbiz document number at ≥0.95, or explicit QB entity (disclosed as QB shells) | `contractors` table, DBA strings |
| Multi-license business | credentials grouped by resolved business | same DBA text |
| Historical relationship | start/end dated edge | `linked_at` |

## Intelligence UI

Landing `/florida` already queries the database (`lib/discovery/landing-cache.ts`). It must **not** hard-code 104,444.

Minimum additions before a State Intelligence page:

1. Versioned SQL (this dictionary) — **done**
2. Reproducible audit job — `scripts/audit_florida_intelligence_rest.py` / `_baseline.py`
3. Optional `intelligence_snapshots` table later; do not over-engineer now
4. Every displayed number labeled with the entity counted

Do not place current statistics in React as constants.
