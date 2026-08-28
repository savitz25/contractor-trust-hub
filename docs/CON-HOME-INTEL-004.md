# CON-HOME-INTEL-004 / 004A — Homepage intelligence hierarchy

Snapshot: `data/home/contractor-hub-intel-v2.json` (`contractor-hub-intel-v2`)

## Cohorts (do not mix)

**Live/public** — `lib/states/config.ts` `getLiveStates()` + `licenseSource`/`licenseSources`:
10 live researched states, 11 license source systems, 644,421 credential rows, 499,997 active/current.

**Broader research graph** — `COUNT(*)` / `COUNT(DISTINCT source_system)` on `licenses` with remainder `source_system=not.in.(populated keys) = 0`:
1,266,214 license rows, **18** populated source systems.

Do not associate 1,266,214 with 13 systems. A 13-count was an incomplete candidate list, not a configured cohort.

## Trade-card destinations (004A UX note — not solved here)

Several multi-state trade cards still route to Florida Intelligence pages (`/florida/general-contractors`, roofers, plumbing, air-conditioning, pool-spa, residential) because no national filtered trade experience exists. Electrical correctly uses `/verify?work=electrical`.

Future work: a national trade-exploration contract so a multi-state statistic can open a multi-state destination. Do not invent those routes until the filtered experience exists.

Rebuild: `npm run home:intel`  
Tests: `npm run assert:home-intel`
