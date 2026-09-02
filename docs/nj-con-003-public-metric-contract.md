# NJ-CON-003 public metric contract

No metric is public-eligible until Construction Reporter reconciliation assigns
`APPROVED_FOR_PUBLICATION` or `APPROVED_WITH_CAVEAT`. Combined P+C cost and
“2.68 million permits” are blocked.

Source as-of: 2026-08-13. Received as-of: 2026-08-07. Snapshot is baseline-only.

## Required labels

Use: Permit-issued records · Certificate-issued records · Permit and certificate
source records · Source-reported estimated construction value · Net housing-unit
change · Records observed in the NJ DCA source · Reporting municipality · No
records observed · Source not acquired · Partial source coverage.

Do not use: “2.68 million permits” · Projects completed · Contractor projects ·
Units gained (for a net measure) · All New Jersey municipalities reported · No
violations · Clean record · Vetted · Government approved.

## STATEWIDE

### Permit-issued records
- **Definition:** Count of source rows with Status = P, excluding STATE_LEVEL rows.
- **Numerator:** Count of those rows. **Denominator:** source extract.
- **Source record class:** permit-issued municipal records.
- **Included:** P. **Excluded:** C, STATE_LEVEL.
- **Date field:** none (stock of current extract). **Geography:** municipal.
- **Audited/unaudited:** stock includes unaudited recent months; disclose.
- **Caveat:** Not “permits completed.” Not contractor jobs.
- **Trace:** `status = P AND county <> 'STATE'`.
- **Public eligibility:** APPROVED_WITH_CAVEAT (internal until production execute).

### Certificate-issued records
- Same structure with Status = C.
- **Public eligibility:** APPROVED_WITH_CAVEAT (internal until production execute).

### Current source reporting period
- Process-date min/max in the extract, plus stated 60-month receipt rule.
- **Public eligibility:** APPROVED_WITH_CAVEAT. Disclose that observed process
  dates extend to 1989, so the extract is not strictly a 60-month file.

### Officially comparable authorized construction value
- **Definition:** Sum of `constcost` on permit-issued municipal rows with a valid
  permit date in the comparison period. Includes reported zeros. Excludes blank,
  negative, and unresolved extreme (≥ $500M pending review). Does **not** add
  certificate-issued costs.
- **Date field:** permit date. **Geography:** municipal (exclude STATE_LEVEL).
- **Caveat:** Applicant-reported estimated value. Reporter tables are audited and
  will differ. P+C $126.1B is blocked.
- **Public eligibility:** INTERNAL_ONLY until Reporter calendar totals reconcile
  within documented tolerance. 2023–2025 calendar microdata currently
  BLOCKED_DUE_TO_RECONCILIATION (~20–52% below official). 2025 official cost
  YTD blocked (PDF overflow). Combined P+C $126.1B remains blocked.

### Work-type mix
- Permit-issued municipal counts by permit type (New / Addition / Alteration /
  Demolition).
- **Public eligibility:** APPROVED_WITH_CAVEAT.

### Net housing-unit change
- Sum of sale-unit and rental-unit fields on the chosen record class.
- Disclose gross positive and gross negative separately.
- **Never labeled “units gained.”**
- For Reporter comparison, use gross positive units on permit-issued rows.
- **Public eligibility:** APPROVED_WITH_CAVEAT for the net series; Reporter
  comparison uses gross positive units.

### Reporting municipality count
- Current canonical municipalities (564) with ≥1 observed source record.
- **Public eligibility:** APPROVED_WITH_CAVEAT.

### Non-reporting municipality count
- Agency-named current municipalities with no data in this extract (8).
- Display as SOURCE coverage, not zero activity.
- **Public eligibility:** APPROVED_WITH_CAVEAT.

### County share of observed activity
- Permit-issued municipal counts by the 21 counties. Do not rank quality.
- **Must include Union and Warren.**
- **Public eligibility:** APPROVED_WITH_CAVEAT.

## COUNTY / MUNICIPALITY

Same metrics sliced by county or municipality code. Historical/inactive codes
remain visible as HISTORICAL_OR_INACTIVE. Current municipalities with no rows
are CURRENT_COVERAGE_UNKNOWN or CURRENT_NON_REPORTING — never “reported zero”
unless the Construction Reporter prints `0`.

## DATA-QUALITY METRICS

Invalid dates, future-date review records, cost outliers, historical codes,
SOURCE_NOT_ACQUIRED gaps, latest audited month, latest unaudited month.

## Coverage that is not a zero

- PWCR, prevailing-wage debarment, new-home builder, HEC, board-action bulk:
  SOURCE_NOT_ACQUIRED.
- OCP legal filings: PARTIAL_SOURCE_COVERAGE.
- Missing source ≠ clean record.

## Blocked

| Candidate | Status |
| --- | --- |
| 2,678,341 as “permits” | BLOCKED_PENDING_DEFINITION |
| $126,101,062,607 combined P+C cost | BLOCKED_PENDING_DEFINITION |
| Contractor permit histories | BLOCKED |
| 2025 official authorized cost | BLOCKED_DUE_TO_RECONCILIATION |
| Future-dated permit activity in completed trends | BLOCKED |
| STATE rows folded into municipal statewide totals | BLOCKED pending additive proof |
