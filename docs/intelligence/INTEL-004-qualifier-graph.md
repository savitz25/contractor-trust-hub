# INTEL-004 — Qualifier / business graph

Schema: `schema/migrations/009_qualifier_graph.sql`  
Types: `lib/intelligence/relationship-types.ts`  
Client: `ingest/adapters/fl_dbpr_relations.py`  
Acquisition: `scripts/acquire_fl_qualifier_graph.py`  
PRA: `docs/intelligence/dbpr-public-records-request.md`

## Lookup chain (deterministic)

1. Session cookie from `GET wl11.asp?mode=1&search=Name`.
2. `POST Board=06` so LicenseType list includes **0627 Construction Business Information**.
3. Org-name search (`OrgName` + `LicenseType=0627`, historic included).
4. Unique CBI row → SPA `LicenseDetail?ID={hash}`.
5. Hidden `<input id="ID" name="ID" value="{licid}">` is the numeric portal business id.
6. `GET licenseRelation.asp?licid={licid}` → Related License Information table.

Fail closed: 0 CBI hits = unresolved; >1 CBI hits without unique address match = ambiguous (quarantine; never pick first). Classic search HTML does **not** emit `licid=`.

## Nodes (do not collapse)

1. **License holder** — `fl_dbpr:credential:{external_key}`. One node per credential. Names are not fuzzy-merged.
2. **Credential** — existing `licenses` row. Full key only (e.g. `CCC1336585`). Never numeric-core identity.
3. **DBPR business record** — `fl_dbpr:portal_licid:{licid}` after resolution. QB extract `QB-ENTITY:{sha}` is a **shell**, not a portal CBI record. Listed DBA names are not automatically distinct businesses.
4. **Sunbiz legal entity** — remains separate until INTEL-002 HIGH_CONFIDENCE / CONFIRMED resolution. Stable licid improves *candidate* generation; it does not upgrade a name match to CONFIRMED.

CBI pages disclose: **“This is a business tracking record only.”**

## Edges

| Canonical type | Source | Attribution | Means |
| --- | --- | --- | --- |
| `listed_business_name` | DBPR licensee extract DBA field | CONFIRMED **name association** | CILB: approved business entity name appears on the individual license. Not Primary/Secondary. |
| `primary_qualifying_agent` | `licenseRelation.asp` “Primary Qualifying Agent for Business” | CONFIRMED **role** | Requires portal `licid`. Portal search name-type `Primary` on a CBI row is the business’s own name class, not a QA edge. |
| `secondary_qualifying_agent` | Same page, “Second Qualifying Agent for Business” | CONFIRMED when observed | Distinct from Primary. Observed in Stage B (36 edges). |
| `financially_responsible_officer` | Related-license “Financial Officer - Business” | CONFIRMED when observed | **Not a trade qualifier.** |

Do not create a qualifier edge from shared ZIP, city, officer name, or Sunbiz alone.

## Time (`current_or_historical`)

| Value | Rule |
| --- | --- |
| `current` | Related-license status contains Current (and not inactive/void/delinquent) **and** no published relation end date. |
| `historical` | Regulator status is Null & Void / expired / inactive / closed / revoked, **or** a relation end date is published. |
| `unknown` | Status blank or unrecognized. |

`licenseRelation` provides **Relation Effective Date**. The trailing date on the same row is the related **credential expiration**, not a relationship end. `ended_on` stays NULL unless DBPR publishes a relation end. **Do not invent end dates from a missing expiration.**

## What history DBPR exposes

- Historic org search (`SearchHistoric=Yes`) can return non-current CBI rows.
- Related-license rows on a fetched page include the related credential’s current portal status.
- Sampled current CBI pages list Current/Active related licenses with effective dates and **no relation end dates**.
- Ended qualifier relationships are **not** known to be a complete official history file. Treat absence of an old qualifier as unknown, not as “never qualified.”

## Adverse history

John qualifies ABC and XYZ. Discipline on ABC is **not** discipline on XYZ. Adverse history does not inherit across qualifier edges. Tests: `ADVERSE_HISTORY_DOES_NOT_INHERIT_ACROSS_QUALIFIER_EDGES`.

## Contacts

Sampled CBI LicenseDetail pages publish Main Address and County only. Phone and email are not on that page. The footer (850) 487-1395 / contact-us is the **agency** contact center, not a licensee contact.
