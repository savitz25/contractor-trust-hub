# ASK-SEARCH-CONTRACTOR-001 / 001.1 — Contractor discovery pilot

**Status:** PILOT / NOT YET CONSUMED BY ASK PRODUCTION

**Amendment 001.1:** natural cohort closeout + frozen Florida discovery policy. Queries evaluate the cohort; they do not choose it.

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

## Pilot selection (001.1 — natural, query-independent)

Target 200. Queries, QA cities, and QA counties are **not** inputs.

Exact algorithm:

1. Sort eligible entities by `network_entity_id` (`contractor:{uuid}`).
2. If eligible length ≤ 200, emit that sorted list.
3. Stratify by `` `${state}|${first Ask category}` ``. State and trade are generic product dimensions. Strata are **not** Miami, Broward, Palm Beach, Tampa, Jacksonville, Orlando, Monmouth, Bergen, or Middlesex.
4. Within each stratum, keep UUID order.
5. Round-robin across strata (stratum keys sorted lexicographically) until 200.
6. Sort the selected 200 by `network_entity_id`.

Not consulted: Premium, payment, ratings, review counts, Trust Scores, query fixtures.

001 membership used a query-reservation step. 001.1 membership is allowed to differ. Retained companies keep `contractor:{same uuid}`.

The eligible *universe* still comes from the 001 occupation-code slices (not a query-targeted sample of 200). Slices use equality filters because catalog-wide `COUNT(DISTINCT)` and wide OR predicates exceed statement timeout.

## Query readiness is observational

Report **pilot matches** and **full eligible-slice matches** separately.

A zero in the 200-entity pilot is acceptable. Do not add members because a query is empty.

City vs county precision:

- `exact_physical_city` only when the stored city matches.
- A contractor elsewhere in the same county is `exact_physical_county`, never fake exact-city or service coverage.
- `license_state` is not `physical_state`.
- No `explicit_service_*` reasons — there is no service-territory graph.

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
| 001 fingerprint | `3ae1595ea980eac1201ebb528f3aa1ec82ba227e0d990f9f293dbc200cc41ec1` |
| 001.1 fingerprint | `2b8b2d5439bf182cfb0c45bc22af7bdc3678365f4b7c724542bbcffa01dafeab` |
| 001 → 001.1 overlap / removed / added | 168 / 32 / 32 |
| Unexpected ID remaps | 0 |
| 001.1 membership/identity/content drift (two unchanged runs) | 0 |

Pilot geography (001.1 natural strata): FL 112, NJ 88. Categories: roofing 22, plumbing 44, HVAC 45, electrical 22, general_contractor 45, pool 22.

Observational query counts (pilot / eligible universe):

| Query | Pilot | Eligible slice |
|---|---|---|
| roofers Miami FL | 14 | 65 |
| roofing contractors Broward County FL | 8 | 40 |
| plumbers Palm Beach County FL | 15 | 40 |
| HVAC contractors Tampa FL | 23 | 59 |
| electricians Jacksonville FL | 0 | 0 |
| general contractors Orlando FL | 23 | 57 |
| roofers Monmouth County NJ | 0 | 0 |
| plumbers Bergen County NJ | 2 | 5 |
| contractors Middlesex County NJ | 1 | 2 |
| general contractors New Jersey | 22 | 40 |
| home inspectors Miami | 0 | 0 |

External calls required: Google Places 0, LLM 0, geocoding 0, new enrichment 0.

## Frozen Florida READY policy (001.1)

Florida Ask discovery is READY only when all of:

1. Canonical public contractor company (`contractors.id` / slug, not thin)
2. Active/current mapped license observation
3. Trade is one of: `roofing`, `plumbing`, `hvac` (CAC only), `pool`, `general_contractor` (CGC only)
4. Canonical profile `https://www.contractortrusthub.com/contractors/{slug}`
5. Structured physical geography (city and/or county)
6. Requested geographic precision is supported by stored physical fields — not by inventing service area

Browse route, only for those READY trades: `/florida/{county}/{trade}`  
(`roofers`, `plumbing`, `air-conditioning`, `pool-spa`, `general-contractors`).

Do **not** manufacture browse routes for electrical, solar, painting, flooring, remodeling, or home inspector.

CBC, CRC, CMC, and Florida electrical stay out of this feed.

Machine-readable lock: `lib/network-discovery/florida-policy.ts`.

## New Jersey SOFT policy

NJ plumbing / HVAC / electrical / HIC: **SOFT** (Verify, no county browse, no statewide GC).

NJ roofing: **UNSUPPORTED**.

Future Ask ingestion should activate the **Florida bounded subset first**. NJ only under a later bounded policy.

## Readiness for Ask ingestion

The bounded Florida subset is the honest candidate for a future Ask adapter move from `soft_handoff` toward `ready`. This Hub does not change Ask in this task and does not import the feed.

Unsupported Ask trades stay fail-closed.
