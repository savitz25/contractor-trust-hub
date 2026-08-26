# Miami-Dade permitting jurisdictions (Prompt 1 — proposed, not seeded)

**Official denominator:** Miami-Dade County lists **34 incorporated municipalities** plus unincorporated areas ([County Municipalities page](https://www.miamidade.gov/global/management/municipalities.page), retrieved 2026-08-26).

**Mapped AHJs: 35** = 1 unincorporated/county + 34 municipalities.

Islandia (incorporated 1960) was **abolished 2012** (Ordinance 12-14) and reverted to unincorporated. It is **not** an AHJ.

**County permit system is not countywide.** RER Building Division issues building permits for **unincorporated Miami-Dade only** (folio prefix `30`). Each of the 34 municipalities has its own building official ([County Municipal Approval](https://www.miamidade.gov/global/economy/building/county-municipal-approval.page)). County “M” process numbers are **associated county reviews** (DERM, WASD, impact fees, Fire, DOH), not a municipal building-permit warehouse.

E-municipal electronic routing to the County is documented for **Bal Harbour, City of Miami, and Miami Lakes** only. That is submittal routing, not complete municipal history.

## Unincorporated / county AHJ

| Field | Value |
| --- | --- |
| county_slug | `miami-dade` |
| jurisdiction_slug | `unincorporated` |
| kind | `unincorporated` |
| permitting_authority | Miami-Dade RER — Building Division |
| agency | Department of Regulatory and Economic Resources |
| public_search_url | https://www.miamidade.gov/permits/online-services.asp |
| vendor | County EPS / e-permitting + GIS Open Data (not EnerGov building COC) |
| coverage_type | unincorporated (folio `30`) |
| expected_permit_authority | RER Building |
| data_availability | `open_data_partial` (issued permits, ~2 prior years to present on Open Data Hub) |
| notes | Open Data “Building Permits Issued By Miami-Dade County” is county-issued, not 34-city history. EnerGov CSS is used for **consumer-protection business licenses**, not as the countywide building-permit warehouse. |

## Incorporated municipalities (34)

Official list (incorporation date from County page):

1. Miami (1896)
2. Homestead (1913)
3. Florida City (1914)
4. Miami Beach (1915)
5. Coral Gables (1925)
6. Hialeah (1925)
7. North Miami (1926)
8. Opa-locka (1926)
9. Miami Springs (1926)
10. South Miami (1927)
11. Golden Beach (1929)
12. North Miami Beach (1931)
13. Miami Shores (1932)
14. Biscayne Park (1933)
15. Surfside (1935)
16. El Portal (1937)
17. Indian Creek Village (1939)
18. Sweetwater (1941)
19. North Bay Village (1945)
20. West Miami (1947)
21. Bay Harbor Islands (1947)
22. Bal Harbour (1947)
23. Virginia Gardens (1947)
24. Hialeah Gardens (1948)
25. Medley (1949)
26. Key Biscayne (1991)
27. Aventura (1995)
28. Pinecrest (1996)
29. Sunny Isles Beach (1997)
30. Miami Lakes (2000)
31. Palmetto Bay (2002)
32. Miami Gardens (2003)
33. Doral (2003)
34. Cutler Bay (2005)

Each municipal row in the proposed seed: `kind=municipal`, `coverage_type=municipal`, `data_availability=none` unless a **city** open dataset is later proven (City of Miami Building Permits open data since 2014 is **City of Miami AHJ only**).

Known municipal systems (not county coverage; vendor notes for Prompt 2 portal harvest):

| Municipality | Portal / notes |
| --- | --- |
| City of Miami | Own building department; open GIS building-permits dataset since 2014 |
| Miami Beach | City permit search dashboard |
| Coral Gables | City e-permits |
| Aventura | eTRAKiT |
| Bal Harbour / Miami / Miami Lakes | County e-municipal routing for **county** associated reviews |

Do not treat GIS “Buildings” layers as contractor permit events.
