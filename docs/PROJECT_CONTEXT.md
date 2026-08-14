# Project context + shortlist

Lightweight **device-local** continuity across Florida Plan / Studios / discovery / Verify / Compare.  
Not an account system. Not a marketplace. Not a ranking.

## Storage keys

| Key | Purpose | Limit / notes |
|-----|---------|----------------|
| `cth-journey-context-v1` | Project context (type, scale, location, optional contractor) | Single object; version **2** writes (v1 reads still accepted) |
| `cth-compare-slugs` | Shortlist of contractor slugs | **Max 3** unique slugs |
| `cth-plan-context` | Plan results snapshot for resume | Optional; set by Plan results page |
| `cth-studio-handoff` | Session handoff studio → Trust Report | `sessionStorage` |

### Project context fields

```ts
{
  version: 2,
  state: "fl",           // plan depth is Florida-first
  projectType?: string,  // kitchen_remodel, roofing, …
  scale?: string,
  zip?: string,
  city?: string,
  county?: string,
  entryPath?: "plan" | "studio" | "discovery" | "verify" | …,
  contractorSlug?: string,
  contractorName?: string,
  updatedAt: string
}
```

API: `lib/project-context/store.ts` (`saveProjectContext`, `loadProjectContext`, `clearProjectContext`)  
Also: `lib/funnel/journey-context.ts` (`saveJourneyContext` — same underlying key).

### Shortlist fields

JSON array of contractor `slug` strings, max **3**.

API: `components/compare/compare-store.ts`  
UI: **Save** / **Saved** (`CompareToggle`), sticky **N saved** bar (`CompareBar`) → `/compare?slugs=…`

## Who writes

| Surface | Writes |
|---------|--------|
| `/plan` flow (finish) | project type, scale, zip, city, state=fl |
| `/plan/results` | same + county when known + optional first match contractor |
| Cost / Kitchen / Bath / Roofing studios (CTA click) | project type, scale, zip, city |
| Studio results | project type, scale, location, first match |
| Florida discovery (optional) | attaches county when context already exists |
| Trust Report / tools | may set contractor slug/name via journey helpers |

## Who reads

| Surface | Reads |
|---------|--------|
| Journey chip (layout) | context summary + clear |
| Shortlist sticky bar | shortlist count + optional context chips |
| Florida discovery | `ProjectContextPrompt` |
| Compare page | shortlist via URL / hydrate |
| Tool handoffs | `journeyQuery` / `toolHref` |

## Clear / reset

| Action | Behavior |
|--------|----------|
| **Clear context** (journey chip) | Resets project context object to empty FL shell |
| **Clear** (shortlist bar) | Empties shortlist array |
| Refresh / new tab (same browser) | Both persist (localStorage) |
| Private / cleared site data | Both empty |

## Guardrails

- No lead forms  
- No “best / winner / recommended” language  
- Compare is **evidence side-by-side** only  
- Plan depth is **Florida-first** — do not invent multi-state plan coverage  
- Max shortlist **3** (was 4; existing devices truncate to 3 on next write)

## Example path

1. Kitchen studio → set zip → **Find verified contractors** (writes context)  
2. Plan results → save 2–3 cards (**Save**)  
3. Sticky bar → **Compare N side-by-side**  
4. Refresh → shortlist still present on device  
