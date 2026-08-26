# Public-record request draft — Broward County building permits

**Status: DRAFT ONLY. Do not submit unless authorized.**

**To:** Broward County Building Code Division / Records  
2307 W. Broward Boulevard, Suite 300, Fort Lauderdale, FL 33312  
954-765-4400

**Re:** Chapter 119 request for existing electronic permit extracts (machine-readable)

Please provide **existing** electronic exports from the underlying permitting database(s) used by Building Code Services / BCS / ePermits. Native **CSV, TSV, XLSX, or database extract** is preferred. Do not create new analysis or PDF printouts of individual records if an extract already exists.

## Jurisdiction (required)

Please identify, for each file, whether rows are:

- Broward Municipal Services District / unincorporated Broward
- County-issued permits for contract cities (list each city)
- Associated county development/environmental/asbestos approvals
- Elevator permits (countywide vs other)
- Any other jurisdiction

Do **not** mix municipal building permits issued by Fort Lauderdale, Hollywood, Pembroke Pines, or other city building departments into a file labeled “Broward County permits” unless those rows are actually county-issued.

## Date window

- All permits with `issue_date` (or equivalent) on or after **2023-01-01**, **and**
- All currently open / unfinaled / active permits regardless of original issue date.

If a five-year or full-history extract is equally practical, prefer the broader period.

## Requested existing fields (as stored)

permit number; jurisdiction / municipality / AHJ; property address; parcel/folio; contractor name; contractor license number (full, including occupation prefix); contractor system ID / CC number; permit type; work description; application date; issue date; expiration date; final/close date; permit status (raw); declared/job valuation; fees if stored; inspection status if stored on the permit; source/update timestamp.

If inspection rows exist as a child table, include them as a related extract: permit number, inspection type, date, result, reinspection flag, failure/correction text if public.

## Format

CSV/XLSX/JSON with a data dictionary of existing field names. No new derived scores.

Contact for electronic delivery: [to be filled when authorized].
