# EA-CT-002 — activate confirmed dual-linked DBPR permit evidence on Trust Reports

## Baseline verification (read-only Production queries; see the three `*.local.json` evidence files)

The ~80,810 figure is confirmed exactly, and its grain is unambiguous:

`permit_attributions.identity_state = 'CONFIRMED' AND identity_method = 'FULL_DBPR_LICENSE'` = **80,810 rows**,
each one a distinct `permit_source_records` row (1:1, no duplication — `permit_source_records` is itself unique on
`(source_system, source_jurisdiction, permit_number)`), affecting **8,015 distinct contractors** via **8,015
distinct license ids**. All 80,810 are `county_slug = 'miami-dade'`, `source_system = 'mdc_opendata_issued'`
(Miami-Dade County Open Data — Building Permits), all `status_normalized = 'issued'`, single ingest batch
(`retrieved_at = 2026-08-27T00:25:49.228Z`, one `parser_version`).

`permit_attributions` full breakdown (139,586 rows total = same as `permit_source_records`, confirming full 1:1
coverage of the raw permit table):

| identity_state | identity_method | n |
|---|---|---:|
| CONFIRMED | FULL_DBPR_LICENSE | **80,810** |
| REVIEW_REQUIRED | DBPR_PREFIX_NOT_IN_WAREHOUSE | 25,145 |
| UNRESOLVED | OWNER_BUILDER | 25,016 |
| UNRESOLVED | LOCAL_CREDENTIAL_CANDIDATE | 5,531 |
| UNRESOLVED | UNRESOLVED | 3,084 |

Integrity spot-check: for all 80,810 CONFIRMED/FULL_DBPR_LICENSE rows, `licenses.external_key` (normalized)
exactly equals `permit_source_records.contractor_license_normalized` (normalized) — **80,810 / 80,810**, 100%.

Note on the older `permit_records` / `contractor_permit_activity` / `permit_coverage_stats` tables (Stage 6,
`schema/migrations/006_stage6_permits_activity.sql`, still backing the existing `ActivitySection`): all three are
**empty in Production** (0 rows). The Evidence Activation batch lives entirely in `permit_source_records` /
`permit_attributions` / `permit_lifecycle_events` (plus `permit_events`, not used by this feature).

**Correction (QA amendment):** `permit_source_records`, `permit_lifecycle_events`, and `permit_attributions` —
including `permit_attributions_license_idx ON permit_attributions (matched_license_id) WHERE matched_license_id
IS NOT NULL` — **are** defined in the committed migration `schema/migrations/011_enhanced_county_foundation.sql`.
An earlier draft of this document incorrectly claimed none of these tables appeared in any committed migration
and were created directly against Production; that claim was wrong and is retracted. `permit_events` is a
separate table and is **not** defined in migration 011; whether it represents genuine schema drift is a distinct,
out-of-scope question — EA-CT-002 does not read, write, or otherwise depend on `permit_events`, and that table
is not touched by this feature. `permit_lifecycle_events` is currently empty (0 rows) — no lifecycle/inspection
history exists yet for any permit.

## Identity bridge used (nothing computed here — read exactly as the batch already resolved it)

```
permit_attributions.matched_license_id     -> licenses.id           (FK)
permit_attributions.matched_contractor_id  -> contractors.id        (FK)
permit_attributions.permit_source_record_id -> permit_source_records.id (FK, UNIQUE: 1 attribution per permit)
```

A permit renders on a Trust Report only when ALL of:
- `identity_state = 'CONFIRMED'`
- `identity_method = 'FULL_DBPR_LICENSE'`
- `matched_contractor_id` = the profile's own contractor id
- the matched license's own `contractor_id` independently agrees (defense against an inconsistent row)
- a license external_key and a permit id are actually present

See `lib/contractors/permit-evidence.ts` (`selectConfirmedPermitEvidence`) — pure, unit-tested, no name/address
matching of any kind.

## Real-source preview (production data, read-only)

- `cgc062343-lennar-homes-llc` (LENNAR HOMES LLC) — **2,043** confirmed permits, "Confirmed license match" state,
  top 10 most recent shown (SFR/townhome model permits, Miami-Dade, Aug 2026 issue dates), each with permit
  number, jurisdiction, applied/issued dates, worksite address, license CGC062343, source link.
  Initial preview surfaced a real defect (fixed before commit): the display module's defensive row-scan cap
  (500) was being used as the *headline total*, so this profile showed "500 confirmed records" instead of the
  true 2,043. Fixed by computing `totalCount` from a real `COUNT(*)` query, independent of the display-row scan
  cap — see `fetchPermitEvidenceTotal` in `lib/property/permit-evidence-db.ts` and gate test #11.
- `mn-qb648229-margaret-m-karrh` — a real FL-licensed contractor with zero confirmed permits: renders the
  "Not linked" / unavailable state, with an honest non-claim message (no "0 permits").

## Tests — `npm run test:permit-evidence` (12/12 pass, deterministic, no database)

1. exact dual-linked contractor gets permit evidence
2. wrong contractor gets nothing
3. same-name contractor gets nothing without exact ID
4. missing license bridge fails closed (5 sub-cases: dangling license FK, inconsistent contractor/license,
   missing permit id, every non-CONFIRMED identity_state, a CONFIRMED-but-wrong-method row)
5. duplicate permit/lifecycle events do not inflate displayed permit count
6. status/history preserved correctly (applied / issued / final / unknown)
7. no permit evidence does not become "0 permits" (empty candidates, all-unresolved candidates, and a genuine
   source error all render "unavailable" with no numeric claim at all)
8. source clocks/provenance render (per-row and aggregate, MAX retrievedAt)
9. no cross-jurisdiction identity leakage
10. deterministic ordering + display-limit/hasMore behavior
11. **(added after the preview defect above)** a high-volume contractor's totalCount reflects the TRUE count,
    never the bounded candidate-scan length

## Query-performance QA amendment (read-only `EXPLAIN ANALYZE`, no writes/DDL/mutation)

Context: ContractorTrustHub had an active DB session-slot / IO-pressure incident at the time of this amendment.
The FL Trust Report permit-evidence feature issues two read queries per profile view: a candidate-row query
and a `COUNT(*)` query. Both were checked read-only (`BEGIN READ ONLY` / `ROLLBACK`, single connection,
`statement_timeout` set, no `ANALYZE`/`VACUUM`, no DDL, no mutation) — see
`docs/qa/ea-ct-002/query-plan-verification.local.json` and `scripts/ea_ct_002_qa_explain.mjs`.

Finding: the original candidate-row query (`WHERE a.matched_contractor_id = $1`) sequentially scanned the full
`permit_attributions` table (139,586 rows) — `permit_attributions` has no index on `matched_contractor_id`.
The `COUNT(*)` query was already fast because it joins `licenses` and filters `l.contractor_id =
a.matched_contractor_id`, letting Postgres drive the join through `licenses_contractor_idx` +
`permit_attributions_license_idx`.

| case | rows | current path (seq scan) | fixed path (license-idx) |
|---|---:|---:|---:|
| zero-permit contractor | 0 | 28.8 ms, `Seq Scan on permit_attributions` | 0.1 ms, index only, no seq scan |
| normal-volume contractor (2–10 permits) | few | comparable seq-scan cost on the same table | sub-ms, no seq scan |
| Lennar (high-volume, 2,043 permits) | 2,043 | 483 ms, `Seq Scan on permit_attributions` | 14 ms, no seq scan |

Fix (code path only, no schema change): `lib/property/permit-evidence-db.ts` now resolves the contractor's
license id(s) first (`SELECT id FROM licenses WHERE contractor_id = $1`, using the existing
`licenses_contractor_idx`), then filters `permit_attributions` by `matched_license_id = ANY($1::uuid[])` —
which uses the existing `permit_attributions_license_idx` — **while still requiring `matched_contractor_id =
$2` as an exact equality filter in the same query**. This changes which index drives the scan; it does not
change which rows qualify or relax any safety check. No new index, no DDL, no database mutation, no pool
tuning, no load test. If `permit_attributions.matched_contractor_id` still needs its own index at higher load,
that is a separate proposed schema gate, not part of this amendment.

## Regression

- `npm run typecheck` — clean.
- `npm run test:matcher` (pre-existing Stage 6 matcher suite) — all passed, unmodified.
- `npm test` (the full omnibus suite) — every check ran and passed cleanly from `assert-brand-001` through
  `test:pa-con-001` (260 pass markers, 0 failures), including all four Florida assertion scripts
  (`assert_florida_state_intelligence`, `assert_florida_p0_remediation`, `assert_florida_intelligence_foundation`,
  `assert_florida_qualifier_graph`). The chain then halted at `test:nc-con-001`, which reads
  `data/north-carolina/nc-con-001/raw/debarred-vendors.csv` — a file that is `.gitignore`d (`*.csv` in that
  directory) and has **never existed in git history**. This is a pre-existing environmental gap in this fresh
  worktree, unrelated to North Carolina or Florida code, and unrelated to this ticket (no North Carolina file
  was touched). Not fixed, per "do not fix unrelated inherited test debt."
- `npm run build` — succeeds (twice: once before, once after the totalCount fix).
- `next start` + live preview against the real production database — verified both the "available" and
  "unavailable" states render correctly (see above).
- No other file diverges from `origin/main` except this feature's own additions plus two lines in
  `app/contractors/[slug]/page.tsx` (import + one render line) and one line in `package.json`
  (`test:permit-evidence` script). An unrelated `tsconfig.json`/`tsconfig.tsbuildinfo` auto-rewrite produced by
  `npm run build` (a known Next.js side effect, `jsx: preserve` -> `react-jsx`) was reverted, not committed.
