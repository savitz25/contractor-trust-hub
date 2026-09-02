# NJ-CON-002A runbook

Specialty credentials vs enforcement are separate source families. NOVs are not final orders.

```bash
python -m unittest scripts.test_nj_con_001 scripts.test_nj_con_002a
python scripts/nj_con_002a_ingest.py
```

Production: no authorized session in this ticket. Do not mint HIC/board credentials. Do not publish `/new-jersey`.

## Blocked official exports

- New Home Builder list: DCA Service Portal lookup only (`brlist.pdf` 404).
- Home Elevation Contractor: not in the 87,355 `nj_dca` dump; no standalone official HEC roster acquired.
- Contractor board-action bulk index: not published as a machine-readable file.
