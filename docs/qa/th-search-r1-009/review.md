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
