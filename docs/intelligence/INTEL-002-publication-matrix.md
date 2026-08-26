# Publication matrix (Gate A × Gate B)

Code: `lib/intelligence/publication-matrix.ts`

`publication_state` is **not** identity confidence.

| Source | Identity for public | Record type | Public? | Consumer label if ever shown |
| --- | --- | --- | --- | --- |
| Licensed contractor discipline | CONFIRMED full occupation + license key | Final order / fine / costs / restitution / suspend / revoke / probation | Eligible **after validation**; default INTERNAL | Board final action (as published) |
| Licensed contractor discipline | CONFIRMED | Complaint / allegation / investigation / unknown | INTERNAL | — |
| Licensed contractor discipline | HIGH CONFIDENCE / REVIEW REQUIRED / UNRESOLVED | Any | INTERNAL | — |
| Licensed contractor discipline | Numeric core only | Any | INTERNAL forever | — |
| Recovery Fund | Same as licensed discipline | Final vs claim/unknown | Same gates | Recovery Fund record (as published) |
| ULA | Default UNRESOLVED (no license number) | Any | INTERNAL | — |
| DFS Stop-Work | Default UNRESOLVED (no FEIN/license) | Any | INTERNAL | — |
| Legacy `contractor_id` without publication_state | Not an authorization | Any | INTERNAL | — |

This phase does **not** flip rows to PUBLIC. Eligible CONFIRMED+final rows stay INTERNAL with `public_eligible` recorded for a later validation job.
