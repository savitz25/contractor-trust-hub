# CTH-FL-STATE-005 workers' compensation and exemption plan

## Decision

STATE-005 requires a data-model prerequisite and a controlled official-data acquisition step. Workers' compensation coverage and exemptions are regulatory status facts, not discipline. They must not be inserted into `discipline_actions` merely to reuse its provenance link. No production data was changed.

## Official sources and access

Florida DFS Division of Workers' Compensation owns the official [Coverage portal](https://dwcdataportal.fldfs.com/POCData.aspx). It exposes a Proof of Coverage search, a segmented Digital Download (Policy Data), and a separate Exemption Search. The portal also links the stop-work database; that enforcement dataset is excluded and reserved for STATE-006.

The policy digital download is an Excel export segmented by employer-name initial, policy effective-date range, and county. DFS describes the Proof of Coverage population as policies reported within the past five years. The interactive endpoints use CAPTCHA and no stable documented API was found. The exemption search explicitly contains historical and current information, but is search-driven rather than a complete reproducible export. DFS states that exemption application data is available by public-records request.

The approved acquisition strategy is therefore an official DFS public-records request for machine-readable current and historical Proof of Coverage and exemption extracts, their data dictionaries, stable record identifiers, redaction rules, snapshot/update cadence, and revision semantics. No search enumeration, CAPTCHA bypass, or commercial source is approved.

## Coverage contract discovered

The official export instructions list 21 fields: Policy Number; Policy Effective Date; Policy Cancellation Date; Policy Expiration Date; Named Insured; Governing Class Code; Agency Name/City/State; Carrier Name; Wrap-Up Indicator; PEO Client; Employer Name; Employer Address Street/Street2/City/State/Zip/County; Employer Phone Number; and NAICS.

The grain is an employer/carrier/policy-period observation as reported by an insurer. It is not necessarily one business or one location. DFS warns that a PEO client appearing in the database does not establish that every worker is covered; confirmation with the PEO may be necessary. FEIN is an exact search criterion but is not listed among exported fields. No DBPR credential, Sunbiz document number, or stable DFS employer identifier is exposed by the documented export.

Coverage is a carrier-reported policy fact. Cancellation or expiration dates are period facts, not automatic findings of noncompliance. A search miss means only that no record matched the chosen search criteria and available history; it must never be rendered as “uninsured,” “illegal,” or “non-compliant.”

## Exemption contract discovered

The official result schema is: Last Name; First Name; Middle Inital (official spelling); Suffix; Effective Date; Expiration Date; Employer Name; Employer Address; Exemption Type; Scope of Business.

The grain is an individual corporate officer or LLC member's exemption for an employer and period. DFS explains that exemptions are issued to the officer/member, not the business. The exemption search accepts FEIN but does not display FEIN, a certificate number, entity ID, status field, phone, email, or website in the result schema. Historical and current exemptions are included.

An exemption means the officer/member is excluded from employee status under workers' compensation law and cannot recover benefits under that exemption. It is not wrongdoing and does not establish that the employer lacks required coverage for other workers. Person, officer, employer, policyholder, licensed business, qualifier, and contractor must remain distinct identities.

## Identity and contact safety

No safe production identity partition can be computed from a complete official cohort because a reproducible bulk cohort was not obtainable and the public result schemas omit the authoritative FEIN/certificate identity needed for linkage. DBPR credentials are absent. If an authorized DFS extract includes FEIN, exact normalized FEIN may support entity-level identity after uniqueness/collision validation against Sunbiz; it must not automatically become a contractor-profile link. Name, address, phone, substring, fuzzy, and numeric-core matching are prohibited.

Coverage exposes an employer phone and business address; exemptions expose an employer address and public officer/member name. Each legitimate business contact can later be stored as a separate provenance-bearing observation. Exemption-holder home addresses, personal phones/emails, and other personal data must be excluded or quarantined and must never overwrite canonical business contacts.

## Storage and provenance prerequisite

`discipline_actions` is not appropriate. Use dedicated `workers_comp_coverage` and `workers_comp_exemptions` records (or an equivalently typed non-adverse regulatory-status model). Model policyholder/employer/entity and exemption-holder/officer relationships explicitly. Do not derive a contractor relationship from an entity or license association.

Migration 009 cannot be reused unchanged: `regulatory_source_observations.discipline_action_id` is mandatory. STATE-005A should narrowly generalize provenance ownership with a typed evidence/subject reference or introduce dedicated immutable observation ownership for the two new tables, while preserving every existing discipline observation and occurrence unchanged. Coverage and exemption source-field contracts must be finalized only after receipt of the official bulk data dictionary.

Exact source rows should produce one immutable observation. The same row in a genuinely new snapshot produces only a new occurrence. An unchanged file/checksum is a no-op. A material change produces a new observation in revision review; disappearance retains history and triggers review, never deletion.

## Refresh and publication

After a stable extract exists, evaluate weekly refreshes for operational current-state value, with monthly as the conservative fallback. Retain the five-year policy history and all available exemption periods. Review historical extract checksums quarterly.

Initial `PUBLIC_ELIGIBLE` is zero and scoring impact is zero. Future approved wording may say “Workers' compensation coverage listed by Florida DFS” or “Workers' compensation exemption listed by Florida DFS,” with source retrieval and effective/expiration context. Do not say safe, insured, uninsured, compliant, or violation without a separately approved legal/source contract.

Consumer value is high for a carefully dated current coverage listing, coverage period, exemption listing, and exemption expiration; medium for carrier and reliable history; high for authoritative entity identifiers; and low for contact enrichment relative to identity/status facts.

## Production reconciliation

The read-only, repeatable-read audit found 21,420 discipline actions: 19,827 Florida (`6,457` licensed discipline, `11,691` ULA, `1,679` Recovery Fund), 459 Arizona, and 1,134 New Jersey. Observations and occurrences are 19,827 each; ingest batches are 61; `PUBLIC_ELIGIBLE` is zero. Core counts are 1,392,730 contractors, 1,266,214 licenses, 6,487,585 entities, and 281,255 contractor-entity relationships.

Recovery Fund remains EXACT 75, DETERMINISTIC 29, REVIEW_REQUIRED 342, UNRESOLVED 1,233, with 104 linked rows across 49 licenses and zero contractor links. STATE-005 made zero production, identity, contact, publication, or scoring mutations.

## Next task

CTH-FL-STATE-005A should design the non-disciplinary workers-comp/exemption data model and generalized immutable provenance contract, while an official DFS bulk/public-records request establishes the actual schemas, counts, identifiers, checksum-able source corpus, and identity partition.
