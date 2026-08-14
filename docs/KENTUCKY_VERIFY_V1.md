# Kentucky Verify — Phase 1

## What this is

A **live Verify slice** for Kentucky DHBC contractor-level specialties. Registry is **`live: true`**. There is no claim of statewide contractor coverage and no Plan / Studios / map surface.

Kentucky does **not** issue a statewide general contractor license. DHBC licenses specialty trades. Many builders who pull permits are city/county only.

## Smallest honest Verify path (when loaded later)

1. Search official DHBC list-view rows for **firm-level** specialties.
2. Show published type, status, DBA, issued / expiration dates.
3. Always send the user to [DHBC licensee search](https://dhbc.ky.gov/Search/HBC_List_Licensees.aspx).
4. Banner: specialty trades only · no statewide GC · missing ≠ unlicensed.

## Recommended included trades (v1, if we proceed)

| Family | Official type | Why |
|--------|---------------|-----|
| ELE | Contractor Electrician-Business | Firm electrical contractor |
| HVAC | Master HVAC Contractor | Firm HVAC contractor |
| PLB | Master Plumber | Firm plumbing contractor |
| FIRE | Fire protection **contractor** licenses (not inspector certs) | Specialty firm |

Master Electrician may be added as a **qualifier** label, not as “the company is licensed to build houses.”

## Explicit non-goals (this phase and v1)

- “All Kentucky contractors”
- Statewide GC / residential builder directory
- Invented bond, insurance, or discipline
- Plan / Studios / map / discovery browse
- Default ingest of apprentices, journeymen, inspectors, trainees
- Treating Louisville Metro (or any city list) as statewide
- JO Portal scrape

## Phase 1 status

| Surface | Status |
|---------|--------|
| Docs | This file + [DATA_SOURCES_KY.md](./DATA_SOURCES_KY.md) |
| Load | Production `ky_dhbc` · **8,360 Active** contractor-level rows (ELEC 3,884 · HVAC 2,699 · PLB 1,777) |
| Keys | `KY-DHBC:{license_number}` e.g. `KY-DHBC:CE62402` |
| Adapter | `ingest/adapters/ky_dhbc.py` |
| Registry | `EVIDENCE_STATES.ky` · `live: true` |
| Verify UI | `/verify?state=ky` |

## Production samples

- `CE62402` — electrical contractor
- `HM06343` — master HVAC contractor
- `M7396` — master plumber

## Is Kentucky worth staying live?

**Yes, as a specialty Verify** — same honesty as Texas: useful trade credentials, explicit no-statewide-GC banner. Do not expand to “all Kentucky contractors.”

## Related

- Sources: [DATA_SOURCES_KY.md](./DATA_SOURCES_KY.md)
