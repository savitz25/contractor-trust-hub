# Oregon Verify v1 — CCB active licenses

## What is live

| Surface | Status |
|---------|--------|
| CCB Active Licenses download | `scripts/download_or_ccb.py` → `data/raw/or_ccb/` |
| Normalize / stage | `python -m ingest.adapters.or_ccb` → `data/staging/or_ccb/` |
| Postgres load | `scripts/load_or_ccb_to_postgres.py` (`source_system = or_ccb`) |
| State config | `EVIDENCE_STATES.or` |
| Verify UI | `/verify?state=or` |
| Trust Report | `/contractors/[slug]` when `home_state = OR` |

## Honest claims

**Do say:**

- Oregon licenses contractors statewide through the Construction Contractors Board (CCB).
- This search uses the official **active licenses** open-data extract.
- Bond and liability insurance fields are **as published** — not a live certificate check.
- Always confirm on the official CCB search before hiring.

**Do not say:**

- That we verified a bond would pay or that insurance is currently in force.
- That missing from this extract means the person cannot work (the feed is active-only).
- Rankings, “best contractors,” or lead-gen.

## Out of scope (v1)

- Inactive / revoked historical archive
- Oregon Secretary of State entity linking
- Board discipline / complaints (unless a later official extract)
- Plan / Studios / Discovery for Oregon
- Lead gen

## Search

- License number (e.g. `259513`) or `OR-CCB:…` keys
- Business name
- Result cards: type, status, location, bond/insurance **listed** signal when present
