# CTH-FL-STATE-006 stop-work enforcement plan

## Decision

The Florida DFS Compliance Stop-Work Order Database is a viable, official, daily enforcement source. The current public result contains 48,260 rows and 48,254 unique exact seven-field observations dating to January 1, 2004. Initial ingestion can conditionally use `discipline_actions` and migration-009 provenance without a schema migration, provided every row remains standalone, unresolved, internal, unscored, and excluded from public read paths.

No production mutation or ingestion occurred.

## Official source and boundary

The [DFS Stop-Work Order Database](https://dwcdataportal.fldfs.com/SWOquery.aspx) is owned by the Florida Department of Financial Services, Division of Workers' Compensation. It is unauthenticated, supports an all-employer result, has no observed pagination, dates back no further than January 1, 2004, and is updated daily by 8:00 a.m. (sometimes later). The all-employer HTML report is approximately 80 MB, making automated daily retrieval practical but deserving bounded timeouts and checksum/no-op handling.

Coverage, Proof of Coverage, exemptions, elections, and policy tracking remain STATE-005 status facts. STATE-006 is limited to issued stop-work orders and the release/reinstatement chronology exposed in this enforcement result.

## Grain and fields

One displayed row is one stop-work-order history observation for an employer/location, served date, reason, ended state/date, and reinstated state/date. The ordered source contract is:

1. Employer Name
2. County
3. City
4. Date Served
5. Date Ended*
6. Date Reinstated**
7. Reason

There are 48,260 rows, 48,254 unique exact observations, and six exact duplicate occurrences. There are 46,207 distinct raw employer names; 1,886 names have multiple rows, with a maximum of five. Employer-name or served-date dedupe is prohibited. Exact duplicate rows should retain their source locators/occurrences until DFS confirms whether they are duplicate display records or indistinguishable separate orders.

The observed reason distribution is: FAILURE TO OBTAIN COVERAGE 45,003; FAIL PRODUCE DOCS 5 DAYS 1,087; FAIL PRODUCE DOCS 10 DAYS 1,048; FAIL PRODUCE DOCS 21 DAYS 413; UNDERSTATE OR CONCEAL PAYROLL 313; SITE SPECIFIC 288; MISREP. OR CONCEAL EE DUTIES 98; MISREP. OR CONCEAL INFO. E-MOD 7; FAIL PRODUCE DOCS 3 DAYS 3. Raw terminology must remain unchanged.

## Identifiers and identity

The result does not display a stop-work order number, case number, employer ID, FEIN, DBPR credential, Sunbiz ID, exemption certificate, penalty/order ID, DOAH case number, or final-order number. FEIN is available only as an exact search input. Accordingly, all 48,254 prospective exact observations begin `UNRESOLVED`, with null license and contractor IDs. No name, location, fuzzy, substring, or numeric-core matching is permitted.

The preferred future identity path is an official DFS extract containing FEIN or a stable employer/order ID, followed by exact entity resolution and separately proven entity-to-contractor/license relationships. Enforcement naturally identifies an employer/entity; it must not be forced directly onto a contractor profile.

## Temporal and penalty semantics

`Date Served` supports “DFS issued/served a stop-work order on [date].” DFS states these orders follow a determination that an employer failed to secure payment of compensation, creating an immediate serious danger under section 440.107, Florida Statutes. Employers may seek an administrative hearing within 21 days, but the database exposes no appeal status.

The Date Ended footnote states that an employer came into compliance and entered a periodic payment agreement or paid the penalty in full. The source does not distinguish those alternatives. Date Reinstated indicates default under the payment agreement and reinstatement of the relevant order. A historical served row is not automatically a currently active order. `CLOSED`, `RESCINDED`, `MODIFIED`, and `APPEALED` are not raw fields and must not be manufactured.

No monetary fields are exposed. The result cannot establish proposed, assessed, reduced, paid, settled, or outstanding amounts. Penalty details require a separate official data extract. The online payment service is operational, not a public penalty dataset.

## Final orders, contacts, and absence

DFS final orders from 2003 through June 30, 2015 are searchable in the DFS index; post-July 2015 official compilation is maintained by DOAH. The stop-work rows expose no deterministic case/document identifier, so document linkage is zero and deferred. Respondent-name PDF matching is prohibited.

The source exposes no email, phone, website, street address, contact name, or role. County and city are location context, not contact enrichment. No personal or business contact should be promoted from this dataset.

Safe absence wording is: “No matching stop-work row was found in the selected DFS database/search, which is a representative historical database dating to 2004.” It must not be represented as fully compliant, insured, or free of enforcement history.

## Storage and provenance

`discipline_actions` is conditionally appropriate because stop-work orders are formal enforcement evidence. Use `source_dataset=fl_dfs_workers_comp_stop_work`, preserve the seven raw fields and exact source terminology, map Date Served to the action date, and retain ended/reinstated values in the immutable raw payload. Every initial row remains `INTERNAL`, `UNRESOLVED`, unlinked, and unscored.

Migration 009 can be reused unchanged: one exact source row becomes one discipline action and one immutable source observation. Use source-observation-key-v2 over all seven ordered fields. Use logical-matter-detail-key-v1 over Employer Name, County, City, Date Served, and Reason for review/grouping only—never identity, dedupe, supersession, or publication.

Daily retrieval after the DFS update window is appropriate. Unchanged snapshot checksum is a no-op; the same observation in a genuinely new snapshot receives a new occurrence; material change creates a new observation in revision review; disappearance retains history and triggers review, never deletion.

## Publication and scoring

Initial `PUBLIC_ELIGIBLE` is zero and scoring impact is zero. Future wording may say “Florida DFS issued a stop-work order on [date]” or “Florida DFS lists the order as ended on [date].” It must not say an order is currently active from historical issue alone, or infer fraud, uninsured status, safety, or complete compliance. Any scoring treatment is `DEFERRED — SEPARATE POLICY REVIEW`.

## Production reconciliation

The repeatable-read, read-only audit confirmed 21,420 discipline actions: Florida 19,827 (`6,457` licensed, `11,691` ULA, `1,679` Recovery Fund), Arizona 459, and New Jersey 1,134. Observations and occurrences remain 19,827 each; batches remain 61; `PUBLIC_ELIGIBLE` remains zero.

Recovery Fund remains EXACT 75, DETERMINISTIC 29, REVIEW_REQUIRED 342, UNRESOLVED 1,233, with 104 license links across 49 targets, zero contractor links, and zero public rows.

## Next task

CTH-FL-STATE-006 controlled-ingestion architecture should freeze the daily HTML source contract and checksum, independently reproduce the 48,254 exact observation set, resolve the six duplicate occurrences conservatively, pre-generate deterministic IDs, test daily revisions and disappearance, and enforce zero links/publication. In parallel, request a DFS machine-readable extract containing stable order/employer identifiers and penalty detail for a future identity/document enhancement.
