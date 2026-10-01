# Florida certified person-credential wave

This is a branch-only, unpublished credential packet. No production writes or business/profile creation are authorized. The stage derives from the frozen September 30 official DBPR extracts in the B1 source manifest; source hashes are verified before parsing. The complete normalized CSV and its SHA256 are in [the stage manifest](../artifacts/th-ea-fl-credentials/manifest.json).

| Board | Official file | Raw rows | Certified person credentials | Exact native keys | Excluded source rows |
| --- | --- | ---: | ---: | ---: | ---: |
| Electrical 08 | `lic08el.csv` | 20,103 | 17,976 | 17,976 | 2,127 |
| Mold 07 | `lic07mold.csv` | 6,933 | 6,558 | 6,558 | 375 |
| Home inspector 04 | `lic04home.csv` | 9,396 | 8,026 | 8,026 | 1,370 |

Mold splits exactly into MRSA 3,339 and MRSR 3,219. The combined certified set is 32,560 distinct full native credential numbers, with zero duplicate keys across the three boards. In the electrical raw file, duplicate rows are confined to excluded noncredential classes; the selected 17,976 are unique. The class filters intentionally retain source status codes, including inactive rows. Status is not an identity or business test.

Read-only Contractor production inspection on October 1 found 1,392,730 canonical businesses, 143,516 owned board-06 licenses, and zero board-08, board-07, or board-04 licenses. The certified occupation codes were absent from existing `fl_dbpr` licenses. The proposed load therefore contains 32,560 new credential rows and **zero canonical business rows**. This is a credential count only; Contractor business denominators remain unchanged.

The existing `licenses` schema permits `contractor_id=NULL` and has a unique `(source_system,external_key)` identity. This packet keeps each full DBPR native number as `external_key`, records board and occupation independently, and preserves source file/hash/line provenance in `raw_payload`. DBA text is source text, never a name bridge. No board-06 rows are selected by either packet.

## Reviewable execution sequence

These commands are **for a future separately authorized gate**; they are not executed against production by this ticket. Run from the repository root with a PostgreSQL connection to the intended target:

```sh
python scripts/th_ea_fl_credentials_stage.py
python -c "import hashlib,json,pathlib; m=json.loads(pathlib.Path('artifacts/th-ea-fl-credentials/manifest.json').read_text()); p=pathlib.Path(m['stage_file']); assert hashlib.sha256(p.read_bytes()).hexdigest()==m['stage_sha256']"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f artifacts/th-ea-fl-credentials/load.psql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f artifacts/th-ea-fl-credentials/load.psql  # expected NEW_ROWS=0
```

For a separately authorized bounded data rollback, run `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f artifacts/th-ea-fl-credentials/rollback.psql`. It removes only rows carrying the three fixed wave batch IDs and does not remove canonical contractors or pre-existing credentials.

The disposable PostgreSQL workflow tests exact counts, null contractor links, a preserved board-06 sentinel, identical rerun, two load/rollback cycles, and a material native-key conflict that must fail closed. The [lookup preview](../artifacts/th-ea-fl-credentials/preview.md) shows real electrical, mold-assessor, mold-remediator, and home-inspector observations. No person profile route is created.
