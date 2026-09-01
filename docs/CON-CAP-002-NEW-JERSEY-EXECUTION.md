# CON-CAP-002 New Jersey execution

## Source and publication census

The read-only 2026-09-01 production audit found 87,355 `nj_dca` rows from the 2026-08-13 accepted extract: 55,309 active and 32,046 inactive. All rows have exact credential identifiers, exact attached identities, existing non-thin public profile slugs, and no duplicate identifier groups or identity holds. No database or publication change is required.

Class totals: HIC 25,111; ELE 32,304; PLB 11,455; HVAC 9,520; ALM 4,863; TEL 3,043; LCK 993; HRT 66. Active totals: HIC 25,111; ELE 13,091; PLB 4,903; HVAC 6,654; ALM 2,081; TEL 3,018; LCK 392; HRT 59.

## Capability matrix

The executable matrix is defined once in `lib/specialist-execution/state-capabilities.ts` and derives board/source/Verify metadata from `lib/states/config.ts`. It drives validation, execution, capability choices, and contract metadata.

NJ is specialty-state research. HIC and the specialty classes remain separate. There is no invented statewide General class and no combined all-contractor cohort.

## Geography

Statewide results mean NJ credential jurisdiction, not an NJ address or service claim. County rows require an authoritative NJ county and NJ recorded address state. City execution is currently bounded to official mappings; Summit City maps to Union County using the official NJ municipality-code list. Source rows inconsistent with that relationship are excluded from the Summit city cohort.

Unknown city/ZIP filters do not broaden silently. The contract offers an explicit statewide confirmation request. Service-territory and availability questions fail closed.

## Publication and destinations

Rows reuse the accepted public non-thin profile gate. No profile is minted. Existing destinations may include a public profile, exact ContractorTrustHub Verify query, and official NJ DCA verification. Missing destinations would remain null/`NO_PUBLIC_DESTINATION`; none were manufactured for this release.

## Florida lock

Florida requests retain their legacy request shape, exact class mappings, county handling, pagination, and publication gate. Florida electrical remains unsupported from the accepted CILB source and never borrows NJ `ELE` rows.
