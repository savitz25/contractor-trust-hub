# TRUSTHUB_INTELLIGENCE_OS_V1.1

**Network alignment specification — spec only.**

| Field | Value |
|---|---|
| Version | V1.1 |
| Status | **APPROVED** |
| Kind | Alignment contract. Not an implementation task. |
| Does not modify | Production, visual chassis, Senior, Contractor, Lender county, any Hub rebuild |
| Lender INTEL-004 | **READY WITH CONDITIONS** |

This document freezes reusable Intelligence OS rules discovered in Production. It is the inheritance contract for Lender, Insurance, Move, Investor, and future state/county Intelligence OS work.

Do not copy Senior or Contractor literally. Do not reintroduce scores or directories as the product. Do not repeat grain, denominator, pending-data, directory-SSR, or fingerprint mistakes from the first Production implementations.

---

## 0. Purpose

`TRUSTHUB_INTELLIGENCE_OS_V1` is **proven** by three live Production experiences. V1.1 does **not** redesign those products. V1.1 **freezes operating rules** before wider network rollout.

### Reference implementations (do not modify in this task)

| Reference | URL | Production SHA |
|---|---|---|
| SeniorTrustHub National | https://www.seniortrusthub.com/ | `ee62e1f234c6f9767ffa198b07b602149061ada8` |
| ContractorTrustHub Florida | https://www.contractortrusthub.com/florida | `929e18c4284f0327d807cf35ab424149f4da071e` |
| ContractorTrustHub Broward | https://www.contractortrusthub.com/florida/broward | `929e18c4284f0327d807cf35ab424149f4da071e` |

Same operating system. Different specialist applications.

---

## 1. North star

```text
INTELLIGENCE IS THE PRODUCT.
GEOGRAPHY LETS CONSUMERS EXPLORE IT.
TOOLS HELP THEM ACT.
PROFILES LET THEM INVESTIGATE IT.
SOURCES LET THEM VERIFY IT.
THE CONSUMER DECIDES.
```

A specialist Hub must feel like **the same operating system** and **a different specialist application**.

### Core consumer journey

```text
UNDERSTAND → EXPLORE → LOCALIZE → INVESTIGATE → COMPARE → ACT → SAVE
```

Not every level must exist on every page. Directory cards must **not** become the default worldview.

---

## 2. Required page layers

Mandatory conceptual hierarchy on Intelligence OS pages:

1. Intelligence Hero
2. State / Market / County of the Record
3. Featured Findings or equivalent analytical interpretation
4. Evidence Depth
5. What We Don't Know
6. Explore by Place and/or Specialist Axis
7. Ask the Market / Structured Questions
8. Use the Research
9. Sources / Limitations

Optional when defensible:

- Trace This Number
- Compare This Market
- What Stands Out
- Research Checklist
- Evidence Journey
- What Changed — **only** when immutable historical source snapshots support it

### Hero contract

Canonical hero grammar:

| Slot | Role |
|---|---|
| A | Specialist / geographic context |
| B | Evidence-first proposition |
| C | Consumer-decision statement |
| D | Primary CTA: understand / explore intelligence |
| E | Secondary CTA: research / verify a named entity |
| F | Optional lookup, if discovery is neutral and does not dominate intelligence |

Do not require identical copy across Hubs. Do not flatten vertical personality.

### CTA order

1. EXPLORE / UNDERSTAND
2. RESEARCH / VERIFY
3. TOOLS / ACTION

Do not lead Intelligence OS pages with Get Quotes, Find the Best, Compare Top Providers, ZIP-directory cards, calculator walls, or lead forms.

---

## 3. Record / entity / observation / finding grammar

| Term | Meaning |
|---|---|
| **Record** | A source row or source-record unit |
| **Entity** | A resolved canonical identity |
| **Observation** | A collected evidence record in the research graph |
| **Finding** | A public analytical or disposition-gated statement supported by evidence |

```text
records ≠ entities ≠ observations ≠ findings
```

Totals of records or observations must never automatically become bad-actor counts, violation counts, provider counts, or company counts.

### State of the Record vocabulary

Shared concepts, each optional only where not defensible:

- Universe
- Current
- Observations
- Geography
- As-of

Every metric must expose its **actual grain** beneath or around the number. Examples of grains: provider identities, credentials, institution identities, applications, complaint observations, regulatory observations, permits, ownership relationships.

Do not force all Hubs into one record grain.

### Credential safety

A credential is not automatically an entity.

```text
contractor credential  ≠  contractor company
NMLS credential        ≠  lender institution
state license          ≠  branch  ≠  person/MLO
```

Every Hub must preserve actual source grain.

---

## 4. Trace contract

Trace is required when a major public number benefits from source/grain explanation.

Trace must be click / touch / keyboard accessible. Not hover-only.

Minimum fields:

- Agency / source
- Dataset
- Metric definition
- Record grain
- Calculation / method
- Official as-of / source period
- Retrieved date
- Known limitations
- Source / open-source path where available

If a number is composite: show exact decomposition and prove components sum to the displayed total.

### Trace optionality

Do **not** create fake Trace merely to satisfy a component checklist.

| Proven | Rule |
|---|---|
| Senior can Trace directory totals | Trace when the number is real |
| Contractor Florida can Trace 68,081 observations | Trace when the grain is real |
| Broward omits county-enforcement Trace | No public county-wide enforcement census exists |

Network rule: **TRACE WHEN THE NUMBER AND SOURCE GRAIN ARE REAL.**

---

## 5. Explain contract

Every major Intelligence OS chart must have an explanation contract.

Canonical questions:

1. What am I looking at?
2. Why might this matter?
3. What does this NOT mean?
4. Source
5. Official period / as-of
6. Retrieved

Interaction must support mouse, touch, keyboard, and screen reader. No critical meaning through hover only.

---

## 6. Finding contract

Canonical finding types: **BENCHMARK**, **GAP**, **CHANGE**.

| Page | Count |
|---|---|
| Homepage | **Exactly 3** |
| State | 3–5 maximum |
| County | Optional if a strong parent comparison / What Stands Out module already performs the analytical job |

CHANGE is prohibited unless immutable historical evidence supports a deterministic comparison.

### Snapshot ≠ finding

Numbers such as 14,690 nursing homes, 143,516 contractor credentials, or 11.5M HMDA applications are **snapshots**. They become findings only when interpreted through comparison, composition, benchmark, change, gap, or another reproducible analytical frame.

Do not turn every metric card into a story.

---

## 7. Evidence depth vocabulary

Bounded vocabulary:

- Strong
- Partial
- Limited
- Enhanced in selected geographies
- Unavailable
- Not yet researched
- Requested / pending

Use percentages only when a defensible denominator exists.

Evidence depth means **how much research evidence is available**. It never means provider quality, company quality, safety, trustworthiness, or recommended status.

---

## 8. Missingness contract

Every Intelligence OS page needs visible missingness.

Canonical heading may be *What We Don't Know*, *What the Data Doesn't Show*, or *Limits of the Research*. The concept is mandatory.

Examples:

- no record found ≠ clean history
- address ≠ service area
- missing local export ≠ zero local activity
- unknown ownership ≠ independent ownership
- unattached complaint ≠ invalid complaint
- active license ≠ endorsement

### Missing ≠ zero (hard rule)

These states are distinct:

1. ZERO OBSERVED IN COMPLETE SOURCE
2. UNAVAILABLE
3. NOT YET RESEARCHED
4. REQUESTED / PENDING
5. PARTIAL COVERAGE
6. UNRESOLVED

Never convert any of the latter five into numerical zero.

---

## 9. Geography contract

Geographic exploration must use **neutral** semantics.

Allowed map / color concepts: record volume, credential volume, application volume, origination volume, research depth, official factual rate with valid denominator.

Prohibited: quality, risk, best, safest, most trusted, recommended.

Every map requires an explicit legend and an accessible list / table fallback.

### Address / location safety

```text
address / HQ / base county / license address / branch address
≠
service area / operating territory / jobs completed there / consumer availability
```

Only a source that explicitly proves a geographic operating relationship may support such wording.

---

## 10. Market Compare contract

Contractor is the reference implementation.

Compare This Market is allowed only when definitions, periods, source families, grains, and denominators are compatible.

Rules:

- no blank calculable cells
- no zero for unavailable data
- no comparison of local permit subsets against a state licensing census as equivalent measures

### Accessibility

Caption, row/column headers, scope semantics, keyboard-accessible interaction, touch-accessible interaction, bounded internal horizontal scroll where necessary, no whole-page overflow.

### What Stands Out

Optional deterministic analytical layer. Statements must be directly reproducible from displayed measures.

Allowed: *Broward has a larger roofing credential share than the statewide mix.*

Not allowed: *Broward is safer. Broward has better contractors. This market is riskier. This lender is stronger.*

No causal interpretation unless independently supported.

### Primary + secondary exploration axis

| Axis | Role |
|---|---|
| Primary | Place |
| Secondary | Vertical class / product / type |

Examples: Contractor place + trade; Senior place + care class; Lender place + institution/product type; Insurance place + line/product; Move place + mover/service class; Investor place when meaningful + adviser/entity/service class.

Do not invent a second axis unsupported by source taxonomy.

---

## 11. Ask grain contract

Canonical V1: **4–7** structured questions on home/state pages. County pages: **2–4** optional questions where useful.

Answers must come from payload, methodology, existing routes, or existing structured modules. No unsupported generative causal analysis.

### Ask grain QA — V1.1 hard gate

Every Ask answer containing a metric / category MUST reference the **same** source, grain, category definition, numerator, and denominator as the chart/table it explains.

No duplicated manual taxonomy in Ask copy.

Known reference defect — **do not copy**:

| Wrong | Correct |
|---|---|
| Contractor Florida Ask: roofing = CCC + RR | Roofing comparison/trade definition = **CCC + RC**. RR is Residential. |

Future implementations must derive quantitative Ask responses from the **same typed payload/helper** used by the corresponding chart.

---

## 12. Tool / directory role

```text
DIRECTORY     = browse / archive / discovery
INTELLIGENCE  = explanation / context
PROFILE       = entity investigation
TOOLS         = consumer action
```

Tools come **after** intelligence. Tool cards are ways to act on research, not the primary product identity. Only surface working tools. No dead / future CTAs.

Do not allow directory UX to replace Intelligence OS hierarchy.

### Directory deferral — V1.1 hard rule

Never SSR a large entity directory inside the default Intelligence OS route when it materially harms response performance.

Reference lesson: Contractor Broward default page improved from ~20s to ~50–250ms TTFB after directory SSR was deferred.

Canonical hierarchy: Intelligence page → directory disclosure / separate route / on-demand fetch. Directory remains available. It does not own the initial server response.

---

## 13. Checklist contract

Canonical network implementation: **consumer due-diligence progress**.

Recommended visual: **N of M** evidence areas reviewed. Allowed: *4 of 6 research areas reviewed.*

Never: 67% Trust Score, provider quality score, contractor quality score, research score applied to a provider.

---

## 14. Evidence Journey contract

Conceptual flow:

```text
official identity
  → credential / class
  → relationships
  → ownership / corporate identity where relevant
  → observations
  → local / activity evidence where acquired
  → public profile
```

Supported states: Connected, Partial, Unavailable, Review/conflict, Where available, Where acquired.

No internal candidate identities.

---

## 15. Source / freshness contract

Minimum source metadata:

- Agency / source
- Dataset
- Official period / as-of
- Retrieved
- Definition
- Record grain
- Coverage
- Known limitations
- Open-source / source-ledger path

No hidden methodology for major claims.

### Freshness language

Preferred: Official as-of, Source year, Retrieved, Last verified.

Avoid: Live, Real-time, Current — unless source cadence actually supports the statement.

### What Changed

**No change story without immutable historical source snapshots.**

`updated_at`, deployment date, page generation date, and cache refresh cannot establish market change. Source refresh and market change are different concepts.

---

## 16. Payload / fingerprint contract

Canonical conceptual families:

- `*-home-intel-v1`
- `*-state-intel-v1`
- `*-county-intel-v1`

Required conceptual top-level structure:

```text
metadata
snapshot
findings
evidenceDepth
geography
ask
tools
sources
limitations
changeCapability
```

Optional: comparison, exploration, evidenceJourney, checklist.

### Home payload

Required: metadata, snapshot, **exactly 3 findings**, evidenceDepth, geography, ask, tools, sources, limitations, changeCapability.

Optional: comparison, second axis, checklist, journey.

### State payload

Required: metadata, snapshot, 3–5 findings where appropriate, evidenceDepth, geography, ask, tools, sources, limitations, changeCapability.

Optional: comparison, second exploration axis, journey, checklist.

### County payload

Required: metadata, snapshot, evidenceDepth, parent-geography comparison where possible, tools, sources, limitations, changeCapability.

Optional: findings, geography/municipal layer, Ask, journey, checklist, second axis.

County pages must explain **how this market differs from its parent**, rather than act as a directory shell.

### Canonical fingerprint

Every Intelligence OS payload must support deterministic canonical hashing.

- Use deterministic serialization.
- Exclude / normalize volatile runtime fields: `generatedAt`, request timestamp, cache timestamp, deployment timestamp, `timedOut` where it is runtime-only.
- Include source evidence metadata that actually defines the snapshot.
- Unchanged evidence → same canonical fingerprint.

Fingerprint **support** is mandatory. Public **display** is optional. The fingerprint exists for reproducibility, QA, source-state reconciliation, and change detection.

---

## 17. SSR / performance contract

Primary Intelligence OS content must be server-rendered / pre-rendered.

Initial HTML must contain: H1, snapshot, core findings/content, missingness, sources.

Do not ship `Loading intelligence...` as the crawlable primary page.

### Performance

Do not deliver raw source universes to the browser. Examples: no 143k credentials client-side, no 68k regulatory rows client-side, no millions of HMDA applications client-side.

Use bounded aggregate payloads, server calculation, precomputed projections, cache/materialization where appropriate, and small client islands.

### Client island rule

Hydrate only genuine interaction: map, filters, compare, checklist, small explorers.

Do not convert the entire Intelligence OS page into a client component.

---

## 18. Accessibility / mobile contract

Required:

- one H1
- skip link
- semantic hierarchy
- 44px interactive targets
- keyboard-accessible Trace / Explain / Ask
- visible focus
- chart text equivalents
- no color-only meaning
- accessible tables
- screen-reader labels
- no keyboard trap
- reduced-motion support as relevant

Mandatory mobile QA: **390 / 360 / 320**.

Tables may internally scroll. Pages may not. Use progressive disclosure. Do not stack enormous geographic / card inventories by default.

---

## 19. SEO / thin-page contract

Index a state/county page only when it has substantive SSR intelligence.

Minimum substance: clear H1, meaningful snapshot, evidence/missingness, source/limitations, actual geographic or analytical value.

Do not mass-index directory-only county pages, empty location shells, or metadata-only municipality pages.

**No thin-page factory.**

---

## 20. Score / ranking standard

Network-wide prohibition:

- NO Trust Score
- NO Research Score applied as provider quality
- NO provider score
- NO contractor score
- NO lender fairness score
- NO risk meter
- NO best / top recommendation layer

Descriptive order by volume, activity, or record count may exist when **explicitly labeled as such**. It must never imply recommendation.

### Legacy language

New Intelligence OS implementations must not reproduce old network concepts such as Trust Score, Research Score, County Experience Score, unsourced close-time claims, or best/top provider.

Existing legacy routes may be handled in bounded cleanup tasks. Do not silently mix scoring worldview into new homepage CTAs.

---

## 21. Visual consistency vs vertical personality

`TRUSTHUB_VISUAL_STANDARD_V1` remains frozen.

Same network: interaction grammar, source treatment, Trace, Explain, coverage, missingness, information hierarchy, accessibility behavior.

Vertical-specific: color, voice, terminology, chart selection, specialist exploration.

**Same OS. Different specialist application.**

---

## 22. Count / Share / Rate rule

Lender uniquely adds COUNT / SHARE / RATE where denominator-safe.

Before displaying RATE, require:

1. same record universe
2. same period
3. same product scope
4. same geography where relevant
5. compatible attribution
6. defensible exposure denominator

If invalid: **omit Rate**. Count and Share may still be valid.

Do not manufacture sophisticated-looking ratios from incompatible sources.

---

## 23. Network component taxonomy

Conceptual components. **No requirement yet for one shared code package.**

### Network core

IntelligenceHero, StateOfRecord, TraceNumber, FeaturedFinding, ExplainChart, EvidenceDepth, EvidenceGap, GeoExplorer, MarketCompare, AskMarket, ResearchChecklist, EvidenceJourney, SourceLedger, Limitations, CountShareRate.

### Vertical extension

Specialist charts, specialist taxonomies, specialist evidence families, specialist tools.

### Page-specific

Individual geography comparisons, individual lookup/directory disclosure, individual source-specific modules.

---

## 24. Senior reference lessons

**Keep:** homepage discipline, exactly 3 featured findings, strong missingness, class separation, not-a-ranking language, process checklist, structured Ask, Evidence Journey.

**Do not copy onto unrelated Hubs:** CMS-specific class model, ownership semantics, care terminology.

---

## 25. Contractor reference lessons

**Keep:** Market Compare, parent-child geography comparison, second exploration axis, research-depth distinction, pending ≠ zero, deterministic What Stands Out, directory deferral, canonical payload fingerprint.

**Do not copy onto unrelated Hubs:** trade codes, permit taxonomy, DBPR regulatory families.

---

## 26. Lender contribution

Lender INTEL-004 inherits V1.1 and uniquely adds:

- COUNT / SHARE / RATE where denominator-safe
- HMDA action / outcome literacy
- Institution identity vs activity
- Complaint-as-evidence literacy
- Market composition
- Financial comparison discipline

```text
Institution research  ≠  actual loan-offer economics
```

---

## 27. Lender INTEL-004 conditions

Lender INTEL-004 may proceed after this spec is accepted under these conditions:

1. **National homepage only.** No county work.
2. HMDA grain must remain exact.
3. Ask metrics must derive from the same payload grain as charts.
4. CFPB complaints must remain observations, not violations.
5. OFR enforcement must remain separate from HMDA and complaints.
6. Address / HQ must not become service territory.
7. Do not SSR the full `/lender` search directory on the homepage.
8. Legacy Trust Score / Research Score destinations must not be featured as new Intelligence OS CTAs.

Approved stories (do not rerun broad discovery unless a source/count changed):

1. Institution composition
2. HMDA 2025 application / origination / denial evidence
3. CFPB complaint attachment gap

---

## 28. Future Hub applications

### Insurance

Inherit: State of Record, Evidence Depth, What We Don't Know, geography, Compare Market, line/product second axis, Trace, Ask, directory secondary.

Do not infer county service authorization from address or appointment metadata unless source semantics support it.

### Move

Inherit: market intelligence, state/county comparison, service/provider class axis, regulatory evidence trace, local permit/business evidence where applicable, directory secondary.

Do not turn headquarters location into service area.

### Investor

Inherit: federal entity/registration intelligence, entity-class exploration, geography where meaningful, Evidence Depth, ownership/affiliation graph, regulatory evidence, Trace, Ask.

Do not create performance / adviser quality rankings from research depth.

---

## 29. V1.1 implementation checklist

Every future INTEL task must answer before Production:

| | Question |
|---|---|
| A | What is the source grain? |
| B | What is the entity grain? |
| C | What are observations? |
| D | What are findings? |
| E | What is missing? |
| F | Which rates have valid denominators? |
| G | Which geography semantics are factual? |
| H | Does Ask use the same grain as the chart? |
| I | Is every major chart explained? |
| J | Can major totals be traced? |
| K | Is directory secondary? |
| L | Is primary content SSR? |
| M | Is payload deterministic? |
| N | Are volatile fields excluded from hash? |
| O | Is 390 / 360 / 320 clean? |
| P | Is accessibility tooling executed? |
| Q | Are scores / rankings absent? |
| R | Are sources dated and limited? |

---

## 30. Follow-up register

Record. **Do not implement in this task.**

| ID | Item | Notes |
|---|---|---|
| A | Contractor Florida Ask roofing copy: CCC+RR → CCC+RC | Must **not** be copied. Does not invalidate INTEL-003. Correct before that Ask is used as a network copy source. Do not expand into INTEL-003 redesign. |
| B | Contractor Florida CLS: investigate shared chassis / font behavior | Chassis follow-up. Do not reopen INTEL-003. |
| C | Contractor Broward: optional future Explain on category bars | Optional. |
| D | Contractor Broward: optional 2–4 Ask questions | Optional. |
| E | Contractor checklist: normalize to N-of-M pattern later | Later. |
| F | Senior: optional public fingerprint display | Optional. Fingerprint support already required. |

These do not block Lender INTEL-004 except **A must not be copied**.

---

## 31. Decisions

| Decision | Result |
|---|---|
| `TRUSTHUB_INTELLIGENCE_OS_V1.1` | **APPROVED** |
| Lender INTEL-004 | **READY WITH CONDITIONS** |

### Recommended next task

**INTEL-004 — LENDERTRUSTHUB NATIONAL HOMEPAGE**

Using the already approved three stories. National homepage only. No Lender county work. Do not rerun broad discovery unless a source/count changed.

---

## Success standard

V1.1 succeeds when the reusable Intelligence OS rules are explicit enough that Lender, Insurance, Move, and Investor can inherit the same operating system without copying Senior or Contractor literally, without reintroducing scores/directories as the product, and without repeating the grain, denominator, pending-data, directory-SSR, or fingerprint mistakes discovered during the first Production implementations.
