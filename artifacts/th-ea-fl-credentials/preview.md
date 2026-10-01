# Florida DBPR exact credential lookup preview

Branch-only preview for ticket TH-EA-UNPUBLISHED-2026-10-01-FL-CREDENTIALS. Lookup requires an exact regulator credential number. It never searches names or treats DBA text as a business identity. A result is a **person credential observation**, with `contractor_id=NULL`; it is not a Contractor business profile.

Run `python scripts/th_ea_fl_credential_lookup.py <native-number>` from the repository root.

| Exact lookup | Board | Class | Reported holder | Source status | Source file |
| --- | --- | --- | --- | --- | --- |
| `EF0000971` | 08 | EF | MORALES, ALEJANDRO M | C/A | `lic08el.csv` |
| `MRSA4` | 07 | MRSA | LAPOTAIRE, JOHN P | C/A | `lic07mold.csv` |
| `MRSR1` | 07 | MRSR | YACOBACCI, GENE | C/A | `lic07mold.csv` |
| `HI49` | 04 | HI | HOUGH, MICHAEL WILLIAM | C/I | `lic04home.csv` |

Each response includes the native number, board, class, raw and normalized status, expiration, source file, source SHA256 and line number. Names and DBA strings are displayed solely as reported source text. A name query and an unknown credential return `null`.

The [stage manifest](manifest.json) locks the three official September 30 files and the derived 32,560-row CSV. The [load packet](load.psql) requires the exact certified class distribution, preserves board 06, and inserts only unlinked credentials. The [rollback packet](rollback.psql) deletes only rows tagged with this wave's three fixed ingest batch IDs.
