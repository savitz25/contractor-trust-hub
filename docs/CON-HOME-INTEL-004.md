# CON-HOME-INTEL-004 — Homepage intelligence hierarchy

Snapshot: `data/home/contractor-hub-intel-v2.json` (`contractor-hub-intel-v2`)

Public live cohort is derived from `lib/states/config.ts` (`getLiveStates` / `LIVE_STATE_ORDER` + `licenseSource` / `licenseSources`). Broader research-graph totals are not advertised as a U.S. contractor census.

Trade families use explicit occupation codes in `lib/home/trade-families.json`. No prior cross-state normalization table existed.

Rebuild: `npm run home:intel`  
Tests: `npm run assert:home-intel`
