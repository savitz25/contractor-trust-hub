# CONTRACTOR-NAME-PARITY-001 — direct `/ask` company-name search parity

## Defect (Production, ContractorTrustHub main `b947a8e2`)

| Query | AskTrustHub (`www.asktrusthub.com/ask`) | ContractorTrustHub `/ask` (direct) |
|---|---|---|
| `vantage` | ~10 Contractor name candidates (network name-candidate search) | "We could not map that question onto a supported licensing, trade, geography, or indexed-evidence query." |
| `vantage construction` | name candidates | same dead end |
| `vantage construct` | ARC VANTAGE CONSTRUCTION INC, VANTAGE CONSTRUCTION, VANTAGE CONSTRUCTION GROUP (LLC), … | same dead end |

Reproduced 2026-09-23 with `curl` against `https://www.contractortrusthub.com/ask?q=…` (all three forms → dead end) and against `POST /api/specialist-execution/name-candidates/v1` (all three forms → `COMPLETED_WITH_CANDIDATES`, 174–744 ms).

## Root cause

Two different code paths, proven from source:

- **AskTrustHub** → `POST https://www.contractortrusthub.com/api/specialist-execution/name-candidates/v1` (`contractor-name-candidates-v1`, `limit 10`, `hubScope all`) → `lib/specialist-execution/contractor-name-candidates.ts#executeContractorNameCandidates` → shared name core (`lib/contractors/name-search-core.ts`) over **every name-searchable jurisdiction** (FL, TX, NJ, OR, WA, CA, AZ, LA, MS, KY, CO).
- **Direct `/ask`** (`app/ask/page.tsx`) → `lib/ask/interpret.ts#interpretAskQuery` → `lib/ask/plan.ts` → `lib/ask/execute.ts`. The only name path was `mode: "entity"` + `entityQuery`, reachable through (a) `looksLikeCompany` (needs llc/inc/company/group/holdings) or (b) a **case-sensitive** proper-noun regex (`/^[A-Z]…/`, TH-DISCOVERY-PARITY-001A "Roto-Rooter"). An ordinary lower-case name matched neither and fell to the final `fail_closed` dead end. When the entity path *did* run, `executeIdentityLookup` called `searchContractors(lookup, { stateSlug: "fl" })` — **Florida-only Verify search**, not the network-wide name-candidate operation.
- Verify (`/verify`) is a separate page that already uses the shared name core, but only for one selected state at a time.

## Fix (scope: direct `/ask` interpretation + execution + rendering; no matching-semantics change)

1. `lib/ask/interpret.ts`
   - `detectCompanyNameLikeQuery` (case-insensitive): runs only after every structured branch declined (no trade phrase, no evidence family); rejects structured/locative/question wording, non-name lead words, place-only queries, >10 words, names outside the operation's 2–120 character bounds.
   - Legal-entity suffix (LLC/Inc/Corp/Ltd/LLP/PLLC) is name evidence even with a trade word (`123 roofing inc`); organization-form words (company/group/holdings) keep the PARITY-001A rule.
   - `trailingJurisdiction`: a trailing state name/code becomes the operation's own `jurisdiction` constraint (`vantage construction nj` → name `vantage construction`, jurisdiction `NJ`). Lower-case two-letter codes that are English words (in, or, me, co, …) are not treated as states.
2. `lib/ask/execute.ts` — `entityQuery` now executes `executeContractorNameCandidates` **in process** (same operation Ask consumes; `limit 10`, `?page=` continuation up to the operation's 200-row cap; `SOURCE_FAILURE`/`INVALID_QUERY`/`invalid_page` fail closed with a message and Verify continuation). Exact credentials keep the Florida Verify lookup unchanged.
3. `components/ask/AskResults.tsx`, `AskResultCard.tsx` — candidate anatomy: display name, credential number + class, credential jurisdiction + source board, recorded geography with explicit meaning, profile destination, why matched (field/value/method), required disclaimer *"A matching name is not proof that the record is the specific business you mean."*, bounded pagination ("View more candidates"), operation limitations, Verify continuation links.

Precedence: **exact credential → structured trade/geography/status/evidence → company-name search**.

## NJ Vantage forensics (canonical database, read-only)

Query: every `contractors ⋈ licenses` row with `home_state='NJ' OR licenses.state='NJ'` whose normalized display/legal/DBA/licensee/DBA-raw name contains the word `VANTAGE` (thin and slug-less rows included).

| Field | Value |
|---|---|
| Canonical/public name | VANTAGE CONTRACTING & DEVELOPMENT CO. LLC |
| Credential | NJ HIC 13VH11723500 (`external_key` NJ-HIC:13VH11723500) |
| Source system | `nj_dca` (NJ Division of Consumer Affairs) |
| State | NJ (home_state NJ; recorded address Watchung, Somerset County) |
| Status | active (source: Active); class Home Improvement Contractor |
| Slug / profile | `/contractors/nj-nj-hic-13vh11723500-vantage-contracting-development-co-llc` |
| Publishable | yes — `is_thin_profile = false`, slug present, `nj_dca` is NJ's name-searchable source |
| Normalized search name | `VANTAGE CONTRACTING DEVELOPMENT CO` (suffix `LLC` optional) |

It is the **only** NJ row with a VANTAGE name field. There is no NJ "Vantage Construction" record in the corpus.

| Query | Name-candidate operation | Position |
|---|---|---|
| `vantage` (all jurisdictions) | returned | 11th of 40 (page 2 of Ask's 10-row first page; page 1 of a 25-row page) |
| `vantage` (jurisdiction NJ) | returned | 1 of 1 |
| `vantage construction` | **not returned** | every supplied word must begin/equal a source word; `CONTRACTING` ≠ `CONSTRUCTION` |
| `vantage construct` | **not returned** | same rule (`construct` prefixes `CONSTRUCTION`, not `CONTRACTING`) |
| `vantage construction nj` / `… new jersey` | 0 candidates (NJ scope, honest) | — |

Conclusion: **E** — the record's recorded legal name ("Contracting & Development") differs from the remembered form ("Construction"); for the bare name it is **A** (present, beyond Ask's first 10-row page). Not a publishability, normalization, or operation-exposure exclusion. No boost or alias was added.

## Tests

`npm run check:contractor-name-parity-001` → `lib/ask/contractor-name-parity-001.test.ts` (14 tests; real name-core SQL on in-process PGlite fixtures) + `lib/ask/parity-001a.test.ts` (20) + `scripts/test_ask_interpret.ts`. `npm run check:th-search-r1-019b` (21) unchanged.

Pre-existing, unrelated: `scripts/test_ask_prompt2.ts` "P2 snapshot fingerprint is unchanged by Ask plan construction" asserts a hard-coded intel count (644421) that the current snapshot no longer matches (662331); it fails identically on `origin/main`.

## Performance

Name-candidate operation timings observed on Production during reproduction: 174–744 ms (`timing.queryMs`), well inside its own 6 s statement budget. No index, statistics, cache, materialization or timeout change was made.
