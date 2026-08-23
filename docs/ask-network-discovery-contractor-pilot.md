# ASK-SEARCH-CONTRACTOR-001 — Contractor discovery pilot

**Status:** PILOT / NOT YET CONSUMED BY ASK PRODUCTION

This Hub emits a read-only `ask-network-discovery-v1` feed from authoritative ContractorTrustHub Postgres. AskTrustHub is not modified and does not ingest this file in this task.

```
contractors + licenses
        ↓
occupation-code slices (no keyword inference)
        ↓
company-level network entity
        ↓
fail-closed eligibility
        ↓
deterministic 200-entity cohort
        ↓
data/network-discovery/contractor-discovery-pilot.v1.json
```

## Canonical source

| Concept | Actual source |
|---|---|
| Company | `public.contractors` (UUID `id`, unique `slug`) |
| License observations | `public.licenses` (`contractor_id`, `occupation_code`, `status_normalized`, address, `county_code` / `county_name`, `source_system`) |
| Entity / Sunbiz links | `entities` / `contractor_entities` — research only, not exported |
| Discipline | `discipline_actions` — Trust Report research only, not exported |

Displayable / searchable company: `is_thin_profile = FALSE` and non-empty `slug`.

Public profile: `https://www.contractortrusthub.com/contractors/{slug}`

Florida browse (READY): `https://www.contractortrusthub.com/florida/{county}/{trade}`

New Jersey browse: **not enabled** (`browseEnabled: false`). Destination is `/verify` with no query identity.

## Identity

```
network_entity_id = contractor:{contractors.id}
source_entity_id  = contractors.slug
```

- Deterministic, unique, stable.
- Company UUID, not license number, not display name.
- One company with several licenses stays one network entity; trades accumulate on `categories[]`.
- No national contractor ID is assumed. License numbers remain jurisdiction-specific observations.

## Multi-license / multi-trade

The product model is **company identity + license observations**, not “each license is a profile.”

- Multiple occupation codes → one contractor, multiple Ask categories.
- Licenses in more than one county → one contractor; physical `city` / `county` is the primary/first observed address, not a service graph.
- Cross-state mailing address vs board credential: physical `state` comes from the license/contractor address; regulatory copy may still name the board (e.g. New Jersey credential on file). Those signals are not flattened into each other.

## Trade taxonomy

Occupation codes only. Business-name keywords are not a classification system.

| Source trade | Canonical Contractor | Ask category | Readiness |
|---|---|---|---|
| FL CCC, RR | Roofing (CILB occupation pages) | `roofing` | READY |
| FL CFC; NJ PLB | Plumbing | `plumbing` | READY |
| FL CAC only (not CMC); NJ HVAC | Air-conditioning / HVACR | `hvac` | READY |
| NJ ELE, TEL (not FL — no CILB electrical page) | Electrical | `electrical` | SOFT |
| FL CGC only (not CBC/CRC); NJ HIC, GEN | General / home-improvement registration | `general_contractor` | READY in FL CGC browse; SOFT in NJ (no statewide GC, no county browse) |
| FL CPC | Pool/spa | `pool` | READY |
| FL name-assist solar | — | `solar` | UNSUPPORTED |
| kitchen / bathroom remodeling, painting, flooring | — | — | UNSUPPORTED |
| home inspector | — | — | UNSUPPORTED (fail closed) |

CBC, CRC, and CMC exist in Florida and are **not** widened to general contractor or HVAC.

NJ HIC is **not** inferred as roofing.

## Geography

| Signal | Classification |
|---|---|
| Physical city (`licenses.city` / `contractors.primary_city`) | authoritative (physical-only) |
| Physical county (`county_name` / `primary_county`; FL also `county_code`) | authoritative (physical-only) |
| Physical / mailing state | authoritative (physical-only) |
| ZIP | physical-only when present on the license row |
| License / board jurisdiction | authoritative regulatory signal; **not** city or county coverage |
| Service county / service state | **unsupported** — no verified service-territory graph; not manufactured |
| City → county | derived safely only via the curated Florida county table for browse URLs; query matching uses stored county text, not geocoding |

A Miami-Dade license address does not prove the firm serves Broward. A Florida license does not prove the firm is located in Miami.

No Google Places, geocoding, or LLM enrichment.

## Regulatory status

Publication-safe, source-backed only, for example:

- `Florida DBPR construction license on file (active)`
- `New Jersey contractor credential on file (active)`

Not emitted: trusted, best, safe, recommended, clean, or “no complaints.” Absence of enforcement is not a positive claim. Complaint/discipline detail stays in ContractorTrustHub research.

## Discovery eligibility

Fail closed. A company is eligible when all of:

1. Not a thin profile, slug present
2. At least one mapped (non-UNSUPPORTED) occupation code
3. Active/current license status on the observation used
4. Canonical HTTPS profile on `www.contractortrusthub.com/contractors/{slug}`
5. At least one of state, city, county

Not used: Premium, payment, advertising, review count, ratings, Trust Score, popularity, lead conversion.

## Pilot selection

Target 200. Deterministic:

1. Reserve the UUID-smallest eligible match for each required query fixture that has any match (coverage, not ranking).
2. Round-robin remaining entities by first Ask category, UUID order.

Slices are equality filters (occupation + optional county_code / city / county_name) because catalog-wide `COUNT(DISTINCT)` and wide OR predicates exceed statement timeout.

## Query readiness (semantics)

Florida:

| Query | How a match qualifies |
|---|---|
| roofers Miami FL | `roofing` + physical city Miami and/or physical county Miami-Dade |
| roofing contractors Broward County FL | `roofing` + physical Broward |
| plumbers Palm Beach County FL | `plumbing` + physical Palm Beach |
| HVAC contractors Tampa FL | `hvac` (CAC only) + physical Tampa and/or Hillsborough |
| electricians Jacksonville FL | expected **0** — Florida electrical is not an occupation-page export |
| general contractors Orlando FL | `general_contractor` (CGC) + physical Orlando and/or Orange |

New Jersey:

| Query | How a match qualifies |
|---|---|
| roofers Monmouth County NJ | expected **0** unless a roofing occupation exists; HIC is not roofing |
| plumbers Bergen County NJ | `plumbing` (PLB) + physical Bergen |
| contractors Middlesex County NJ | `general_contractor` (HIC/GEN) + physical Middlesex |
| general contractors New Jersey | `general_contractor` + physical NJ **or** NJ credential summary (`license_state`) |

Fail closed:

| Query | Result |
|---|---|
| home inspectors Miami | **0** — unsupported taxonomy; does not widen to general contractor |

## Security / minimization

Not exported: phones, emails, owner PII, complaint narratives, court/regulator documents, contracts, credentials, Premium/payment, rankings, ratings, review popularity, Trust Score internals.

Canonical URLs: HTTPS, `www.contractortrusthub.com` only, no localhost, no Vercel preview, no query-based identity.

## Publisher commands

```text
npx.cmd --yes tsx scripts/assert-contractor-discovery-pilot.mts
npx.cmd --yes tsx scripts/publish-contractor-discovery-pilot.mts
```

Artifact: `data/network-discovery/contractor-discovery-pilot.v1.json`

Live catalog (2026-08-23, no new enrichment):

| Measure | Value |
|---|---|
| `pg_class` contractors | 1,364,306 (estimate) |
| `pg_class` licenses | 1,208,793 (estimate) |
| Public FL (`home_state=FL`, not thin) | 131,613 |
| Public NJ (`home_state=NJ`, not thin) | 76,977 |
| Thin-profile COUNT | timed out — not used for eligibility |
| Sliced considered / eligible | 541 / 541 |
| Pilot exported | 200 |
| Fingerprint | `3ae1595ea980eac1201ebb528f3aa1ec82ba227e0d990f9f293dbc200cc41ec1` |
| Membership/identity/content drift (two unchanged runs) | 0 |

Pilot geography: FL 120, NJ 80. Categories: roofing 34, plumbing 34, HVAC 33, electrical 32, general_contractor 35, pool 32.

External calls required: Google Places 0, LLM 0, geocoding 0, new enrichment 0.

## Readiness for Ask ingestion

A **bounded Florida subset** (roofing, plumbing, HVAC/CAC, pool, CGC + physical county/city) has real canonical profiles and occupation-backed categories. That subset is the only honest candidate to move a future Ask adapter from `soft_handoff` toward `ready`.

Do not flip the Hub-wide adapter to READY in this task.

New Jersey remains SOFT: Verify/specialty depth, no county browse, no statewide GC, no roofing occupation.

Unsupported Ask trades stay fail-closed.
