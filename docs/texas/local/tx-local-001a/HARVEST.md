# TX-CON-LOCAL-001A — Austin/Travis + Fort Worth/Tarrant harvest

Internal harvest. **No public local routes.**

Namespaces: `austin-travis`, `fort-worth-tarrant`, `tx-local-001a`.

Builder 4 (`san-antonio-bexar`, `houston-harris`) is untouched. No shared Texas-local loader.

## Guardrails

- Local permit contractor ≠ state licensee
- General contractor without TDLR ≠ unlicensed
- Permit count ≠ quality / experience score
- Valuation ≠ revenue
- Appraisal value ≠ sale price
- Property address ≠ owner
- Contractor phone ≠ state regulator contact
- Missing ≠ zero
- No Trust Score, no ranking, no name-only adverse attach

## Austin P0

Official source: [Issued Construction Permits](https://data.austintexas.gov/Building-and-Development/Issued-Construction-Permits/3syk-w9eu) (`3syk-w9eu`).

- 2,373,854 issued-permit rows (CSV SHA-256 `3ff78f727b98c7d8c7f6a17867e46afa133776c7fbb2b306b8b03cd9b7e53aa8`, 1.51 GB)
- Grain: one row = one issued permit
- Contractor company / phone / trade / address are source-native
- **No TDLR, TSBPE, or city contractor number on the permit file**
- 2,310,765 rows carry a TCAD ID (254,703 distinct)

Raw file lives off-repo at `S:\ath-raw\tx-con-local-001a\`.

## Fort Worth P0

Official full-data pointer: [Development Permits](https://data.fortworthtexas.gov/Development-Infrastructure/Development-Permits/quz7-xnsy) / ArcGIS item `d2740f4d746b4bfaa03e25de0376238b`.

- FeatureServer count: **1,611,676**
- Official bulk table has **no contractor company, phone, or license fields**
- `Owner_Full_Name` is property owner, not contractor

## Publication

Do not publish `/texas/austin`, `/texas/travis`, `/texas/fort-worth`, or `/texas/tarrant` in this ticket.
