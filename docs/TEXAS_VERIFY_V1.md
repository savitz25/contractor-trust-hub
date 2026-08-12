# Texas Verify v1 — smallest useful product

## Recommendation

Ship **Texas Verify v1** as a **trade-specific specialty license lookup**, not a Florida-style full construction directory.

### In scope (v1)

1. **State:** Texas (`tx` / public slug `texas`)  
2. **Data:** TDLR open data (`tx_tdlr`) filtered to **business-level specialty contractor** types:
   - Electrical Contractor  
   - A/C Contractor  
   - Electrical Sign Contractor  
   - Appliance Installation Contractor  
   - Elevator Contractor  
   - Water Well Driller/Pump Installer  
3. **Search:** Name or license number against active/current (non-expired when expiration known)  
4. **Trust Report:** Reuse existing report shell for licenses that have enough fields (name, type, status/expiration, county when present)  
5. **Honest UX copy (required):**
   - “Texas does not issue a statewide general contractor license.”  
   - “This search covers selected TDLR specialty trades only (electrical, A/C, …).”  
   - “Plumbing is under TSBPE (not yet in v1 unless we add `tx_tsbpe`).”  
   - “Many general builders are registered only with a city or county — check local requirements.”

### Out of scope (v1)

- Statewide GC / residential builder claims  
- Full TDLR cosmetology / tow / non-construction programs  
- Default inclusion of apprentices/journeymen (noise for homeowners)  
- TSBPE plumbing (document + adapter later)  
- Discovery browse by all TX counties (optional later; thin without good addresses)  
- Plan / Cost Studio Texas bands (Florida-only until research exists)  
- Lead gen, rankings, scores  

### Why this is the smallest *useful* slice

| Option | Useful? | Honest? | Data ready? |
|--------|---------|---------|-------------|
| Full “TX contractors” like FL | Feels useful | **No** — implies GC coverage | Incomplete |
| All TDLR license types | Large | Misleading for home projects | Yes |
| **Specialty contractors only (above)** | Yes for electrical/HVAC projects | **Yes** with clear labeling | **Yes (open data)** |
| Wait for municipal GC feeds | Incomplete statewide | Yes | High effort |

Homeowners hiring an **electrician or A/C company** get real evidence. Homeowners hiring a “general contractor” get an explicit limitation and optional local guidance — not a fake directory.

## Implementation order

1. ✅ Document sources (`DATA_SOURCES_TX.md`)  
2. ✅ Download + normalize TDLR specialty slice  
3. Load `tx_tdlr` into Postgres (`source_system = tx_tdlr`) with same load pattern as FL  
4. Set `EVIDENCE_STATES.tx.live = true` when search returns real rows  
5. Verify UI: state selector or `/verify?state=tx` + coverage banner  
6. Trust Report: show TDLR license type labels; no Sunbiz-style entity link until a TX entity source exists  

## Success criteria

- Search by known A/C or Electrical Contractor license # returns the right row  
- Name search returns active specialty contractors, not cosmetology  
- Empty / wrong GC-style queries show coverage explanation, not invented matches  
- Florida Verify / Plan / Discovery unchanged  

## Explicit non-claims

- Not a statewide GC registry  
- Not “all Texas contractors”  
- Not a substitute for municipal permitting or local registration checks  
- Not TSBPE until that adapter ships  
