# INTEL-002 — Evidence & attribution standard

Code: `lib/intelligence/attribution.ts`. SQL gate: `PUBLIC_FL_DISCIPLINE_PREDICATE`.

## Four levels

| Class | Meaning | Public adverse? | Public Sunbiz legal entity? |
| --- | --- | --- | --- |
| **CONFIRMED** | Deterministic identifier (exact license with occupation, document number, FEIN, direct cross-reference) | Yes, if `publication_state=PUBLIC` | Yes |
| **HIGH_CONFIDENCE** | Unique multi-attribute match; no deterministic id | **No** | Yes for `exact_name_address` (0.98) and `exact_name_zip5` (0.95) |
| **REVIEW_REQUIRED** | Possible match, not certain | No | No (`exact_name_city` 0.92, `officer_name_zip` 0.90) |
| **UNRESOLVED** | No reliable attribution | No | No |

Fail closed. `publication_state` NULL is treated as INTERNAL for `fl_dbpr` and `fl_dfs`.

## Per source family

### DBPR licensing
CONFIRMED on `(source_system, external_key)`. QB rows are entities, not licenses.

### DBPR discipline
CONFIRMED only when license **type + number** resolve to **one** `licenses.external_key`. Numeric core-only matching is not CONFIRMED: 16,088 numeric cores collide across occupations.

Public profiles must not show a row unless `publication_state=PUBLIC`. Current production: **0 PUBLIC** discipline rows. 1,593 legacy `contractor_id` rows have NULL publication_state and are now withheld.

### DBPR unlicensed activity
Default UNRESOLVED. Extract has no license number. Do not attach to a licensed contractor without a deterministic identifier.

### Recovery Fund
Same license rule as discipline. Distinguish claim / award / payment / disposition from source text; do not infer.

### DFS workers’ compensation / Stop-Work
CONFIRMED only with FEIN, official employer id, or license number on the source row. **Name/city auto-link is prohibited.** Current extract has none of those identifiers. All 48,254 rows are INTERNAL / UNRESOLVED.

### Sunbiz
No document number on the DBPR licensee extract, so auto-links cannot be CONFIRMED. Public legal-entity display requires confidence ≥ **0.95** (address or ZIP unique match). City-only (0.92) is REVIEW_REQUIRED.

### Qualifier relationships
Not implemented as PERSON → LICENSE → QUALIFIES → BUSINESS. Shared qualifier is investigative context, **never** guilt by association.

## Publication

Adverse evidence on a profile, search card, browse filter, or API: CONFIRMED + `publication_state=PUBLIC` only.

Do not build “worst contractors” / “contractors with complaints” SEO lists. The browse `discipline=present` filter now returns only PUBLIC rows (currently none).
