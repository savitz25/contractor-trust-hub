# Louisiana Verify v1 — LSLBC contractor licenses

## What is live

| Surface | Status |
|---------|--------|
| Official Request Roster download | `scripts/download_la_lslbc.py` → `data/raw/la_lslbc/` |
| Normalize / stage | `python -m ingest.adapters.la_lslbc` → `data/staging/la_lslbc/` |
| Postgres load | `scripts/load_la_lslbc_to_postgres.py` (`source_system = la_lslbc`) |
| State config | `EVIDENCE_STATES.la` |
| Verify UI | `/verify?state=la` (alias `louisiana`) |
| Trust Report | `/contractors/[slug]` when `home_state = LA` |

## Production load (2026-08-14)

Official public Request Roster, **Active only**. Adapter produced **26,298** unique `LA-LSLBC:{number}` keys, **0** skipped, **0** duplicate keys.

### By published type

| Code | Published type | Rows |
|------|----------------|------|
| CLC | Commercial License Certificate | 19,993 |
| RLC | Residential License Certificate | 4,579 |
| HIR | Home Improvement Registration | 1,462 |
| MRL | Mold Remediation License Certificate | 264 |
| **Total** | | **26,298** |

### By published status

All **26,298** rows are `Active`. The public roster form requires `StatusTypes=1` (Active) and does not offer expired / inactive.

## Honest claims

**Do say:**

- Louisiana licenses contractors statewide through LSLBC.
- This search uses the official public Request Roster.
- Type, Active status, parish / city, and dates are **as published**.
- Always confirm on the official LSLBC lookup (classifications live there).

**Do not say:**

- That we verified a bond, insurance policy, qualifying party, or SOS filing.
- That a missing row means the person cannot work (expired credentials are not on this export).
- Rankings, “best contractors,” or lead-gen.
- Invented trade classifications or discipline.

## Out of scope (v1)

- Trade classification / qualifying-party scrape of the interactive search
- Expired / inactive archive
- Bond / insurance / discipline
- Louisiana SOS entity linking
- Plan / Studios / Discovery / map
- Lead gen

## Search

- License number (e.g. `68755`) or `LA-LSLBC:…` keys
- Business name
- Result cards: published type (plain language + official label), Active status, parish / city

Example searches (after load):

| Query | Expected |
|-------|----------|
| `/verify?state=la&q=68755` | Active commercial — 09 Construction Services, LLC (Bossier) |
| `/verify?state=la&q=09%20Construction` | Same firm by name |
| `/verify?state=la` | Empty Verify with coverage banner |

Trust Reports stay thin: published LSLBC type, status, parish, and dates only. Confirm on [LSLBC lookup](https://arlspublic.lslbc.louisiana.gov/Public/Search).

## Refresh

```bash
python scripts/download_la_lslbc.py
python -m ingest.adapters.la_lslbc --input data/raw/la_lslbc/lslbc_contractor_roster.csv --out-dir data/staging/la_lslbc
python scripts/load_la_lslbc_to_postgres.py --staging-dir data/staging/la_lslbc
```

Confirm: `SELECT COUNT(*) FROM licenses WHERE source_system = 'la_lslbc';` should equal **26298**.

## Related

- Sources: [DATA_SOURCES_LA.md](./DATA_SOURCES_LA.md)
