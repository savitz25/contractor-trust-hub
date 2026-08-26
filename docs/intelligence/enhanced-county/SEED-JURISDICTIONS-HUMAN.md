# Post-011 jurisdiction metadata seed

**Not activity data. Does not set Enhanced Local Research.**

Run only after migration 011 tables exist:

```
python scripts/seed_enhanced_jurisdictions.py
```

Requires a working `DATABASE_URL`. If password auth still fails, paste equivalent `INSERT … ON CONFLICT` from that script into SQL Editor (metadata rows only).

## What it inserts

| County | Rows | Contents |
| --- | --- | --- |
| Broward | 1 + 31 | `bmsd` unincorporated/BMSD + 31 municipalities |
| Palm Beach | 1 + 39 | `unincorporated` (HARD PZB boundary) + 39 municipalities |

Each row: county, jurisdiction slug/label, kind (`unincorporated`/`municipal`), permitting authority, agency, coverage type, source, expected permit authority, `data_availability` (`pra_pending` for county-held; `none` for municipal), `metadata_status=seeded`, optional OneStop boolean, notes.

**Not inserted:** permit counts, credentials, contacts, valuations.

## Verification after seed

```sql
SELECT county_slug, kind, count(*) FROM public.enhanced_jurisdictions GROUP BY 1,2 ORDER BY 1,2;
SELECT jurisdiction_slug, notes FROM public.enhanced_jurisdictions
 WHERE jurisdiction_slug IN ('bmsd','unincorporated','westlake','loxahatchee-groves');
```

Expect: Broward BMSD present; Broward municipals not `kind=county`; PBC unincorporated present; Westlake 2017 own-system note; Loxahatchee Groves dual-coverage note. **Do not treat these rows as permit coverage.**
