# DRAFT — NOT FILED — PCCLB contractor credential extract

**Status: READY. Prompt 2 portal attempt 2026-08-26: GovQA CONTRACTOR LICENSING `rqst=67` requires CREATE ANONYMOUS ACCOUNT. Not filed. No account/password created.**

**Agency:** Pinellas County Construction Licensing Board / Contractor Licensing Department.  
440 Court Street, Clearwater. pcclb@pinellas.gov / (727) 582-3100.  
Search: https://contractorsearch.pcclb.com/  
Accela PCCLB: https://aca-prod.accela.com/pinellas/

Pinellas County public records: follow current pinellas.gov public-records route for Contractor Licensing / PCCLB.

## Universe

Existing electronic records of **locally certified (C-)**, **journeyman (J-)**, and any remaining **state-registered (I-)** credentials, plus insurance/bond certificates on file.

We understand **state-certified** contractors currently may **not** be required to register with PCCLB. Do not invent enrollment rows. If the system stores optional registrations, include them labeled as such.

## Preferred fields

local license number; class; person; firm; qualifier; **raw** status; issue/renewal/expiration; full DBPR number if stored; insurance/WC/bond amounts and expirations; addresses; phones; emails; last update.

Include inactive, expired, revoked, and historical classes.

$25 estimate-before-work gate. Native CSV/XLSX/DB export. Data dictionary / class list if already maintained.

**Exclude:** exam content, SSN, DL images, payments.
