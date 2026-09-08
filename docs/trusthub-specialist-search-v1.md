# Trust Hub Specialist Search V1

Status: Contractor reference contract. Audit date: 2026-09-08.

## Network audit

| Hub | Entry and input | Identifiers / natural language / filters | Results and evidence | Empty, freshness, order, mobile, analytics | Preserve / normalize |
|---|---|---|---|---|---|
| Ask | `/`, network Ask routes; question-first input | Routes questions across specialist domains; network intent | Specialist handoff cards and bounded network context | Explicit limitations; responsive shared shell; route analytics | Preserve orchestration; normalize specialist handoff vocabulary |
| Move | `/`, company/directories and DOT verification; company, USDOT, MC, place | Strong identifier/name and place lookup; domain-specific FMCSA semantics | Carrier identity, authority/safety/evidence links | Source-aware no-match; deterministic directory order; mobile verifier | Preserve DOT/MC resolution and location ambiguity; adopt shared interpretation/trace shell |
| Lender | `/`, lender directory/research; lender name/NMLS | Identifier/name plus state/product research | Institution identity and NMLS/CFPB/HMDA evidence | Coverage-aware empty state; non-quality research ordering; responsive search | Preserve institution vs branch/MLO boundaries; replace score-like search chrome with shared evidence anatomy |
| Insurance | `/`, insurer directory and ZIP/product entry | Directory/ZIP/product rather than universal natural language | Legal insurer identity and regulatory/product evidence | Coverage varies by source/product; directory ordering; responsive | Preserve legal-insurer identity and ZIP/product meaning; adopt shared question/interpretation states |
| Contractor | `/ask`, `/search`, `/verify`; question, company, license, trade/place | Deterministic ontology plus structured query and exact identity search | Credential profiles, regulatory evidence and Trust Reports | Explicit missing-not-zero rules; alphabetical/source-backed order; mobile-safe; limited analytics | Keep deterministic engine; unify entry shell, interpretation, card anatomy, trace, capabilities and analytics |
| Senior | search routes and facility lookup; name, CCN, state/provider class | Structured facility/CCN/provider search | CMS/source facility identity and care evidence | Explicit source coverage and freshness; neutral order; responsive | Preserve CCN and provider-class semantics; adopt shared shell/trace |
| Investor | `/ask`, `/research`, firm directory; firm/CRD/SEC/state | Deterministic firm query and identifier parsing | Firm identity, registration and source-backed evidence | Fail-closed limitations; neutral ordering; responsive cards | Preserve firm-not-person boundary and CRD/SEC semantics; adopt shared interaction contract |

Across the seven surfaces, the principal inconsistency is not the data model; it is the interaction vocabulary. Inputs alternate between “search,” “verify,” directories and Ask, while interpretation, result reasons, traces and unavailable-data states are uneven.

## Shared network behavior

Every specialist implementation should provide:

1. a question-first search region with one bounded text/identifier input and one `Research` action;
2. example prompts and a collapsible, domain-valid advanced-filter area;
3. a visible structured interpretation that can be refined without retyping;
4. result cards answering identity, why matched, evidence available and source timing;
5. `Trace this result` with source, match, geography/status rules, coverage and limitations;
6. explicit `KNOWN`, `UNKNOWN`, `PARTIAL`, `NOT_ACQUIRED`, `REQUEST_ONLY` and `UNSUPPORTED` capability states;
7. neutral relevance ordering, never provider quality/ranking;
8. no-match, partial-coverage, unavailable and identifier-not-found language that never turns missing data into zero;
9. accessible keyboard/touch behavior and layouts from 320px upward;
10. normalized privacy-safe analytics without raw questions or exact entity identifiers.

The canonical TypeScript reference is `lib/specialist-search/contract.ts`. Search result pages remain `noindex,follow`; profile pages retain their own indexing contract.

## Domain adapter boundary

Adapters own ontology, identifier syntax, entity classes, regulator vocabulary, geography meaning, available filters, source queries, evidence joins, freshness and profile detail fields. The shared layer must never coerce unlike concepts: a contractor license is not an NMLS record, CCN, CRD or FMCSA authority.

Natural language may interpret. Only structured, parameterized domain execution establishes facts. Match reasons are constructed from fields actually applied by the plan/executor, not generated prose.

## Contractor reference implementation

The canonical experience is `/ask`. It retains the `interpret → plan → execute` architecture. Exact credential lookup precedes bounded normalized entity-name search, which precedes classification/geography/evidence execution. Existing `/verify` remains the deep exact-identity utility and existing `/search` remains backward compatible; homepage entry now submits to `/ask` so it no longer owns a separate interpretation path.

Florida supports the richest cohort/evidence execution. Other state questions retain the existing state-specialist executor and coverage boundaries; unsupported intersections are described rather than broadened. Page size is 24, page is bounded, query input is capped at 180 characters, filters are allowlisted, and database statements remain parameterized with timeouts.

## Epistemic rules

- Recorded address is not service territory.
- A credential record is not endorsement or company identity by itself.
- Permit evidence is local and is not a quality signal.
- A complaint is not wrongdoing; no complete complaint dataset means “not acquired,” not zero.
- A citation, notice, or stop-work row is not necessarily a current or final violation.
- Name similarity is a candidate identity match, not proof.
- No result is ordered or described as best, safest, cheapest, recommended, or highest quality.

## Porting checklist

Reuse the contract and anatomy, not Contractor runtime code. Implement a local adapter, publish its capability matrix, map its identifiers and ontology, generate structure-derived match reasons, validate filters server-side, add at least 50 domain questions, and verify the shared responsive/accessibility/analytics contract.
