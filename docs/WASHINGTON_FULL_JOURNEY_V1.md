# Washington Full Journey v1 — Explore + Verify

Florida remains the deepest product (plan, studios, permits, passport). Washington v1 adds **city / derived-county browse + project matching** on top of live L&I Verify. It is not Florida-depth.

## What is live

| Surface | Route | Status |
|---------|--------|--------|
| Verify | `/verify?state=wa` | Unchanged — license / name search |
| Landing | `/washington` | Verify shortcut, top markets, project chips, coverage strip |
| Geo | `/washington/{city-or-county}` | Major cities + ZIP-derived counties |
| Type / specialty | `/washington/{trade}` | CC / EC / PC / LC and named construction specialties |
| Geo + type or project | `/washington/{geo}/{trade-or-project}` | Combined filter |
| Project | `/washington/projects/{project}` | Primary type/specialty + also-needed |
| Trust Report | `/contractors/{slug}?project=` | Thin WA report + educational project note |

## Geo method

The L&I general extract (`m8qx-ubtq`) is **strong on city and ZIP** and does **not** publish an official county field. Product copy states this on the landing page, county pages, city pages, and empty geo states.

- **City browse** matches the mailing city only (and mailing state `WA`, so Vancouver is Washington — not B.C.).
- **County browse** rolls up a maintained **ZIP5 → county** map (`lib/washington/zip-counties.ts`) at query time. That map is not written onto license rows and is not an L&I field.
- ZIP3 is **not** used. `980`, `982`, `983`, `985`, and `986` mix counties.
- Multi-county ZIPs are assigned to the majority county and called out in copy (Auburn 98001 → King; Bainbridge 98110 → Kitsap, not King; Pasco 99301 is Franklin and is omitted from Benton).
- Out-of-state mailing addresses (~8,999 active) are omitted from Washington county totals and have their own `/washington/out-of-state` page. Mailing address is not the jobsite. The credential is still Washington L&I.

Interactive map is deferred.

### Top markets by density (active rows, 2026-08 load)

Priority city pages (mailing city, WA state):

| City | Approx. active rows |
|------|---------------------|
| Seattle | 3,773 |
| Vancouver | 3,048 |
| Spokane | 2,724 |
| Tacoma | 2,263 |
| Everett | 1,889 |
| Kent | 1,515 |
| Renton | 1,264 |
| Federal Way | 1,042 |
| Bellevue | 976 |
| Kirkland | 748 |

Derived counties (ZIP5 rollup, active):

| County | Approx. active rows |
|--------|---------------------|
| King | 16,420 |
| Snohomish | 9,048 |
| Out of state (mailing) | 8,999 |
| Pierce | 7,396 |
| Spokane | 5,152 |
| Clark | 4,869 |
| Whatcom | 2,402 |
| Kitsap | 2,189 |
| Thurston | 2,176 |
| Benton | 1,646 |
| Yakima | 1,532 |

Spokane **city** is `/washington/spokane`. Spokane **County** is `/washington/spokane-county`.

## Project → type / specialty map

Maintained in `lib/washington/projects.ts`.

Washington construction contractor registration (`CC`) is broad. Electrical (`EC`) and plumbing (`PC`) are separate published types. Named construction specialties (Roofing, HVAC/R, General, …) live on `specialtycode1` / `occupation_description` — coverage quality varies.

Rules:

- Primary published type/specialty first
- Secondary only when a view has fewer than five primary matches
- Also-needed chips link to related type pages — not a ranking
- Plain language first, official code second
- Do not treat General (`01`) as proof of roofing, HVAC, plumbing, electrical, or pool work

Example routes:

- `/washington` — landing
- `/washington/seattle` — Seattle mailing city
- `/washington/king` — King County via ZIP
- `/washington/projects/kitchen-remodel` — CC · GENERAL
- `/washington/projects/roofing` — CC · Roofing (CD)
- `/washington/projects/electrical` — EC
- `/washington/seattle/plumbing` — PC in Seattle
- `/washington/out-of-state` — non-WA mailing address

## Active-first

Discovery lists default to `status_normalized IN ('active','current')`. Expired and suspended rows remain on Verify and on Trust Reports when opened. Status is shown honestly — a hit is not “cleared to hire.”

## Bond / insurance / discipline

This extract does **not** publish bond, insurance, or discipline. Explore does not invent them. Confirm on [L&I verify](https://secure.lni.wa.gov/verify/).

## Homepage

Washington is badged **Explore + Verify**, not Verify-only. Explorer entry: `/washington`. Do not claim Cost Studios, Plan parity, permit intelligence, or Florida-depth.

## Deferred

- Interactive map
- Cost Studios / Plan / Passport / permit intelligence
- Invented bond / insurance / discipline
- Official county field (not in this extract)
- Complete historical inactive archive as a browse default
- Washington SOS / UBI entity linking

## Refresh

Same L&I ingest as Verify:

```bash
python scripts/download_wa_lni.py
python -m ingest.adapters.wa_lni --input data/raw/wa_lni/lni_contractor_licenses.csv --out-dir data/staging/wa_lni
python scripts/load_wa_lni_to_postgres.py --staging-dir data/staging/wa_lni
```
