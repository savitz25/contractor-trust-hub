# Washington Verify v1 — L&I contractor licenses

## What is live

| Surface | Status |
|---------|--------|
| L&I contractor open-data download | `scripts/download_wa_lni.py` → `data/raw/wa_lni/` |
| Normalize / stage | `python -m ingest.adapters.wa_lni` → `data/staging/wa_lni/` |
| Postgres load | `scripts/load_wa_lni_to_postgres.py` (`source_system = wa_lni`) |
| State config | `EVIDENCE_STATES.wa` |
| Verify UI | `/verify?state=wa` (alias `washington`) |
| Trust Report | `/contractors/[slug]` when `home_state = WA` |

## Production load (2026-08-13)

Full upsert finished cleanly: **160,998** `wa_lni` licenses, **0** skipped, **0** duplicate `external_key`s. Matches the staged extract 1:1. Batch `d6cecdfd-0af9-486f-a7fb-3d32647a84ff` on `ingest_batches` (source URL, file SHA-256, `extracted_at`, `row_count = 160998`).

### By published status

| Published status | Rows |
|------------------|------|
| Active | 75,483 |
| Expired | 61,333 |
| Suspended | 9,820 |
| Re-licensed | 9,405 |
| Out of business | 4,708 |
| Inactive | 133 |
| Superceded | 94 |
| Passed away | 15 |
| Restored from archived | 6 |
| Revoked due dept err | 1 |
| **Total** | **160,998** |

### By license type

| Code | Type | Rows |
|------|------|------|
| CC | Construction contractor | 148,648 |
| EC | Electrical contractor | 9,199 |
| PC | Plumbing contractor | 3,029 |
| LC | Elevator contractor | 122 |
| **Total** | | **160,998** |

All 160,998 contractor rows have `home_state = WA`. Four rows have a null city; license number, name, status, type, effective date, and expiration are fully populated.

This feed does **not** include bond or insurance fields. A text scan of payloads for “insurance” only hit published business / principal names (for example `INSURANCE CLAIMS ROOFING LLC`) — not coverage data. No discipline or entity links.

## Honest claims

**Do say:**

- Washington licenses / registers contractors statewide through Labor & Industries (L&I).
- This search uses the official contractor license open-data extract (`m8qx-ubtq`).
- Status, type, specialty, location, UBI, and principal are **as published**.
- Always confirm on the official L&I verify site before hiring.

**Do not say:**

- That we verified a bond, insurance policy, or SOS filing (those fields are not in this extract).
- That a missing row means the person cannot work, or that an Active row is “safe to hire.”
- Rankings, “best contractors,” or lead-gen.
- Invented discipline or entity links.

## Out of scope (v1)

- Bond / insurance certificate checks (not published on this feed)
- Washington SOS / UBI entity linking
- Board discipline / complaints
- Plan / Studios / Discovery for Washington
- Lead gen

## Search

- License number (e.g. `ECOSTSC758NN`) or `WA-LNI:…` keys
- Business name
- Result cards: published status, license type / specialty, city and mailing location

Spot-checked after the full load (same SQL path as `/verify?state=wa`):

| Query | Result |
|-------|--------|
| License `04CONCL862CR` | Active construction contractor — 04 CONSTRUCTION LLC |
| Name `1002 COATINGS` | Active — 1002 COATINGS & CONST LLC (`1002CCC811LR`) |
| License `100OVOC791LN` | Expired — $100 OVER COST PAINTING CO LLC |
| License `10THCCL851D7` | Suspended — 10TH CASTLE LLC |

Trust Reports stay thin: published L&I type, status, specialty, UBI, principal, and address only. Confirm on [L&I verify](https://secure.lni.wa.gov/verify/).

## Refresh

```bash
python scripts/download_wa_lni.py
python -m ingest.adapters.wa_lni --input data/raw/wa_lni/lni_contractor_licenses.csv --out-dir data/staging/wa_lni
python scripts/load_wa_lni_to_postgres.py --staging-dir data/staging/wa_lni
```

Confirm: `SELECT COUNT(*) FROM licenses WHERE source_system = 'wa_lni';` should equal the adapter `row_count_licenses`.

## Related

- Explore: [WASHINGTON_FULL_JOURNEY_V1.md](./WASHINGTON_FULL_JOURNEY_V1.md)
- Sources: [DATA_SOURCES_WA.md](./DATA_SOURCES_WA.md)
