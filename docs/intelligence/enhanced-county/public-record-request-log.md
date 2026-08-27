# Public-record request log

Every request record includes: county, request type, request ID, submission timestamp, department, anonymous YES/NO, delivery contact type, acknowledgment, fee, status, notes.

Do not store passwords or sensitive portal credentials.

| ID | County | Request type | Request ID | Submission timestamp | Department | Anonymous | Delivery contact type | Acknowledgment | Fee | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PRR-PBC-PERMITS-001 | Palm Beach | existing electronic permit metadata extract | **REQ-2026-09008** | 2026-08-26 | Planning Zoning & Building / Building Records | **YES** | Email | Request Created; placed in BCC public records database; email confirmation sent; Open | none yet | **SUBMITTED_ANONYMOUS (Open)** |
| PRR-PBC-CERTS-001 | Palm Beach | existing electronic certification/enrollment extract | **REQ-2026-09009** | 2026-08-26 | Planning Zoning & Building / Contractor Regulations | **YES** | Email | Request Created; placed in BCC public records database; email confirmation sent; Open | none yet | **SUBMITTED_ANONYMOUS (Open)** |
| PRR-BROWARD-PERMITS-001 | Broward | existing electronic permit metadata extract | **R002812-082626** | 2026-08-26 | Building Code Division | **YES** | portal reference tracking (email requested in body: hello@asktrusthub.com) | Received 2026-08-26; track via Search by Reference Number | none yet | **SUBMITTED_ANONYMOUS (received)** |
| PRR-BROWARD-CERTS-001 | Broward | existing electronic certification extract | **R002813-082626** | 2026-08-26 | Building Code Division | **YES** | portal reference tracking (email requested in body: hello@asktrusthub.com) | Received 2026-08-26; track via Search by Reference Number | none yet | **SUBMITTED_ANONYMOUS (received)** |

---

## PRR-PBC-PERMITS-001

- **county:** Palm Beach
- **request type:** existing electronic permit metadata extract
- **request ID:** REQ-2026-09008
- **submission timestamp:** 2026-08-26 (portal RequestDate 08/26/2026)
- **department:** Planning Zoning & Building / Building Records
- **anonymous:** YES
- **delivery contact type:** Email (`hello@asktrusthub.com` — project public contact only)
- **acknowledgment:** Request Created. Thank you for submitting your request to Palm Beach County. This message confirms it has been placed into the public records database for the Board of County Commissioners. Portal status Open. Toast: “The email confirmation was send successfully.”
- **fee:** none yet
- **status:** SUBMITTED_ANONYMOUS (Open)
- **notes:** Filed via https://pbc.gov/eprr/pzb. Anonymous checkbox used. Portal still requires Email when receive=Email. No personal name invented. $25 cost gate included in the request text. No agency fee quote received. Internal portal RequestId 96177 is not a credential and is not a password.

## PRR-PBC-CERTS-001

- **county:** Palm Beach
- **request type:** existing electronic certification/enrollment extract
- **request ID:** REQ-2026-09009
- **submission timestamp:** 2026-08-26 (portal RequestDate 08/26/2026)
- **department:** Planning Zoning & Building / Contractor Regulations
- **anonymous:** YES
- **delivery contact type:** Email (`hello@asktrusthub.com` — project public contact only)
- **acknowledgment:** Request Created. Thank you for submitting your request to Palm Beach County. This message confirms it has been placed into the public records database for the Board of County Commissioners. Portal status Open. Toast: “The email confirmation was send successfully.”
- **fee:** none yet
- **status:** SUBMITTED_ANONYMOUS (Open)
- **notes:** Filed via https://pbc.gov/eprr/pzb. Same anonymous + project-email pattern as the permit request. $25 cost gate included. No agency fee quote received. Internal portal RequestId 96178 is not a credential.

## PRR-BROWARD-PERMITS-001

- **county:** Broward
- **request type:** existing electronic permit metadata extract
- **request ID:** R002812-082626
- **submission timestamp:** 2026-08-26
- **department:** Building Code Division (GovQA category Permitting and Licensing)
- **anonymous:** YES
- **delivery contact type:** portal reference tracking; request body asked electronic delivery to hello@asktrusthub.com
- **acknowledgment:** Thank you for your interest in public records of Broward County. Your request has been received in this office on August 26, 2026 and given the reference number R002812-082626 for tracking purposes. It is your responsibility to keep your reference number and check the “Search by Reference Number” section. Records Agency: Building Code Division. You will be notified of any costs in advance.
- **fee:** none yet
- **status:** SUBMITTED_ANONYMOUS (received)
- **notes:** Filed 2026-08-26 via GovQA RequestOpen Submit Anonymously (category Permitting and Licensing → agency Building Code Division). Portal login password was not present in this environment and was not stored. No false requester role. $25 estimate-before-work gate included. No files returned immediately. Track at Search by Reference Number. Package: docs/intelligence/enhanced-county/pra-broward-permits.md

## PRR-BROWARD-CERTS-001

- **county:** Broward
- **request type:** existing electronic certification extract
- **request ID:** R002813-082626
- **submission timestamp:** 2026-08-26
- **department:** Building Code Division (GovQA category Permitting and Licensing; CEB/contractor licensing is under this agency)
- **anonymous:** YES
- **delivery contact type:** portal reference tracking; request body asked electronic delivery to hello@asktrusthub.com
- **acknowledgment:** Thank you for your interest in public records of Broward County. Your request has been received in this office on August 26, 2026 and given the reference number R002813-082626 for tracking purposes. Records Agency: Building Code Division. You will be notified of any costs in advance.
- **fee:** none yet
- **status:** SUBMITTED_ANONYMOUS (received)
- **notes:** Filed 2026-08-26 via GovQA RequestOpen Submit Anonymously, same category/agency as the permit request. No CEB-specific agency row exists in the portal; Building Code Division description covers contractor permitting and licensing. No password stored. $25 gate included. No files returned immediately. Package: docs/intelligence/enhanced-county/pra-broward-certification.md

JSON: `public-record-request-log.json`.

---

## Miami-Dade + Pinellas — DRAFT, NOT FILED (Prompt 1)

Prompt 2 attempted GovQA filing 2026-08-26. **Not filed.** Miami-Dade anonymous form filled; portal returned “The submitted CAPTCHA code is incorrect.” Pinellas requires CREATE ANONYMOUS ACCOUNT before the request form; no account was created.

| ID | County | Request type | Request ID | Submission timestamp | Department | Anonymous | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PRR-MDC-PERMITS-001 | Miami-Dade | existing electronic permit metadata extract (history/status beyond Open Data issued window) | none | not submitted | RER (GovQA rqst=9) | YES attempted | **PORTAL_REACHED_CAPTCHA_BLOCKED** |
| PRR-MDC-CONTRACTORS-001 | Miami-Dade | CTQB / Certificate of Competency extract | none | not submitted | RER (GovQA rqst=9) | YES attempted | **PORTAL_REACHED_CAPTCHA_BLOCKED** |
| PRR-MDC-ENFORCEMENT-001 | Miami-Dade | contractor complaints / board dispositions | none | not submitted | RER (GovQA rqst=9) | YES attempted | **PORTAL_REACHED_CAPTCHA_BLOCKED** |
| PRR-PIN-CONTRACTORS-001 | Pinellas | PCCLB C-/J-/(I-) credential extract | none | not submitted | CONTRACTOR LICENSING (rqst=67) | YES attempted | **PORTAL_ANON_ACCOUNT_REQUIRED** |
| PRR-PIN-PERMITS-001 | Pinellas | Accela building permits (unincorporated + partner cities) | none | not submitted | BUILDING SERVICES (rqst=65) | YES attempted | **PORTAL_ANON_ACCOUNT_REQUIRED** |
| PRR-PIN-ENFORCEMENT-001 | Pinellas | PCCLB citations / admin fines / orders | none | not submitted | CONTRACTOR LICENSING (rqst=67) | YES attempted | **PORTAL_ANON_ACCOUNT_REQUIRED** |

Packages:

- `pra-miami-dade-permits.md`
- `pra-miami-dade-contractors.md`
- `pra-miami-dade-enforcement.md`
- `pra-pinellas-contractors.md`
- `pra-pinellas-permits.md`
- `pra-pinellas-enforcement.md`
