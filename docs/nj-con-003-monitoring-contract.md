# NJ-CON-003 monitoring contract

The first NJ official-source and permit snapshots are **baseline-only**.

They do not emit historical customer alerts.

## Future exact change events (subsequent snapshots only)

Stable event IDs must include `source_family` + `source_observation_key` or
`source_system` + `source_record_key`.

- New WALL observation
- WALL record removed from the current snapshot
- New Wage Violation Watchlist observation
- New Treasury action
- New specialty credential
- Specialty credential status/lapse change
- New NOV/order
- New source permit/certificate record
- Existing permit source record changed (fingerprint change)
- Previously unavailable municipality begins reporting
- Municipality stops appearing, coverage status unknown
- Source schema drift
- Source file hash change
- Source data update timestamp change

## Do not alert

- A row ages out of the stated 60-month window
- A municipality is absent
- A source is SOURCE_NOT_ACQUIRED
- A source page changes row order
- A certificate follows a permit
- Update = X changes without a relevant field fingerprint change
- STATE_LEVEL rows existing as a separate geography
