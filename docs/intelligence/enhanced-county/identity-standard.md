# Enhanced-county identity standard

County records enrich the existing Florida graph. They do not change `licenses.external_key` identity.

## License-number contract

Preserve raw and normalized **full** license. Occupation prefix stays. `CCC1234567` ≠ another occupation with digits `1234567`. Numeric core alone → **UNRESOLVED**, never CONFIRMED.

Reuse `normalizeLicenseKey` / `normalizeFullLicense` (strip spaces/dashes only).

## Permit → contractor

| State | Method | When |
| --- | --- | --- |
| CONFIRMED | FULL_DBPR_LICENSE | Occupation-prefixed DBPR number matches a `licenses` row |
| CONFIRMED | LOCAL_LICENSE_CROSSWALK | Exact county cert ID with a stored DBPR number that matches |
| CONFIRMED | OFFICIAL_CONTRACTOR_ID | Permit-system contractor key deterministically linked to a known credential |
| HIGH CONFIDENCE | MULTI_FIELD_HIGH_CONFIDENCE | ≥3 agreeing strong attributes (legal name, firm, address, phone, qualifier) **plus** a local or DBPR identifier |
| REVIEW REQUIRED | name similarity without deterministic IDs | Do not publish volume |
| UNRESOLVED | none / ambiguous name / numeric core | Do not publish volume |

Never publish permit volume on a profile from fuzzy-name-only matches.

## Local credential → state credential

`LOCAL_CREDENTIAL —RELATES_TO / REGISTERED_FROM→ STATE_CREDENTIAL` only when the source exposes the link. Do not collapse county COC into the DBPR credential.

## Roles on a permit (keep distinct)

contractor / license holder ≠ qualifier ≠ applicant ≠ owner ≠ expeditor. Applicant ≠ contractor. Contractor name ≠ Sunbiz legal entity.

## New names in county files

Classify before any public profile: existing DBPR unmatched; local-only/historical; other-board (e.g. ECLB electrical); out-of-state; owner-builder; unlicensed record; unknown. Do not auto-create Trust Hub profiles from a permit name.

## Electrical / non-CILB

County permits will include ECLB and other boards. Flag `other_board`. Do not merge into CILB occupation buckets.

## Geography

HQ/base = DBPR mailing county. Activity = attributed permits in a **named jurisdiction**. A Broward-HQ contractor may have Unincorporated PBC permits. Do not overwrite HQ with activity.

## Contacts

Keep every distinct public phone/email/address with source URL and retrieved date. Do not overwrite secondary observations. `is_agency_number` must be true for 954-765-4400, 561-233-5525, 311, etc.

## Code enforcement

Attach to a contractor only when the official record names that contractor with a deterministic ID. Otherwise property/project context only.
