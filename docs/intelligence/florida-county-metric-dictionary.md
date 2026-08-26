# Florida Contractor County Intelligence — metric dictionary

Payload version: `cth-fl-county-intel-v1`

Canonical routes (no duplicate URLs):

| County | Path |
| --- | --- |
| Broward | `/florida/broward` |
| Palm Beach | `/florida/palm-beach` |

Coverage: **Statewide Research**. Enhanced Local Research is documented and **not activated**.

Mailing `licenses.county_code` (DBPR 16 = Broward, 60 = Palm Beach) supports “credentials with a business/address record in [County].” It is not operating geography, local authorization, or permit activity.

## Enhanced gate (documented, not activated)

All of: source files loaded; meaningful permit or local-credential coverage; validated identity attribution; known jurisdiction denominator; sufficient recency; no critical unresolved coverage ambiguity; operating/activity evidence.

Jurisdiction metadata count alone must not flip Enhanced. `countyResearchCoverage()` does not call the gate.

## READY (public)

- Trade credentials with mailing/base county
- Active trade credentials with mailing/base county
- Mapped local permitting jurisdictions (AHJ metadata)

## INTERNAL_ONLY

Loaded row counts for `permit_source_records` and `local_credentials` (currently expected 0). Not rendered as public zeros.

## NOT_READY (public)

Permits, local credentials/certifications, county enforcement, county contacts, operating geography.

No dataset ≠ zero events.
