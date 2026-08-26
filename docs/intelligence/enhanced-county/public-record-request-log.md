# Public-record request log

Every request record includes: county, request type, request ID, submission timestamp, department, anonymous YES/NO, delivery contact type, acknowledgment, fee, status, notes.

Do not store passwords or sensitive portal credentials.

| ID | County | Request type | Request ID | Submission timestamp | Department | Anonymous | Delivery contact type | Acknowledgment | Fee | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PRR-PBC-PERMITS-001 | Palm Beach | existing electronic permit metadata extract | **REQ-2026-09008** | 2026-08-26 | Planning Zoning & Building / Building Records | **YES** | Email | Request Created; placed in BCC public records database; email confirmation sent; Open | none yet | **SUBMITTED_ANONYMOUS (Open)** |
| PRR-PBC-CERTS-001 | Palm Beach | existing electronic certification/enrollment extract | **REQ-2026-09009** | 2026-08-26 | Planning Zoning & Building / Contractor Regulations | **YES** | Email | Request Created; placed in BCC public records database; email confirmation sent; Open | none yet | **SUBMITTED_ANONYMOUS (Open)** |
| PRR-BROWARD-PERMITS-001 | Broward | existing electronic permit metadata extract | none | none — not accepted | Permitting and Licensing / Building Code Division | **NO** | none — portal account required | none — GovQA Create Account required | none | **PORTAL_ACCOUNT_REQUIRED** |
| PRR-BROWARD-CERTS-001 | Broward | existing electronic certification extract | none | none — not accepted | Permitting and Licensing / Building Code / CEB | **NO** | none — portal account required | none — GovQA Create Account required | none | **PORTAL_ACCOUNT_REQUIRED** |

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
- **request ID:** none
- **submission timestamp:** none — request was not accepted
- **department:** Permitting and Licensing / Building Code Division
- **anonymous:** NO
- **delivery contact type:** none — portal account required before delivery can be selected
- **acknowledgment:** none — request not accepted by GovQA without Create Account
- **fee:** none
- **status:** PORTAL_ACCOUNT_REQUIRED
- **notes:** Attempted 2026-08-26 at GovQA RequestSelect / Login. “If this is your first online request, please create an account… Email Address* Password*.” Category Select does not open a guest form. Did not create or store a GovQA password. Did not use a personal mailbox. Did not invent a requester identity. Lawful non-portal alternatives remain: phone/written/in-person to Building Code (954-765-4400); Building records email `ELBPDRecordRequests@broward.org` if a human files from the project mailbox.

## PRR-BROWARD-CERTS-001

- **county:** Broward
- **request type:** existing electronic certification extract
- **request ID:** none
- **submission timestamp:** none — request was not accepted
- **department:** Permitting and Licensing / Building Code / CEB
- **anonymous:** NO
- **delivery contact type:** none — portal account required before delivery can be selected
- **acknowledgment:** none — request not accepted by GovQA without Create Account
- **fee:** none
- **status:** PORTAL_ACCOUNT_REQUIRED
- **notes:** Same GovQA Create Account blocker as PRR-BROWARD-PERMITS-001. No request ID issued. No password stored.

JSON: `public-record-request-log.json`.
