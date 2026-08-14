# Oregon Full Journey v1 — Explore + Verify

Florida remains the deepest product. Oregon v1 adds **county browse + project matching** on top of live CCB Verify. It is not Florida-depth.

## What is live

| Surface | Route | Status |
|---------|--------|--------|
| Verify | `/verify?state=or` | Unchanged — license / name search |
| Landing | `/oregon` | Official county grid, endorsement families, project chips |
| County | `/oregon/{county}` | Native CCB `county_name` / `county_code` |
| Endorsement | `/oregon/{trade}` | RGC, RSC, RLC, CGC, CSC, … |
| County + type | `/oregon/{county}/{trade-or-project}` | Combined filter |
| Project | `/oregon/projects/{project}` | Primary CCB type + honest notes |
| Trust Report | `/contractors/{slug}?project=` | Thin OR report + published bond/insurance + project note |

## Geo method

County is the **official CCB field** on the Active Licenses extract — not a derived map.

Largest counties in the loaded extract (active rows):

| County | Approx. rows |
|--------|----------------|
| Out of state | 7,972 |
| Multnomah | 6,545 |
| Clackamas | 5,937 |
| Washington | 5,383 |
| Marion | 4,631 |
| Deschutes | 4,247 |
| Lane | 3,803 |
| Jackson | 3,022 |

**Out of state** is a published CCB county value: CCB-licensed businesses with a non-Oregon mailing address. They may still work in Oregon under CCB rules. Mailing address is not the jobsite. Product copy on `/oregon` and `/oregon/out-of-state` states this. Browse includes them (discovery does not require `home_state = OR`).

Blank / Unknown county rows exist (~500) and are omitted from named county totals.

## Project → type map

Maintained in `lib/oregon/projects.ts`.

CCB **does not publish** separate roofing, HVAC, plumbing, or electrical type codes on this extract. Those project pages start with **RGC**, lead with a “not a [trade]-specialty list” headline, and state what the extract cannot prove. RSC is an unnamed specialty — never treated as proof of a specific trade.

Example routes:

- `/oregon/projects/kitchen-remodel` — RGC
- `/oregon/projects/roofing` — RGC, with “no separate roofing type” note
- `/oregon/multnomah/residential-general` — RGC in Multnomah
- `/oregon/out-of-state` — official Out of State facet

Secondary types (RLC, RSC, CGC) are added only when a view has fewer than five primary matches.

## Bond / insurance

Result cards and Trust Reports already show published bond / insurance / WC flags on `secondary_status`. Explore does not invent amounts. Not a live COI.

## Homepage

Oregon is badged **Explore + Verify**. Do not claim Cost Studios, Plan parity, or permit intelligence.

## Deferred

- Interactive map
- Cost Studios / Plan / Passport / permit intelligence
- Inactive / revoked historical archive
- Oregon SOS entity linking
- Trade-specific CCB types that this extract does not publish

## Refresh

```bash
python scripts/download_or_ccb.py
python -m ingest.adapters.or_ccb --input data/raw/or_ccb/ccb_active_licenses.csv --out-dir data/staging/or_ccb
python scripts/load_or_ccb_to_postgres.py --staging-dir data/staging/or_ccb
```
