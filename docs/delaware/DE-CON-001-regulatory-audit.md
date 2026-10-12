# Delaware construction credentials audit (DE-CON-001)

Checked: 2026-10-12. Scope: statewide business registration and professional construction/trade license sources only. No county or municipal licensing.

## Existing coverage

- Existing repository audit found no Delaware-specific ContractorTrustHub state route or Delaware state trade dataset. The existing credential lookup and other state registries remain untouched.
- Current source rows acquired for publication: none. The Department of Labor public registry returned 518 search results during the live source check; this interface count is an observation, not a downloaded or preserved roster and is not asserted as distinct entities.

## Source classes and disposition

| Grain | Authority/source | Clock and status |
| --- | --- | --- |
| Registered construction-service business/certificate | [Office of Contractor Registration public lookup](https://contractorregistry.delaware.gov/Certification_PublicLookup?f=name&t=j) | 518 live results observed 2026-10-12. Certificate and business are source rows; distinct entity count not reconciled. |
| State construction-service business requirement | [Delaware One Stop](https://onestop.delaware.gov/Operate_Contractors), [Delaware Code, Title 19, Chapter 36](https://delcode.delaware.gov/title19/c036/index.html) | Requirement applies before construction services; registration is not the same as a trade professional license. |
| Electrician/person and inspection-agency classes | [Board of Electrical Examiners](https://dpr.delaware.gov/boards/electrician/), [DPR license-roster instructions](https://dpr.delaware.gov/aboutagency/roster_request_insts/) | Current rows not acquired; board provides a separate profession roster service. |
| Plumbing and HVACR person classes | [Board of Plumbing, Heating, Ventilation, Air Conditioning and Refrigeration Examiners](https://dpr.delaware.gov/boards/plumbers/), [DPR license-roster instructions](https://dpr.delaware.gov/aboutagency/roster_request_insts/) | Current rows not acquired. |

## Reconciliation and publication

No contractor certificates or DPR license rows were imported. The live registry result count remains attached to its source clock and is not combined with license rosters, complaints, disciplinary actions, business-tax licenses, or local permits. The state page states the public registry scope and acquisition limits. NOT_ACQUIRED does not mean zero.
