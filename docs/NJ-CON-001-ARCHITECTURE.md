# NJ-CON-001 architecture

## Why not `discipline_actions` or Florida `regulatory_source_observations`

- `discipline_actions` is board/ULA/recovery-fund evidence with Florida publication gates. PWCR is a **registration roster**. WALL, the Wage Violation Watchlist, and Treasury lists are **current official lists**, not interchangeable with board discipline, NOVs, or final orders.
- `regulatory_source_observations` requires a non-null `discipline_action_id`. Unmatched official list rows would have to mint fake discipline rows.
- `regulatory_change_events` requires a non-null `contractor_id`. Unattached official rows cannot live there.

## Generic tables used instead

`official_source_snapshots`, `official_source_observations`, and `official_source_occurrences` are jurisdiction-agnostic. Adapters set `source_family` (`NJ_WALL`, `NJ_TREASURY_VENDOR_DEBARMENT`, …). Future states reuse the same pair; they do not add `tx_source_*` clones.

Families remain legally distinct. Construction and vendor Treasury files never share a family. WALL is not prevailing-wage debarment. A watchlist row is not a debarment.

Duplicate official rows (Watchlist) collapse to one observation fingerprint and keep every file locator as an occurrence. Raw provenance is not deleted.

`public_eligibility_status` defaults to `internal_only`.
