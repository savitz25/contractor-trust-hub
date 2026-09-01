# CON-CAP-002 implementation audit

Audit date: 2026-09-01. Production reads only; no database writes or migrations.

## Canonical release state

- Repository: `savitz25/contractor-trust-hub`
- Accepted `origin/main`: `c5d1d8b3eb50293bb5a1fc86ceee3808e0678a13`
- Production deployment: `dpl_6vo7K6Z6DFAchm1MiK5G6Sp8m1wR` (`READY`)
- Production Git SHA: `c5d1d8b3eb50293bb5a1fc86ceee3808e0678a13`
- Existing contract family: `trusthub-specialist-execution-v2`
- Existing contract/schema fingerprints: not present in the accepted Florida-only response
- Existing failure: POST `{ "state": "NJ" }` returns HTTP 400 `unsupported_state`

The owner checkout contains unrelated local work and is behind the accepted remote. CON-CAP-002 uses an isolated worktree created directly from the accepted remote SHA.

## Existing execution path

The accepted endpoint normalizes only `state=FL`, maps Florida trades through the national Ask ontology, and queries `licenses` joined to existing non-thin `contractors`. It hard-codes `fl_dbpr` and Florida geography. New Jersey exists in `lib/states/config.ts` and the Verify product, but not in the specialist executor.

## New Jersey production census

Source grain: `licenses.source_system='nj_dca'`, joined by the existing exact `contractor_id` relationship. Latest full ingest batch: `contractor_hic_registration`, 87,355 rows, extracted 2026-08-13, checksum `c57935474ea252ebccd0cbecb0516a5f42fc3a7d0575362248ff8ea054c36e81`.

| ID | Finding |
|---|---:|
| NJ1 all NJ DCA credential rows | 87,355 |
| NJ2 source system | `nj_dca` (87,355) |
| NJ3 source-native classes | HIC 25,111; ELE 32,304; PLB 11,455; HVAC 9,520; ALM 4,863; TEL 3,043; LCK 993; HRT 66 |
| NJ4 accepted normalized families | home improvement→HIC; electrical→ELE; plumbing→PLB; HVAC/mechanical→HVAC; alarm→ALM; telecom→TEL; locksmith→LCK; hearth→HRT |
| NJ5 active/current | 55,309 |
| NJ6 inactive/expired-family statuses | 32,046 |
| NJ7 valid public credential identifier | 87,355 |
| NJ8 existing non-thin public profile relationship + slug | 87,355 |
| NJ9 rows without that public profile gate | 0 |
| NJ10 unattached/held identities | 0 |
| NJ11 recorded city present | 87,353 |
| NJ12 recorded county field present | 87,311 |
| NJ13 recorded address state NJ | 75,484 |
| NJ14 existing public profile destination | 87,355 |
| NJ15 Verify-only/no-profile candidates | 0 |
| NJ16 duplicate credential identifier groups | 0 |
| NJ17 credential identifiers attached to multiple identities | 0 |
| NJ18 rows requiring identity/publication review under current gate | 0 |

Active counts by principal supported class: HIC 25,111; ELE 13,091; PLB 4,903; HVAC 6,654. All 87,355 rows use source board `NJ_DCA` and have existing public non-thin profile destinations.

## Publication conclusion

New Jersey can execute bounded public-safe rows without publication expansion because every accepted `nj_dca` credential is already attached to an existing non-thin public contractor profile with a slug. No Verify-only rows or identity holds exist in this source cohort. The V2 query must reuse this gate; it must not infer publication from client input.

## Geography audit

New Jersey credential jurisdiction is independent of the credential holder's recorded address. A statewide NJ credential cohort therefore selects `nj_dca`, not `licenses.state='NJ'`; the latter would wrongly omit out-of-state credential holders.

Recorded county values contain out-of-state locations, spelling variants, and a small number of malformed source values. County execution must accept only an authoritative New Jersey county allowlist and require the recorded address state to be NJ. City execution is limited to authoritative city/county mappings implemented by this release.

The State of New Jersey locality directory and municipality-code list identify Summit City as municipality code 2018 in Union County. The source contains Summit rows primarily recorded as Union/Union County plus one conflicting HIC row marked Essex. City-level Summit execution must use the authoritative Union relationship and exclude the conflicting source row. `Summit County, New Jersey` is invalid because New Jersey has no Summit County.

## Implementation decision

Proceed with a thin, state-aware extension of the existing V2 executor:

- reuse `lib/states/config.ts` for state/source/board/Verify metadata;
- centralize source-native class mappings in one capability matrix;
- preserve all Florida meanings and the Florida electrical limitation;
- add New Jersey statewide HIC and verified specialty cohorts;
- make generic NJ contractor and statewide General requests clarification/capability states;
- validate NJ county/city relationships and require explicit statewide fallback confirmation;
- preserve neutral ordering, bounded server-side pagination, exact identifiers, public profile gates, and service-territory refusal;
- make no database, identity, profile, sitemap, or publication changes.
