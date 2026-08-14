# Wisconsin Verify — Phase 0 / smallest honest path

## What this is

A **foundation** for a future Wisconsin Verify slice. The registry stub is **`live: false`**. There is no WI tab, no Plan / Studios / map surface, and no claim of statewide contractor coverage.

Wisconsin does **not** issue a statewide commercial general contractor license. DSPS issues a **Dwelling Contractor** credential for 1–2 family building permits, plus trade credentials (electrical, HVAC, plumbing, and related).

## Smallest honest Verify path (when loaded later)

1. Search official DSPS / LicensE rows for **firm-level** credentials only.
2. Show published type, status, and dates when the extract includes them.
3. Always send the user to [LicensE License Lookup](https://license.wi.gov/s/license-lookup).
4. Banner: dwelling + trade credentials · not a statewide commercial GC · missing ≠ unlicensed.

Do not invent bond, insurance, or discipline. If a later extract includes a disciplinary **indicator**, treat it as a pointer to the official orders search — not as a structured case file.

## Recommended credential set for v1

| Family | Official type | LicensE suffix | Why |
|--------|---------------|----------------|-----|
| DC | Dwelling Contractor | `DC` | Firm-oriented 1–2 family permit credential |
| DCR | Dwelling Contractor Restricted | `DCR` | Same family, restricted |
| EC | Electrical Contractor | `EC` | Firm electrical business |
| HVAC | HVAC Contractor | `HVACCONT` | Firm HVAC registration |

Approximate official **active** statewide counts as of 06/01/2026 (LicenseCounts.pdf): DC 9,460 · EC 3,701 · HVAC 2,843 · DCR 66.

Qualifier / person credentials (DCQ, HVACQ, Master Electrician, Master Plumber) may be added later **only** if labeled as qualifiers / individuals, not as “this company is the GC.”

## Explicit non-goals (this phase and v1)

- “All Wisconsin contractors”
- Statewide commercial GC / Florida-style CGC directory
- Invented bond, insurance, or discipline
- Plan / Studios / map / discovery browse
- Default ingest of apprentices, journeymen, helpers, inspectors, testers
- Treating Dwelling Contractor as a commercial general contractor
- Using the DSPS License API as a roster sync
- Uncapped LicensE / Salesforce harvest

## Phase 0 status

| Surface | Status |
|---------|--------|
| Docs | This file + [DATA_SOURCES_WI.md](./DATA_SOURCES_WI.md) |
| Sample | `data/samples/wi_dsps/` — official suffixes + published counts; **0 licensee rows** |
| Raw probe | `data/raw/wi_dsps/` (hub, LicensE SPA shell, Order List page, API 401, official PDFs) |
| Adapter | `ingest/adapters/wi_dsps.py` |
| Registry | `EVIDENCE_STATES.wi` · `live: false` · not in `LIVE_STATE_ORDER` |
| Verify UI | **Not built** until a real load |

## Realistic data path

1. **Best:** restored [Order List of Licensees](https://dsps.wi.gov/Pages/SelfService/OrderListofLicensees.aspx), filtered to DC / DCR / EC / HVACCONT.
2. **Next best:** open-records request to DSPSPublicRecords@Wisconsin.gov for those four types (active + inactive if they will include them).
3. **Lookup-only later:** DSPS License API for a number the user already typed — verification, not ingest.
4. **Last resort:** polite, capped LicensE search harvest. Cloudflare blocked the lookup URL from this environment; do not plan v1 on it.

## Is Wisconsin worth full Verify v1 now?

**Wait for an official extract. Do not launch from this Phase 0 sample.**

Wisconsin is a **better** Verify candidate than a no-GC specialty-only state: homeowners actually use Dwelling Contractor on 1–2 family permits, and Electrical / HVAC contractor credentials are firm-oriented with published counts in the thousands. That set is worth building.

It is **not** worth launching now:

- The official list service is suspended.
- The API is live but forbids roster replication.
- LicensE is Cloudflare-fronted Salesforce with no public export.
- Phase 0 has no licensee rows to load.

Keep `live: false` until a real DC + EC + HVACCONT file is in hand. Then a thin Verify v1 is justified — still with the dwelling-not-commercial-GC banner.

## Related

- Sources: [DATA_SOURCES_WI.md](./DATA_SOURCES_WI.md)
