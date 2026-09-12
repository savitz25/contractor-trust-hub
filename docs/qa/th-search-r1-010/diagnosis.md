# TH-SEARCH-R1-010 diagnosis and scope

Baseline: `88075e4de4aac53a83a2235dd524d6e93fc46235`, fetched from verified `savitz25/contractor-trust-hub`. Isolated task and detached baseline worktrees were created. No applicable AGENTS.md or visible overlapping R1-010 assignment was found. NYC PR #60 and every other worktree were left untouched.

Builder model: prior user-confirmed GPT-6 Astra. This ticket recommends Medium reasoning. Running-session model/reasoning metadata and a switch control are unavailable to this builder; no independent confirmation or actual switch to Medium is claimed. No settings, credits or approval controls were changed. The official-source questions below did not expose an unresolved regulatory-data conflict requiring escalation.

## Reproduction before changes

The unchanged source fails all five new behavioral reproductions (`isolated-baseline-red.log`). `baseline-browser.json` records settled canonical Production before-behavior, with zero provider cards in those cases:

- Florida how-to: the generic interpreter cannot map the question, despite displaying an applied Florida geography.
- Texas GC policy: `/ask` chooses `/search` and returns unsupported TAC trade capability instead of answering the policy question.
- Hiring tomorrow: the geography parser interprets `for tomorrow` as an unresolved place. No transaction boundary is explained.
- Alaska elevator: Alaska survives, but elevator is not retained as a trade/equipment context and there is no relevant official recovery.
- Los Angeles/CA: R1-009 already preserves Los Angeles correctly. The remaining defect is missing useful jurisdiction-specific recovery, not missing geography on fresh main.

The common route selector only distinguishes existing discovery and identity paths. There was no non-cohort guidance operation in the interpreted/executed contract. A generic Verify hint did not carry a supported jurisdiction-specific action.

## Targeted implementation

Keep interpret -> plan -> execute -> rendering. A `guidance` mode carries a typed recovery operation (verification guidance, regulatory explanation, transaction boundary or unsupported-jurisdiction research). Both canonical routes consult the same non-cohort classification. The executor returns no provider retrieval/count for this mode. Recovery rendering bypasses generic directory facts; it does not log a completed zero-result retrieval.

Identity, ranking and existing NY/IL operations retain precedence. R1-009 geography extraction/execution is unchanged. Transaction continuation removes only the transaction/timing wording, preserves typed filters and enters the existing research path after an explicit action. A typo or unsupported city still requires R1-009 consent/clarification. No California cohort executor was added: California Verify is a separately labeled identity lookup, not state broadening.

## Official source matrix

| Jurisdiction | Official source | Scope and boundary |
| --- | --- | --- |
| FL | DBPR Verify a Licensee | DBPR-regulated professions/businesses; not every Florida trade. Electrical is not represented as a CILB cohort. |
| TX | TDLR Active License Search | Active specialty credentials, not GC or all boards. |
| TX | Austin Development Services, Contractor Registration | Supports the no-state-GC-license explanation; municipal registration instructions apply only to Austin. |
| CA | CSLB Check A License | Name/credential verification; not Los Angeles service territory or availability. |
| AK | Labor and Workforce Development, Mechanical Inspection elevator page | Equipment requirements/inspection contacts, including Anchorage distinction; not a contractor-license approval. |

All five destinations were opened independently via the web tool and in a real browser on 2026-09-12. See `official-sources.json` for exact URLs, agencies, purposes, restrictions and the manifest fingerprint; `official-browser.json` records HTTP 200, purpose visible and no challenge for all five. No forms were submitted. No provider-specific deep link was invented. The check date is a guidance/link review date, not a provider-status source date.

## Protected behavior and known limits

Only Contractor code and ticket QA are changed. No data/schema/index writes, ingestion, paid resource, external redirect parameter or new raw-query analytics. Existing Verify uses its supported `state` parameter; unknown states never fall back to Florida through a generated recovery action.

The first full regression run caught new interception of an existing NY certificate question. This was repaired by preserving the original NY/IL interpreters, with the unchanged baseline expectation retained. Historical unrelated network-total and homepage-heading assertions are compared with the exact detached baseline. Local source-positive checks lack an authorized database credential; they are explicitly skipped locally and require preview/Production proof.

## Fresh-main reconciliation

The owner merged NYC PR #60 at b694663796700f8f95b9c18d144b0a57e64d98ec during this ticket. A normal merge produced tested candidate bb817cb759d48af53397d8472e9bde099059d9bc. No NYC assignment was merged by this builder. Reconciled focused 39/39, R1-009 30/30, npm test (including NYC), typecheck and production build passed. Both old assertion failures also reproduce on detached b694663 (see upstream-baseline logs). Local production-build browser checks passed all 18 cases with database-positive checks explicitly skipped; preview/Production evidence remains required. The browser harness phase classifier was corrected to treat local-reconciled as local; no product source change was needed.
