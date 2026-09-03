# NJ-CON-COUNTY-001 — four-county contractor intelligence

Routes (index,follow when gate passes):

- `/new-jersey/monmouth-county`
- `/new-jersey/middlesex-county`
- `/new-jersey/somerset-county`
- `/new-jersey/union-county`

Snapshots live in `lib/new-jersey-intelligence/counties/`. Rebuild with `python -X utf8 scripts/build_nj_con_county_001.py` then copy fingerprints into `publication.ts`.

## Grain

- Construction metrics are SOURCE RECORDS projected from NJ-CON-002B / NJ-CON-004. Not permits. Not projects. P and C stay separate. Combined cost stays blocked.
- NJSAVI rows are certified vendors, not licensed contractors. City is not a service area.
- Union Home Improvement Program is CDBG rehab, not a county contractor license.

## Tests

`npm run test:nj-con-county-001`
