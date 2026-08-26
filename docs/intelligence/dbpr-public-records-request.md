# DBPR public-records request — Construction related-license / qualifier graph

**Status:** Draft — prepared, not submitted.  
**Authority:** Chapter 119, Florida Statutes; DBPR public-records obligation as stated at  
https://www2.myfloridalicense.com/public-records-read-medisclaimer/  
**Requester:** Contractor Trust Hub / Trust Hub Network (research use of public records).  
**Agency contact path:** DBPR Customer Contact Center, 2601 Blair Stone Road, Tallahassee FL 32399  
Phone (850) 487-1395 · https://www2.myfloridalicense.com/contact-us/

## What we already receive for free

DBPR already publishes, without a request:

- `CONSTRUCTIONLICENSE_1.csv` — licensee extract (board, occupation, name, DBA, address, county, license number, status, dates). **No `licid`. No related-license / qualifying-agent columns.**
- Construction applicants, CE provider lists, and FY discipline CSVs.
- Interactive Verify-a-Licensee search and Related License Information pages keyed by numeric `licid`.

## What is missing

A machine-readable extract of **Construction Business Information (license type 0627)** records joined to **Related License Information** rows (Primary / Secondary Qualifying Agent for Business, Financially Responsible Officer, and any other regulator-defined relationship types), including:

| Field | Why |
| --- | --- |
| Numeric portal `licid` (LicenseDetail hidden ID) | Stable DBPR business-record key |
| Construction Business Information hash/detail ID | Portal deep link |
| Business legal name, address, county, primary status | Identity |
| Related full license number (e.g. `CCC1336585`, never numeric core alone) | Credential node |
| Related party name as published | Holder label; not a person id |
| Relationship type **exactly as stored** | Primary vs Secondary vs FRO |
| Relation effective date | Time-aware graph |
| Relation end date **if maintained** | Do not invent; omit if not stored |
| Related license status / rank / expiration | Current vs historical |

## Request text (ready to send)

> Pursuant to Chapter 119, Florida Statutes, I request an electronic copy of the Construction Industry Licensing Board records that populate the public “Related License Information” / `licenseRelation.asp?licid=` view, together with the Construction Business Information (license type 0627 / occupation rank “Business Info”) records those pages describe.
>
> Preferred format: the format in which DBPR already maintains the data (delimited text, CSV, or database extract). DBPR is not asked to create a new report format beyond the fields it already stores and already displays to the public.
>
> Please include, if they exist in the system of record:
>
> 1. The internal numeric license/record identifier (`licid`) used by `licenseRelation.asp`.
> 2. Construction Business Information records (legal name, address, county, status, original/effective dates).
> 3. Related-license rows: related full license number, related party name, relationship type, relation effective date, relation end date if stored, related license status, rank, expiration.
> 4. A data dictionary or code list for relationship types (Primary Qualifying Agent for Business, Second/Secondary Qualifying Agent for Business, Financially Responsible Officer, and any others).
> 5. Current and historical / inactive related-license rows that the public historic search would display.
>
> I do not request exempt personal information beyond what DBPR already publishes on the public portal (for example, I am not requesting non-public email addresses if they are kept only for official correspondence under s. 455.275, F.S.).
>
> If a single extract is not maintained, please confirm that fact in writing and identify the public inspection path for these records.
>
> If any portion is exempt, please produce the remainder and cite the exemption.

## Why this is the preferred path

Interactive portal acquisition is technically reproducible (org name → LicenseType 0627 → LicenseDetail hidden `licid` → `licenseRelation.asp`) but is **not** an official bulk file. A statewide run of unique business names is a multi-day polite crawl. A Chapter 119 extract would be:

- complete (including relationship types not yet observed in samples),
- historically fuller if the system of record retains ended relationships,
- free of portal pagination / name-search ambiguity.

## Submit via

1. https://www2.myfloridalicense.com/contact-us/  
2. Mail: Public Records, Department of Business and Professional Regulation, 2601 Blair Stone Road, Tallahassee, FL 32399  
3. Customer Contact Center: (850) 487-1395

Do not treat a non-response as permission to bypass rate limits or CAPTCHA.
