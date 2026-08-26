# Pinellas permitting jurisdictions (Prompt 1 — proposed, not seeded)

**Official denominator:** Pinellas County states it has **24 incorporated municipalities** ([Municipalities and Cities](https://pinellas.gov/municipalities-and-cities/), retrieved 2026-08-26). GIS `Pinellas_MunicipalBoundary` is 24 municipalities + unincorporated.

**Mapped AHJs: 25** = 1 unincorporated/county + 24 municipalities.

**County permit system is not countywide.** Pinellas County Building and Development Review Services (BDRS) issues permits for **unincorporated Pinellas County** and a **named partner-city list**, currently:

- Belleair Beach
- Belleair Shore
- Indian Rocks Beach
- Kenneth City
- Oldsmar
- Safety Harbor

([Building Departments in Pinellas County](https://pinellas.gov/building-departments-in-pinellas-county/), retrieved 2026-08-26; [Building Services](https://pinellas.gov/building-services).)

**Belleair Bluffs:** BDRS stopped serving as building official **2025-08-15/16**. Open/active permits stay with the County through final; **new** permits go to **SAFEbuilt**. Historical Accela rows remain county-held; do not mix as one continuous municipal warehouse without a coverage_end.

**Redington Beach:** building department services administered by **Town of Redington Shores** Building Department (official county directory footnote).

Portal for county/partner permits: Pinellas County Access Portal — Accela  
https://aca-prod.accela.com/pinellas/

PCCLB licensing is **countywide including all municipalities** (special district). That is **credential** coverage, not permit coverage.

## Unincorporated / county AHJ

| Field | Value |
| --- | --- |
| county_slug | `pinellas` |
| jurisdiction_slug | `unincorporated` |
| kind | `unincorporated` |
| permitting_authority | Pinellas County Building and Development Review Services |
| public_search_url | https://aca-prod.accela.com/pinellas/ |
| vendor | Accela Citizen Access |
| coverage_type | unincorporated + documented partner cities (see notes) |
| data_availability | `pra_recommended` |
| notes | Accela holds unincorporated + current partner-city permits. St. Petersburg, Clearwater, Largo, etc. are **not** in this warehouse. |

## Incorporated municipalities (24)

Official county list:

1. Belleair
2. Belleair Beach (BDRS partner)
3. Belleair Bluffs (SAFEbuilt from 2025-08-15; prior BDRS)
4. Belleair Shore (BDRS partner)
5. Clearwater
6. Dunedin
7. Gulfport
8. Indian Rocks Beach (BDRS partner)
9. Indian Shores
10. Kenneth City (BDRS partner; zoning local)
11. Largo
12. Madeira Beach
13. North Redington Beach
14. Oldsmar (BDRS partner)
15. Pinellas Park
16. Redington Beach (services via Redington Shores)
17. Redington Shores
18. Safety Harbor (BDRS partner)
19. St. Pete Beach
20. St. Petersburg
21. Seminole
22. South Pasadena
23. Tarpon Springs
24. Treasure Island

Partner cities still get their own `kind=municipal` seed row so the denominator is 25 AHJs. `expected_permit_authority` notes whether BDRS Accela currently administers them.
