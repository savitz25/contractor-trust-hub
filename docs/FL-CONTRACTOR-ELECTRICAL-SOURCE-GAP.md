# FL-CON-ELEC-001 — Florida electrical credential source gap

## Gap

The accepted Florida DBPR Construction Industry Licensing Board extract does not contain the Florida electrical contractor credential population. Electrical exists in the network taxonomy, but the current Florida execution source cannot answer it. Codes used by Texas, New Jersey, Kentucky, or Wisconsin are not Florida identities and must never be substituted.

## Source family to audit

Audit the Florida Department of Business and Professional Regulation Electrical Contractors' Licensing Board and its official public license-download/search surfaces. Prefer a dated regulator extract or documented public-records response over rendered-page scraping. Establish the actual source owner, scope, update clock, status vocabulary, and whether firm and individual credentials are distinct.

## Identity and staging contract

- Identity key: exact source-native Florida electrical credential/license identifier plus exact credential class where the regulator requires the pair.
- No name-only, address-only, email, phone, DBA, or fuzzy joins.
- Proposed staging grain: one immutable source credential row per dataset vintage, with raw values, normalized values, source row fingerprint, observed date, effective/status dates, and retrieval provenance.
- Deterministic ingest fingerprint and identical-source no-op behavior are required.
- Historical observations append; newer files must not erase prior source states.

## Publication gate

Acquisition does not authorize publication. Public execution requires an exact/deterministic credential-to-existing-profile relationship, recognized source semantics, complete provenance, no identity conflict or hold, and the normal non-thin public-profile gate. Unresolved firms, person credentials, conflicting keys, pending applications, and uncertain relationships remain internal/review-held.

## Geography

Credential/address city and county are recorded geography, not service territory. Boca Raton may deterministically resolve to Palm Beach County for research framing, but neither the city nor county proves that an electrician serves a consumer's location or holds every local authorization required there.

## Acquisition options

1. Official downloadable board roster with stable identifiers and dated status fields.
2. Florida DBPR public-records request for the complete Electrical Contractors' Licensing Board credential extract.
3. A regulator-supported API/export, if documented and reproducible.

Avoid uncontrolled scraping and do not mint identities from search-result names.

## Proposed next ticket

**FL-CON-ELEC-001 — AUTHORITATIVE FLORIDA ELECTRICAL CREDENTIAL ACQUISITION + IDENTITY AUDIT**

The first phase must remain read-only: inventory source fields, counts, identifiers, dates, statuses, entity/person grain, privacy fields, overlap with canonical identities, and publication risk. No ingestion is authorized by this planning artifact.
