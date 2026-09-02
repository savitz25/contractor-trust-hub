# NJ-CON-002B denominator dictionary

Every published New Jersey construction-market total must name its denominator
and source-record class. Combined P+C rows are **permit and certificate source
records**, not “permits.”

Source: NJ Construction Permit Data (`w9se-dmra`), NJ DCA Division of Codes and
Standards. Official comparison publication: Construction Reporter /
[Building Permits](https://www.nj.gov/dca/codes/reporter/building_permits.shtml).

## Record classes

**Source record.** One row in the official extract. Grain is municipality code +
record ID (Socrata `pk`). A source record is either permit-issued or
certificate-issued. It is not a project, not a contractor history, and not a
completed job.

**Permit-issued record.** `Status = P` / Permit Status Description = Permit.
Official meaning: a construction permit was issued. This is the class that
corresponds to Construction Reporter “authorized by building permits” tables.

**Certificate-issued record.** `Status = C`. Official meaning: a certificate
(CA, CO, TCO, and related types) was issued. It is not proof that the same
source row’s permit was “completed” by a named contractor.

**Update-marked record.** `Update = X`. Official field description: “X indicates
this record represents a permit update.” The current extract contains the
update-marked row as a distinct source record (`pk` unique). It is not proven
that a pre-update row also remains. Update-marked rows stay in the source-record
denominator. They are **not** added a second time as a separate market event.
They are not excluded without a source-backed supersession rule.

**Municipal record.** County is one of New Jersey’s 21 counties and municipality
type is not `STATEWIDE`.

**State-level record.** County = `STATE` and/or municipality type = `STATEWIDE`
and/or municipality code `9999`. Construction Reporter publishes a separate
“State buildings” line. These rows are preserved as `STATE_LEVEL`. They are
**not** added into municipality-derived statewide totals unless a later audit
proves they are independently additive project records.

## Identifiers

**Source record key.** `pk`, equal to municipality code concatenated with record
ID. Stable within a snapshot. Not a project ID.

**Source record fingerprint.** SHA-256 of the canonicalized source row.

**Permit number.** Local number printed on documents given to the applicant.
Not globally unique. Not unique within a municipality.

**Record ID.** Mainframe record identifier. Unique only with municipality code.

**Municipality code.** DCA municipality code (`comu`). Distinct from the Treasury
property-tax code (`treasurycode`).

## Geography

**Reporting municipality.** A current canonical municipality (official
Municipalities of New Jersey list, `k9xb-zgh4`, 564 current municipalities)
that has at least one source record in this extract.

**Non-reporting municipality.** A current canonical municipality that the agency
explicitly lists as having no data in this extract. Absence is **not** a reported
zero. Construction Reporter monthly tables distinguish `0` from `No report`.

**Historical municipality code.** A `comu` observed in the extract that is not on
the current canonical list.

**Current municipality.** A municipality on the current canonical 564-row list.

## Dates

**Permit date.** Date the permit was issued. Drives construction-activity periods
and like-for-like Reporter comparisons.

**Certificate date.** Date the certificate was issued (populated on C rows).

**Process date.** Date the state processed/received the municipal submission.
Drives source-coverage-by-month and retention analysis.

**Source update date.** Socrata `rowsUpdatedAt` for this snapshot
(2026-08-13T18:20:31Z). “Data received as of 08/07/2026.”

**Audited month.** A month the agency treats as reviewed. The dataset states
that permits issued in the immediate previous two months have not been reviewed.

**Unaudited month.** Those two most recent issuance months relative to the
received-as-of date. Public trends must not present them as completed, audited
activity.

## Measures

**Estimated construction cost.** Official field: “Value of construction involved
in the permit, as reported by the applicant.” Present on both P and C rows.
P and C values are not proven additive. The approved public cost metric is
**permit-issued municipal source-reported estimated construction value**.

**Sale-unit field.** Integer; negative means housing units lost (official field
description).

**Rental-unit field.** Same semantics for rental units.

**Net housing-unit change.** Sum of sale-unit and rental-unit fields, positives
and negatives together. Never labeled “units gained.”

**Gross units added.** Sum of positive sale-unit and rental-unit values. Used
only when comparing to Reporter “housing units authorized.”

**Missing value.** Blank / null. Distinct from zero.

**Invalid value.** Unparseable.

**Extreme-value review record.** Parsed cost ≥ $500 million, negative cost, or
malformed cost. Retained in the source. Not discarded by a dollar cutoff.
Excluded from the approved public cost metric until classified
`VALID_LARGE_PROJECT`.

## Snapshot and window

**Source-window status.** Whether the record is in the current extract,
aged out of the stated 60-month receipt window, present despite that stated
rule, or removed for an unknown later reason. Absence from a later snapshot is
not cancellation.

**Baseline-only snapshot.** The first acquired extract. It does not generate
historical customer alerts or “what changed” events.
