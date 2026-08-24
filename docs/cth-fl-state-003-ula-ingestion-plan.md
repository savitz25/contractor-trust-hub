# CTH-FL-STATE-003 Florida unlicensed-activity ingestion plan

This is a read-only plan for Florida DBPR/CILB `contractor_disc_ula`. It does
not ingest evidence, create identity relationships, adjudicate publication, or
change production. A ULA respondent name is never a contractor identity.

## Official sources and fresh corpus

The [official CILB public-records index](https://www2.myfloridalicense.com/construction-industry/public-records/)
currently publishes five ULA fiscal CSVs. Fresh downloads on 2026-08-24 all
returned HTTP 200:

| Fiscal year | Rows | Bytes | SHA-256 |
|---|---:|---:|---|
| 2021-22 | 2,312 | 535,623 | `4f0ca3409686d5a1fe960e7ecf2c0cf0416d62e216d29c4bc371432846d07d1c` |
| 2022-23 | 2,631 | 610,659 | `2c03c334e3bcda679d689494c397f7166c205aa60d3d43c05c8cf875ee84cc7b` |
| 2023-24 | 2,568 | 615,368 | `a5036af5f02e85d12b9af3252d17368b71b4c7cd9fa5c6b9a57fafcd4d2dcddc` |
| 2024-25 | 2,338 | 570,568 | `06169ddf04e1911fc6414977924c3eea28d872899a5499f6d86c766813f22b15` |
| 2025-26 | 1,842 | 448,562 | `3e9a92d8340f2c0975e4204d31b6d83cbc5bf8a7eef36a85da11b30218e87c9a` |

The total is 11,691 rows, exactly the prior expectation. All are parseable
Windows-1252 CSV rows; malformed and blank rows are zero. Each file has the
same ordered 16-column schema, fingerprint
`sha256:b1eb7f0fca26ee6dfd36125a5d1a2b49b2d06177c8b1480a39135ffdc1549690`:

`License Type`, `Respondent Name`, three address lines, `City`, `State`, `ZIP
Code`, `County`, `Complaint Nbr`, `Classification`, `Entered Date`,
`Disposition`, `Disposition Date`, `Discipline Date - Description`, and
`Violation Code`.

`License Type` identifies the regulated occupation category; there is no
license-number column and it must not be interpreted as a credential. Complaint
number is the only explicit regulator matter identifier. The extract has no
citation number, final-order number, DOAH number, entity/document number, FEI,
or other respondent identifier.

## Grain, exact identity, and revisions

One CSV row is a complaint/matter detail or outcome-description line, not
necessarily one complaint, citation, order, or sanction. The corpus contains
4,697 distinct complaint numbers. Only 205 matters have one row; 4,492 matters
are multi-line and account for 11,486 rows. A matter has as many as ten rows.
Each matter has one source respondent, six matters have multiple violation
codes, and no matter has multiple dispositions in this snapshot.

There are no exact duplicate rows within or across files, no complaint number
appears in multiple fiscal files, and no exact observation or conservative
logical-key collision indicates a revision. Therefore all 11,691 exact source
observations are presently net-new. Complaint-level deduplication is prohibited:
it would destroy 6,994 legitimate detail rows beyond a one-row-per-matter model.

ULA can reuse migration 009 without schema changes. The exact identity is
`source-observation-key-v2` over `fl_dbpr`, `contractor_disc_ula`, and the
ordered 16-field `FL_ULA_FIELDS` payload. Canonicalization remains narrow:
blank/null equivalence, line-ending normalization, and outer trim only; case,
punctuation, internal whitespace, dates, addresses, and leading zeros remain.
The logical review key uses complaint number, license type, respondent,
classification, entered date, and violation code. It is only a revision/review
group and never authorizes dedupe, supersession, identity linkage, or
publication. Occurrences remain file/batch/checksum/fiscal-year/locator
sightings. Exact re-observation creates at most a new occurrence; material
change is retained as `REVISION_REVIEW_REQUIRED` without automatic overwrite,
supersession, or duplicate public event.

## Regulatory semantics: allegation is not outcome

The official ULA search says its results are public complaints against persons
or entities that were not licensed at the time of the complaint. That does not
make every detail line a proven violation. Original terminology must remain
unchanged and no TrustHub severity or wrongdoing label may be created.

| Normalized review category | Rows | Raw disposition basis |
|---|---:|---|
| Complaint/investigation | 614 | blank disposition |
| Citation | 3,162 | Citation filed |
| Order | 24 | 22 Notice to Cease & Desist Issued; 2 Mandate |
| Final order | 7,852 | Final Order |
| Dismissed/no violation | 12 | 10 Dismissed; 2 No violation found |
| Closed/administrative | 15 | legal-review closure, duplicate complaint, or no jurisdiction |
| Insufficient evidence | 12 | the two explicit insufficient-evidence values |
| Other / unknown | 0 | no remaining raw values |

The four classification values are Unlicensed Activity (10,227), Repeat
Unlicensed (1,423), Unlicensed Activity Audit (37), and Unlicensed Activity
Investigations (4). Violation codes are retained verbatim; blank violation is
437 rows, and no meaning is inferred beyond the regulator code.

## Identity and linkage safety

ULA is structurally different from licensed discipline. A respondent may be an
unlicensed person or business, a different legal identity, a later licensee, or
someone absent from the contractor universe. Successful ingestion therefore
normally means standalone evidence with null `license_id` and `contractor_id`.

The future hierarchy is:

1. `OFFICIAL_IDENTIFIER_EXACT`: an explicit shared regulator-issued respondent
   identifier. Current CSV count: zero.
2. `OFFICIAL_DOCUMENT_CORROBORATED`: an official companion document that
   explicitly binds matter and identified respondent/entity/license. Confirmed
   current count: zero.
3. `REVIEW_CANDIDATE`: exact corroborating attributes for human review only.
4. `UNRESOLVED`: no safe identity. This is a valid final ingestion state.

Across 4,697 distinct matter/respondent units, exact normalized name plus exact
address and ZIP produces 113 candidate matters: 95 have one candidate target
and 18 are ambiguous. Exact name plus ZIP produces 148 candidate matters and
name-only produces 306. These are opportunity statistics only. No fuzzy,
name-only, numeric-fragment, address-only, similarity, or AI matching is
permitted. No candidate receives a relationship or publication privilege.

Current Sunbiz exact normalized-name/address, name/ZIP, and name-only overlap is
zero for this corpus. Even a future corporate candidate would represent only
`ULA respondent -> possible corporate entity`, never automatically `ULA event
-> contractor profile`. Sunbiz document number or FEI would be an official
identifier only if an official source explicitly supplies it; this CSV does
not.

## Official documents and final orders

DBPR provides an [Unlicensed Complaint Search](https://www.myfloridalicense.com/STO/UnlicensedActivity/default.asp),
and DOAH provides the [Florida Agency Indexed Orders](https://www.doah.state.fl.us/FLAIO/)
portal for agency orders not referred to DOAH plus a separate DOAH case search.
The indexed-orders portal supports agency, agency case number, agency document
number, issue date, type, and subject. The CSV has complaint number for all
11,691 rows, including 7,852 Final Order rows across 2,691 matters, but it has no
DOAH or final-order document number.

No document link is claimed in this plan: deterministic confirmed links are
zero, ambiguous links are zero, and 7,852 Final Order detail rows remain without
a verified document link. A later bounded enrichment may query the official
index by exact complaint/agency case number and accept a link only when the
official record explicitly reconciles the matter identifiers. Respondent-name
linking is prohibited. No orders were bulk-downloaded.

## `discipline_actions` and standalone evidence

The existing table can safely hold `source_system='fl_dbpr'` and
`source_dataset='contractor_disc_ula'`. Migration 008 permits fail-closed
`identity_state='UNRESOLVED'`, `publication_state='INTERNAL'`, false holds, and
null relationships. Here UNRESOLVED means no authoritative contractor/license
identity—not failed ingestion. Exact name/address review opportunities may use
REVIEW_REQUIRED metadata while remaining unattached. Migration 009 provenance
works unchanged.

No schema migration is required. A code prerequisite is required before
execution: immutable dataset-specific ULA field constants, tests, semantic
crosswalk, and a dedicated insert-only ULA executor. It must not reuse the
licensed-credential resolver as though `License Type` were a license ID.

The standalone contract is: one detail-level `discipline_action`, one immutable
source observation, one occurrence for its source snapshot, null license and
contractor relationships, INTERNAL publication, no scoring, and no contractor
profile/search exposure. All 11,691 observations may be ingested safely under
that contract; review candidates remain unattached.

## Contact, address, and minimization

The schema exposes no email, phone, website, role/title, extension, or separate
contact field. Address line 1 is present on all 11,691 rows; line 2 on 7,553;
line 3 on 1,563; city on 11,636; ZIP on 11,602. These remain regulator-observed
source payload values, never canonical contractor addresses. Respondents are
not promoted to contacts. Future datasets with multiple contacts must preserve
every qualified observation and provenance rather than overwrite or keep only
the first. No unnecessary personal data is added beyond the official record.

## Publication and refresh policy

Every future row starts INTERNAL with PUBLIC_ELIGIBLE zero. Standalone,
review-candidate, and unresolved evidence cannot be publicly attributed to a
contractor. Even an officially linked record requires separate semantic,
provenance, freshness, correction/retraction, and publication adjudication.
The feature gate remains off.

Re-download the open fiscal file monthly and historical files quarterly.
Checksum-identical same-snapshot files are no-ops. Seeing an exact observation
in a genuinely new snapshot creates an occurrence only. New exact content may
create a new observation/action; a logical-group material change is retained
for revision review. Missing prior content is never deleted automatically. When
FY25-26 closes, retain its immutable batch and begin a separately checksummed
FY26-27 batch.

## Recommended execution sequence

1. Merge this plan.
2. Implement and review the dataset-specific read-only/dry-run architecture:
   `FL_ULA_FIELDS`, logical fields, semantic mapping, fixtures, and insert-only
   executor with canonical checksum/manifest gates.
3. Regenerate all five official files and an exact non-PII execution/reverse
   manifest; verify 11,691 net-new observations, zero revisions/duplicates, and
   zero production relationships/public eligibility.
4. Separately approve one bounded production transaction for batches, actions,
   observations, and occurrences.
5. Independently verify standalone behavior and only later consider exact-ID
   official-document enrichment or publication adjudication.

Recovery Fund, workers compensation, county/city data, Google services,
contact promotion, and publication are out of scope.
