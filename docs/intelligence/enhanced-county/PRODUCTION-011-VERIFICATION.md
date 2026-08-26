# Production 011 + seed verification (Prompt 10)

Re-verified 2026-08-26 via PostgREST (service role; anon is revoked on these tables). **Did not re-run migration or seed.**

| Table | Exists | Count |
| --- | --- | --- |
| enhanced_jurisdictions | PASS | 72 metadata rows |
| local_credentials | PASS | 0 |
| local_credential_relations | PASS | 0 |
| permit_source_records | PASS | 0 |
| permit_lifecycle_events | PASS | 0 |
| permit_attributions | PASS | 0 |
| public_contact_observations | PASS | 0 |
| enhanced_source_files | PASS | 0 |

Jurisdiction metadata: Broward unincorporated/BMSD 1 + municipal 31; Palm Beach unincorporated 1 + municipal 39. Special notes present for `bmsd`, `unincorporated`, `westlake`, `loxahatchee-groves`.

This is **not** Enhanced Local Research. `countyResearchCoverage()` remains `statewide`.
