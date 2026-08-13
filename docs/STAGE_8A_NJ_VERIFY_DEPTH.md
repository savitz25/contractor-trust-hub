# Stage 8A — New Jersey Verify Depth

Turn the Stage 7 NJ pilot into a **credible Verify experience**: stronger search, deeper Trust Report, high-confidence entity/enforcement, and careful tool handoffs — without Florida full-journey parity.

## Product outcomes

1. Search NJ registrants by name, registration key, or principal (when present)  
2. Open a state-aware NJ Trust Report with source attribution  
3. See what was checked vs not checked  
4. Entity + enforcement signals only when high-confidence  
5. Hand off into generic decision tools without FL-only legal assumptions  

## Matching rules

- Exact registration / license key preferred  
- Name search is forgiving on legal suffixes; **entity joins stay high-confidence only**  
- **No** name-only entity auto-join  
- **No** cross-state identity merge  

## Source matrix

| source_system | Role | Includes | Gaps |
|---------------|------|----------|------|
| `nj_dca` | Registration / HIC + selected trades | Keys, status, credential type, location, principal name fields | Not every municipal card |
| `nj_sos` | High-confidence entity | Legal name, status, formation, officers when keyed | Only when `entity_key` present |
| `nj_enforcement` | Public actions | Case id, disposition, date, factual summary | Absence ≠ clearance; not full case files |

### Ingest

```bash
python -m ingest.adapters.nj_dca \
  --input data/samples/nj_dca_hic_sample.csv \
  --out-dir data/staging/nj_dca

python scripts/load_nj_dca_to_postgres.py --staging-dir data/staging/nj_dca
```

Staging outputs:

- `licenses_normalized.csv`  
- `entities_normalized.csv` (high-confidence only)  
- `enforcement_normalized.csv`  

## Trust Report sections (NJ)

| Section | Content |
|---------|---------|
| A. Identity | Name, registration key, status, location, freshness, `source_system` badge |
| B. Credential evidence | Type, dates, educational allow/does-not-imply notes |
| C. Entity | High-confidence links only; match method disclosed |
| D. Enforcement | Present / absent; factual rows only |
| E. What we checked | State-aware lists from `evidence-copy.ts` |
| F. Next actions | `NjNextActions` — scope, quote, compare, NJ-safe checklist, watch |

**Not on NJ reports:** Florida permit activity, FL insurance/workers’ comp panels, studio handoff, FL payment legal trackers.

## Search UX

- Result cards: name, credential chip, status, city/county, **`source_system` badge**  
- Empty state explains pilot limits  
- `/verify?state=nj` coverage banner + source matrix link via `/tools/coverage`  

## Decision tools handoff

| Tool | NJ behavior |
|------|-------------|
| Scope Builder | Allowed (generic) |
| Quote Analyzer | Allowed |
| Compare Bids | Allowed |
| Pre-Hire Checklist | `?state=nj` hides FL workers’ comp / Sunbiz-specific items |
| Plan / Studios / Passport | Not promoted as NJ-complete |

## Feature flag

```bash
NEXT_PUBLIC_NJ_VERIFY_PILOT=true   # default on
NEXT_PUBLIC_NJ_VERIFY_PILOT=false  # hide NJ live state
```

## Tests

```bash
npm run test:nj          # smoke: keys, sample fields, no FL-only copy on NJ UI
npm run test:matcher     # FL permit join precision (unchanged)
npm run typecheck
```

## Known limitations

- Pilot depth depends on loaded extracts; empty DB → empty search  
- Entity links only for rows with stable `entity_key`  
- Enforcement is extract-level, not a complete disciplinary archive  
- No NJ permit history in Stage 8A  
- Florida full journey remains the complete product  

## Related

- Stage 7 spike: [STAGE_7_FL_DEPTH_AND_NJ_SPIKE.md](./STAGE_7_FL_DEPTH_AND_NJ_SPIKE.md)  
- Texas specialty path: [TEXAS_VERIFY_V1.md](./TEXAS_VERIFY_V1.md)  
