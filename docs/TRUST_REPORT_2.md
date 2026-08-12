# Trust Report 2.0

**Evidence depth · Caution clarity · Decision handoff**

Verification-first contractor profile. Not a score, ranking, or endorsement.

## Route

`/contractors/[slug]`

## Information architecture

| Section | Anchor | Content |
|---------|--------|---------|
| Identity snapshot | `#identity` | Name, entity link, badges, location, extract freshness |
| Evidence pillars | — | License / entity / discipline at a glance |
| Caution snapshot | `#caution-summary` | Present/absent discipline + related-entity flag |
| What we checked | — | Explicit checked vs not-checked |
| License evidence | `#licenses` | Numbers, class, status, dates, class guidance |
| Caution & regulatory | `#caution` | Discipline records with date/source language |
| Business / entity | `#entity` | Sunbiz link, officers, DBPR vs Sunbiz notes |
| Related entity signals | `#related-entity` | Phoenix-style factual observations |
| Insurance & WC | `#insurance` | Request/verify guidance — never invent coverage |
| Activity / permits | `#activity` | Prepared empty state until data linked |
| Project fit | `#project-fit` | Studio/plan handoff + class fit note |
| Next actions | `#next-actions` | Tools + compare + introduction |

## Signal modules

| Module | Path | Notes |
|--------|------|-------|
| Related entity | `lib/contractors/entity-signals.ts` | Multi-entity, shared principals, formation vs license age, active lic / inactive entity |
| Activity | `lib/contractors/activity-signals.ts` | `PERMIT_ACTIVITY_LIVE = false` until extracts linked |
| Project fit | `lib/contractors/project-fit.ts` | Primary/secondary occupation codes vs project type |
| Compare fields | `lib/contractors/compare.ts` | Max **4** contractors; insurance row = not verified |

## Language standards

### Prefer
- “Evidence on file”
- “Not identified in current extracts”
- “Worth confirming before hiring”
- “Related records share a principal name”
- “Request and verify”
- “Homeowner should confirm with carrier”
- “This is a factual relationship signal, not a determination of wrongdoing”

### Avoid
- “Best / top / approved / safe to hire”
- “Insured / fully covered” without source evidence
- “Proven expert / high-volume operator”
- Scores, star ratings, winner labels

### Related-entity (phoenix) rules
- Label as observations from public extracts
- Show evidence lines used
- No fraud/intent accusations
- Only surface when confidence is meaningful (low-only signals suppressed when stronger ones exist)

## Compare workflow

- Tray: search results, studio cards, Trust Report (`CompareToggle` + `CompareBar`)
- Max 4 slugs in `localStorage` (`cth-compare-slugs`)
- View: `/compare?slugs=a,b,c`
- Rows include discipline present/absent, related-entity signal, insurance guidance status (not “covered”), permit empty state
- Differing rows highlighted; mobile stacked differences
- Per-column actions: Trust Report, quote analyzer, checklist

## Decision tools handoff

From Trust Report next actions:
- Quote analyzer (prefill name + contractor slug + project type when known)
- Scope builder / compare bids / pre-hire checklist
- Controlled introduction via studio results `?intro=1&focus=`
- Handoff query includes `ptype` for project type (`lib/studios/handoff.ts`)

## Insurance section rules

- Never claim coverage from silence
- COI + WC request list + carrier verification steps
- Links to official FL Division of Workers’ Compensation portals
- Named insured should match contracting entity when entity is linked

## Empty / partial data

- Thin profiles called out explicitly
- Discipline absent ≠ clean history
- Permits: honest “not yet linked” empty state
- Related-entity: empty when no threshold signals
