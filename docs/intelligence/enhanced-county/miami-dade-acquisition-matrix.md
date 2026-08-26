# Miami-Dade acquisition matrix (Prompt 1)

| Agency | Dataset | Value | Entity | Coverage | Access | IDs | DBPR link | Contacts | PRA? | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RER GIS / Open Data Hub | Building permits issued (2 prior years–present) | VERY HIGH | permit | County-issued (folio 30 unincorporated **plus** `M`/MBLD associated reviews). REST **139,586** rows 2026-08-26 | DIRECT FeatureServer / extract | permit #, process #, folio | mixed `ContractorNumber` (DBPR **and** county COC) | `ContractorPhone` + address | No for rolling issued window | **P0** |
| RER Building | Full permit history + raw status + open/unfinaled | VERY HIGH | permit | Unincorporated (folio 30) + same-system associated reviews | Portal search; bulk unknown | permit, process #, contractor | possible | possible | **Yes** (history / status / open not in 2-year issued table) | **P0** |
| RER Contractor Licensing / CTQB | Certificate of Competency / eligibility roster | VERY HIGH | local_credential | Countywide Chapter 10 (not municipal BTR) | Search-only BCCO | COC #, company, qualifier, status | unconfirmed in UI | address/phone possible | **Yes** | **P0** |
| RER Contractor Enforcement | Contractor complaints + dispositions | HIGH if final orders keyed | observation | County contractor/unlicensed cases | Search-only | complaint #, license # | if license stored | no | **Yes** | **P1** |
| RER | Voluntary FL certified contractor verification | HIGH | STATE_ENROLLED | **Unincorporated permits only** | Form/email, not a public dump | DBPR + insurance | explicit | insurance docs | **Yes** (if electronic file exists) | **P1** |
| City of Miami GIS | Building permits since 2014 | HIGH for that AHJ | permit | City of Miami only | DIRECT open data | city permit fields | unknown | maybe | No | **P1** |
| Other 33 cities | Municipal permits | HIGH per AHJ, not county | permit | Municipal | portals vary | local | weak | weak | Later / city-by-city | **P2** |
| Clerk | Civil cases | LOW | lawsuit | County courts | search | party name | name-only | n/a | No bulk planned | **SKIP** |
| Code / 311 / unsafe structures | Property cases | LOW unless contractor ID | property | Unincorporated / county | search | address | none | n/a | No | **SKIP** (unless ID) |
| EnerGov CSS | Consumer Protection **business** licenses | MEDIUM, wrong universe for CILB/COC | local business license | County consumer protection | portal | license | weak | yes | No as CILB substitute | **SKIP** for contractor COC |
| Google Places | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | **SKIP** |
