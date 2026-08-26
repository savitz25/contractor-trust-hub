# Miami-Dade official source map (Prompt 1)

Agency of record for **local contractor credentials:** Miami-Dade Department of Regulatory and Economic Resources (RER) — Board and Code Administration / **Contractor Licensing Section**, Construction Trades Qualifying Board (CTQB), Chapter 10 of the County Code.

Do not confuse:

| System | What it is |
| --- | --- |
| BCCO Contractor Inquiry | Certificate of Competency holders + complaint flags (search) |
| E-Licensing renewal (CLRA) | COC/eligibility **renewal** app |
| EnerGov CSS | **Consumer Protection** business/professional licenses (not the COC warehouse) |
| EPS / e-permitting / Building Menu | **Unincorporated** building permits |
| Open Data Hub permits | County-**issued** permits (~2 prior years–present; 140,132 rows as of dataset page) |
| City of Miami open permits | **City of Miami AHJ only** (since 2014) |

## A. Contractor licensing / certification

**Authoritative:** CTQB + Contractor Licensing Section. Chapter 10 requires a current certificate of competency **or** eligibility from (1) Florida CILB, (2) Florida ECLB, or (3) County CTQB. County certificate holders must also be **state-registered** (F.S. 489.115 / 489.513).

Classes documented on official pages:

- Certificate of Competency (contractor)
- Certificate of eligibility
- Journeyman COC (not a contractor; work under a master)
- Master COC
- Authorized Employee COC (county/municipal employees only)
- Maintenance categories
- **Voluntary registration / verification of Florida certified contractors** for **unincorporated** permitting (insurance + WC + DL). Explicitly: “This verification is only valid in unincorporated Miami Dade County.”
- Reciprocity with Broward / Palm Beach licensing agencies (County 2026 licensing notice)
- **55+ local license types** (exam and non-exam) in plumbing, electrical, mechanical, building (County 2026-07-01 notice)

**Preemption:** County Board and Code page states Florida bills preempt local specialty occupational licenses (local occupational licensing sunset; specialty classes corresponding to F.S. 489.105(3) remain the legal core). Treat non-489.105 specialties as **PREEMPTED_CLASS / HISTORICAL_LOCAL_LICENSE** until a live CTQB class list in an extract proves current issuance.

**Access:** search-only BCCO; no public bulk COC CSV found. **PRA required** for machine-readable roster.

**Identifiers likely:** county license/COC number, company, qualifier, status, complaints-if-any. DBPR number **not confirmed in public search UI** — request in PRA.

**Contacts (public, contractor-attributed only):**

| Source | Fields |
| --- | --- |
| Open Data issued permits | `ContractorPhone`, `ContractorAddress`, `ContractorCity`, `ContractorState`, `ContractorZip` (permit-record currentness; agency 786-315-2880 / 305-375-2877 are **not** contractor phones) |
| BCCO COC search | address/phone **possible** on a record; not confirmed as a bulk dump |
| EnerGov CSS | consumer-protection business contacts — **wrong universe** for CILB/COC |
| Google Places | SKIP |

## B. Permits

**Unincorporated:** RER Building. Folio prefix `30`. Search + EPS + e-permitting.

**Strongest immediate source (DIRECT):** Open Data Hub table [Building Permits Issued By Miami-Dade County — 2 Previous Years to Present](https://opendata.miamidade.gov/datasets/6db5f56e886446df88313ca279e59120)  
ArcGIS FeatureServer: `https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/miamidade_permit_data/FeatureServer/0`  
REST count **2026-08-26: 139,586** rows (Hub page has listed ~140k). Rolling **issued** window (~2 prior years–present). Capabilities: Query, Extract, Sync. Max page 1,000.

This is **county-issued**, not 34-city history. Rows include unincorporated building permits **and** County Municipal Approval / associated county reviews (`M` process numbers, `MBLD` type). Filter before treating a row as unincorporated activity:

- Folio prefix `30` → unincorporated property
- ProcessNumber prefix `M` / PermitType `MBLD` → associated county review, not a municipal building-permit warehouse

**Official fields (layer schema 2026-08-26):**  
`PermitIssuedDate`, `ApplicationDate`, `PermitNumber`, `ProcessNumber`, `MasterPermitNumber`, `PermitType`, `ResidentialCommercial`, `EstimatedValue`, `ApplicationTypeCode`, `ApplicationTypeDescription`, `ProposedUseCode`, `ProposedUseDescription`, `DetailDescriptionComments`, `FolioNumber`, `OwnerName`, `LegalDescription1`, `LegalDescription2`, `PropertyAddress`, `ArchitectName`, **`ContractorNumber`**, **`ContractorName`**, **`ContractorAddress`**, **`ContractorCity`**, **`ContractorState`**, **`ContractorZip`**, **`ContractorPhone`**, `SquareFootage`, `StructureUnits`, `StructureFloors`, `Category1`–`Category10` + descriptions, `LastInspectionDate`, `LastApprovedInspDate`, `CoCcDate`, `PermitTotalFee`, `City`, `State`, `ObjectId`, `GlobalID`.

No dedicated raw permit-status field — universe is **issued**. Missing expiration/final except inspection/CO-CC dates. `EstimatedValue` is a string; never coerce blank/zero to revenue.

**Identity quality:** `ContractorNumber` is a **mixed namespace** (DBPR `CGC`/`CCC`/`EC`/…, county COC such as `19B000138` / `11P000450`, blank for `OWNER`). Name+number can be CONFIRMED/HIGH_CONFIDENCE **after** namespace classification. Name-only / OWNER = UNRESOLVED.

**Municipal:** 34 independent building officials. County Municipal Approval (`M` numbers) = associated county reviews, not municipal permit history.

**PRA still justified** for history outside the rolling 2-year issued table, open/unfinaled regardless of issue date, and raw status codes.

## C. Discipline / enforcement

Contractor Licensing **and** Contractor Enforcement Section investigates complaints against Miami-Dade contractors **and** unlicensed contractors ([Board and Code](https://www.miamidade.gov/global/economy/board-and-code/home.page)).

BCCO Complaint Search: complaint number or contractor license / company. **Complaint ≠ finding.**

§10-14: grounds for discipline, penalties, enforcement. Disciplinary Action Reports referenced on Board and Code page.

Building Support / Code Enforcement Online System = **property/code cases** in unincorporated or county regulatory jurisdiction — attach to a contractor **only** with a deterministic contractor ID.

No public bulk discipline CSV found. **PRA** for structured cases with dispositions.

## D. Consumer complaints

Structured **contractor** complaints sit with Contractor Licensing/Enforcement (BCCO), not a generic 311 dump. 311/code cases are LOW unless contractor-identified.

## E. Civil / courts

Miami-Dade Clerk has public court search. **No bulk contractor-keyed extract identified.** Name-only lawsuit matches = UNRESOLVED. **SKIP** as public profile evidence.

## F. Other

- Unsafe Structures Board (BCAD support) — property-first; contractor link only if named with ID
- Suspended vendors / debarment — not verified as a contractor-keyed bulk file this prompt
- Product Approval — not contractor identity
