# DRAFT — NOT FILED — Miami-Dade RER unincorporated building permits

**Status: DRAFT. Do not submit in Prompt 1.**

**Agency / route:** Miami-Dade County Department of Regulatory and Economic Resources — Building Division / Building Records.  
Public records: https://www.miamidade.gov/global/publicrecords/search.page  
Building permit search (existing self-serve, not a substitute for bulk): https://www.miamidade.gov/permits/online-services.asp

## Cost-control

Existing native electronic/machine-readable export only. No new analysis or programming if an existing extract satisfies. Preferred: CSV / XLSX / DB export / JSON. PDF fallback.

If fees would exceed **$25**, send an itemized estimate **before** chargeable work.

Include any existing data dictionary / raw status codes. Do not create new documentation.

## Hard jurisdiction

**Unincorporated Miami-Dade County building permits** (folio prefix `30`) and any other jurisdictions **actually administered in the same RER Building system**.

This is **not** “all Miami-Dade permits” and **not** the 34 municipal building departments unless RER confirms those rows are in the County system.

County Municipal Approval (`M` process numbers) may be included **only if labeled** as associated county reviews, not as municipal building permits.

**Do not send plan/drawing image scans** in this request.

**Time range:** 2019-01-01 through current, **plus** all currently open/unfinaled permits regardless of issue date, if existing export allows.

We are aware of the Open Data Hub table “Building Permits Issued By Miami-Dade County — 2 Previous Years to Present.” This request seeks **existing fields and history not in that public table**, or a fuller date range if already exportable.

## Preferred existing fields

permit number; process/source record ID; jurisdiction; folio/parcel; site address; permit type/subtype; description; contractor name; company; full DBPR license; county COC/registration ID; qualifier; applicant; application/issue/expiration/final dates; **raw** status; valuation (leave blank if missing — do not emit 0); owner-builder flag; last update; inspection metadata (not photos).

**Exclude:** plans, SSN, DOB, DL images, payments, private credentials.

**Identity:** anonymous/open if portal allows; delivery hello@asktrusthub.com; no invented personal name.
