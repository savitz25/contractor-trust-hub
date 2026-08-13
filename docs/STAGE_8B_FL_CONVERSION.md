# Stage 8B — Florida Conversion Polish

Increase completion of the Florida homeowner path without new major tools:

**Plan → Scope → Quote/Compare → Verify → Checklist → Contract → Project → Passport**

## Canonical funnel

| Step | Route | Primary next action |
|------|-------|---------------------|
| 1 | `/plan` or `/studios/[slug]` | Build contractor-ready scope |
| 2 | `/tools/scope-builder` | Analyze a quote |
| 3 | `/tools/quote-analyzer` | Compare another bid |
| 4 | `/tools/compare-bids` | Verify shortlist contractor(s) |
| 5 | `/verify` → Trust Report | Analyze a quote from this contractor |
| 6 | `/tools/pre-hire-checklist` | Continue incomplete modules / contract review |
| 7 | `/tools/contract-analyzer` | Create protected project |
| 8 | `/projects/[id]` | Log payment · Mark complete → Passport |
| 9 | `/passport` | Long-term records |

Secondary entries (Verify-first, Address-first) share journey context and tool links.

## Next-action rules

On every major surface:

1. **One primary CTA** (navy, full-width on mobile)
2. **Up to two secondary CTAs**
3. **One continuity link** (save / continue later / account)
4. No equal-weight button grids competing above the fold

Implemented by:

- `lib/funnel/cta-matrix.ts` — CTA specs by surface  
- `components/funnel/NextBestAction.tsx` — shared UI  
- `lib/funnel/journey-context.ts` — cross-tool context  
- `lib/funnel/analytics.ts` — lightweight events  

## CTA matrix (summary)

| Surface | Primary | Secondary |
|---------|---------|-----------|
| Plan / Studio results | Build scope | Analyze quote · Verify |
| Scope Builder | Analyze a quote | Compare · Verify |
| Quote Analyzer | Compare another bid | Verify · Checklist |
| Compare Bids | Verify shortlist | Checklist · Contract |
| Trust Report | Analyze quote | Checklist · Compare |
| Contract Analyzer | Create protected project | Checklist · Trust Report |
| Project dashboard | Log payment / complete | Docs · Alerts |

## Journey context

`localStorage` key `cth-journey-context-v1`:

- entryPath, projectType, scale, zip/city  
- contractorSlug/name, projectId  
- hasScope, hasQuoteAnalysis, hasCompare  

Chip: `JourneyContextChip` in site layout.  
Homepage `HomeContinuity` prioritizes: active project → resume scope/quote → passport → watches → property.

## Analytics events

| Event | When |
|-------|------|
| `entry_path` | Plan/studio results load |
| `scope_created` | Scope saved |
| `quote_analyzed` | Quote analysis run |
| `bids_compared` | Compare run |
| `trust_report_viewed` | Trust next-actions mount |
| `checklist_started` / `checklist_completed` | Checklist |
| `contract_analyzed` | Contract analysis |
| `project_created` | Project create/update from analyzer |
| `project_completed` | Complete prompt |
| `next_action_click` | Primary/secondary next CTA |

Emits: `CustomEvent("cth-funnel")`, optional `dataLayer`/`gtag`, last 100 events in `localStorage`.

## QA path

```bash
npm run test:funnel
```

Manual:

1. Plan kitchen → results → **Build scope**  
2. Save scope → **Use in Quote Analyzer**  
3. Analyze → **Compare another bid**  
4. Compare → **Verify shortlist**  
5. Trust Report → sticky **Analyze quote** / **Checklist**  
6. Contract analyzer → **Create protected project**  
7. Project → log payment → **Mark complete → Passport**  
8. Homepage shows **Continue project** / resume chips  

## Independence (unchanged)

- No “best contractors” / guaranteed hire language  
- Evidence-only Trust Report  
- Educational disclaimers remain on tools  

## Files

| Area | Path |
|------|------|
| Funnel lib | `lib/funnel/*` |
| NextBestAction | `components/funnel/NextBestAction.tsx` |
| Context chip | `components/funnel/JourneyContextChip.tsx` |
| Trust CTA | `components/contractor/TrustNextActions.tsx` |
| Docs | this file |
