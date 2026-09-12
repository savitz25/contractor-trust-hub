# Separate review pass

Method: self-review using the React review checklist and full source diff; executable regression/mutation tests provide automated review. No independent human review is claimed.

Reviewed parameterized city+state/county predicates before count/order/limit, source-native TAC/PLB versus FL classes, publication gates, no data writes, no raw-query analytics additions, safe enum/input bounds, correction choice revalidation, and preservation of state/trade/status/evidence through links.

Findings fixed during review/browser work:
- Duplicate select/hidden form fields rejected accepted-correction resubmission. Selects now carry their typed defaults; hidden fields are unique.
- Query edits invalidate old correction/broadening consent. Same-query resubmission preserves accepted consent; browser refresh/history tested.
- City predicates require the source row's state as well as city.
- Count/source failure no longer substitutes page length or a missing count converted to zero.
- Failed source attempts are not memoized, allowing a real retry.

Existing structured V2 response fields/rows remain compatible. TX capability is additive and limited to the already published TAC cohort; direct unknown Texas classes cannot bypass the class guard. No new public identifiers or profiles are created. Existing consumers cannot mistake a blocked local request for a returned cohort because no query/rows execute before consent.

Known unrelated baseline failures: P2 hardcoded network-total assertion and old HomeDiscoverySearch text assertion. Both reproduced in detached baseline. Configured lint absent. Full npm test, customer/claim, FL publication safety and con-cap-002 pass. Local browser positives requiring production DB are not claimed: Vercel marks that credential sensitive and local responses accurately show source unavailable. Authorized preview/production positive proof remains required before release closure.

Preview follow-up findings: label recorded counties explicitly (Dallas County is not Dallas city), attribute TAC to TDLR alone, reject oversized structured location fields instead of dropping them, and treat an invalid source count as source failure. 16 authenticated preview browser cases passed on 3689a48 before these final narrow changes.

Mobile preview exposed a genuine 10-second count statement timeout, retained in preview-mobile-browser.json (not counted as pass). Read-only EXPLAIN showed UPPER(TRIM(occupation_code)) prevented the existing licenses_source_status_occ_idx from applying its class key. The narrow TX path now uses source-native TAC equality and l.state=TX. Independently checked prior-normalized and exact-source active scopes both contain 17,757 records in this source window; no timeout increase, new index, schema write or substituted total. Both read-only plans use existing indexes; planner cost changed from about 27,015 to 541 (estimates, not elapsed timings). Final live retest required.
