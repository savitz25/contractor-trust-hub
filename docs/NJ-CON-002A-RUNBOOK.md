# NJ-CON-002A runbook

Specialty credentials vs enforcement are separate source families. NOVs are not
final orders. Missing sources are `SOURCE_NOT_ACQUIRED`, never "no record found."

```bash
python -m unittest scripts.test_nj_con_001 scripts.test_nj_con_002a
python scripts/nj_con_002a_ingest.py
python scripts/apply_migration_014.py   # production session only
python scripts/nj_con_002a_ingest.py --execute
```

Production: no authorized session in this ticket. Do not mint HIC/board
credentials. Do not write specialty lists into `licenses` or `discipline_actions`.
Persist through `official_source_snapshots` / `official_source_observations` /
`official_source_occurrences` with `public_eligibility_status = internal_only`.
Do not publish `/new-jersey`.

## Source coverage

| Family | Coverage | Evidence class |
| --- | --- | --- |
| Lead evaluation | ACQUIRED | specialty_credential |
| Lead abatement | ACQUIRED | specialty_credential |
| ASCM authorization | ACQUIRED | specialty_credential |
| Fire-protection permit (C1–C6) | ACQUIRED | specialty_credential |
| Operation Safe House HIC NOV | ACQUIRED | regulatory_event |
| OCP legal filings (4 PDFs) | PARTIAL_SOURCE_COVERAGE | regulatory_event |
| Contractor board-action bulk index | SOURCE_NOT_ACQUIRED | regulatory_event |
| New-home-builder bulk list | SOURCE_NOT_ACQUIRED | specialty_credential |
| Home Elevation Contractor roster | SOURCE_NOT_ACQUIRED | specialty_credential |
| PWCR roster | SOURCE_NOT_ACQUIRED | registration_roster |
| Prevailing-wage debarment roster | SOURCE_NOT_ACQUIRED | exclusion_list |

OCP's four acquired PDFs cannot support a public statement such as "No other
enforcement record found." Unacquired families must not receive zero-valued
observations.

OCP docket `24-013` appears on both Progressive Paving (denial of registration,
2024-12-24) and TNT Builders (final order on default, 2025-06-03). Related-docket
links require the same NOV, or the same docket **and** the same respondent.

Safe House `$2,500` amounts are proposed penalties on NOVs, not paid fines or
final adjudications.

## Blocked official exports

- New Home Builder list: DCA Service Portal lookup only (`brlist.pdf` 404).
- Home Elevation Contractor: not in the 87,355 `nj_dca` dump; no standalone official HEC roster acquired.
- Contractor board-action bulk index: not published as a machine-readable file.
- PWCR / prevailing-wage: Power BI only; OPRA preserved. Do not wait on OPRA.
