# Stage 4 — Protection Layer

**Contract Analyzer · Payment/Lien Tracker · Watch · Project Dashboard**

Educational during-the-job tooling. Not a law firm, not legal advice, not a payment processor, not a guarantee.

## Routes

| Path | Tool |
|------|------|
| `/tools/contract-analyzer` | Contract Analyzer |
| `/projects` | Project list + create |
| `/projects/[id]` | Project Protection Dashboard |
| `/projects/[id]/payments` | Redirect to dashboard payments tab |

## Project model (session v1)

Storage key: `cth-projects-store-v1` (`lib/projects/store.ts`)

```
Project {
  id, title, projectType, status
  address, zip, city, county, propertyId
  contractAmount, contractor*, watchContractor
  milestones[], payments[], documents[]
  contractAnalysisId, notes
}
```

Designed for durable storage later without schema rewrite of core fields.

## Contract Analyzer

- Taxonomy: `lib/projects/contract-flags.ts`
- Engine: `lib/projects/contract-analyze.ts`
- Statuses: `present` | `missing` | `unclear`
- Categories: core · protection · florida attention
- Never: “safe to sign” / “do not sign”
- Prefer: “Not clearly stated” / “Worth clarifying”

## Payment / Lien Tracker

- Checklist source: `lib/projects/payment-checklist.ts`
- Florida educational panel (NTO awareness, waivers, final payment caution)
- Per payment: invoice / lien waiver / change-order ref flags
- Outstanding list when completed payments lack docs
- No auto determination of lien validity

## Watch a Contractor

- Entry: Trust Report `WatchButton`, project dashboard
- Baseline snapshot: license status, entity status, discipline count
- On Trust Report open / refresh: `checkWatchAgainstSnapshot`
- Alert copy is factual and calm
- Not real-time push; extract lag disclosed

## Dashboard modules

1. Project summary + status
2. Contractor + Trust Report + watch
3. Documents (metadata/notes only in v1)
4. Milestones checklist
5. Payments & waivers
6. Tools shortcuts + alerts tab

## Guardrails

Shared: `lib/projects/disclaimers.ts`

- Educational research tooling
- Not legal advice
- Not payment processing
- Not outcome guarantee
- Official records and contracts control

## Handoffs

- Trust Report → Watch, Contract Analyzer, Create project
- Tools hub → Protect project, Analyze contract
- Homepage → Protect an active project
- Property / Plan / Studio context can seed create-project query params
