# Public-record request log

Anonymous electronic filing was **tested** against the live official forms. No request was filed with a fabricated sender.

| ID | County | Department | Title | Channel | Submitted | Request ID | Timestamp | Fee | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PRR-BROWARD-PERMITS-001 | Broward | Permitting and Licensing / Building Code | Existing electronic building-permit metadata extract | GovQA RequestSelect | **NO** | — | 2026-08-26 | none | **PORTAL_ACCOUNT_REQUIRED** |
| PRR-BROWARD-CERTS-001 | Broward | Permitting and Licensing / Building Code / CEB | Existing electronic contractor certification extract | GovQA RequestSelect | **NO** | — | 2026-08-26 | none | **PORTAL_ACCOUNT_REQUIRED** |
| PRR-PBC-PERMITS-001 | Palm Beach | PZB Building Records | County-system permit metadata extract | https://pbc.gov/eprr/pzb | **NO** | — | 2026-08-26 | none | **DELIVERY_CONTACT_REQUIRED** |
| PRR-PBC-CERTS-001 | Palm Beach | PZB Contractor Regulations | Certification / enrollment / installer extract | https://pbc.gov/eprr/pzb | **NO** | — | 2026-08-26 | none | **DELIVERY_CONTACT_REQUIRED** |

## Precise minimum contact (tested)

**Palm Beach ePRR:** Anonymous checkbox exists and clears name/address. If “How would you like to receive your documents?” = **Email**, the form **adds a required Email Address rule**. Pickup-in-person adds a **required phone**. US Mail **disables Anonymous** and requires a mailing address.  
→ **Anonymous electronic submission requires a delivery contact** (email for electronic delivery, or phone for pickup). Not “Trust Hub identity required.”

**Broward GovQA:** County PRR page states you can submit anonymously. The live portal also exposes **Login**, **My Request Center**, and **Search by Reference Number**. Category **Permitting and Licensing** includes Building Code. The category **Select** postback did not open a completable anonymous request form in this automated session.  
→ **Electronic GovQA path did not complete without an account/login in this environment.** Lawful alternatives: phone / written / in-person to Building Code (954-765-4400) without a name. Portal retrieval later uses a **reference number**.

JSON twin: `public-record-request-log.json`.
