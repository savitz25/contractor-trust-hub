import type { NetworkDiscoveryEntity } from "./types";

export const PILOT_TARGET = 200;

/**
 * Natural deterministic cohort. Queries do not choose membership.
 *
 * Algorithm:
 * 1. Sort eligible entities by network_entity_id (contractor UUID).
 * 2. If eligible length <= 200, return that sorted list.
 * 3. Stratify by `${state}|${first Ask category}` — generic product dimensions,
 *    not QA cities/counties.
 * 4. Within each stratum, keep UUID order.
 * 5. Round-robin across strata in sorted stratum-key order until 200.
 * 6. Sort the selected 200 by network_entity_id.
 *
 * Premium, payment, ratings, review counts, Trust Scores, and query fixtures
 * are not consulted.
 */
export function stratumKey(e: NetworkDiscoveryEntity): string {
  const state = e.state || "unknown";
  const cat = (e.categories && e.categories[0]) || "contractor";
  return `${state}|${cat}`;
}

export function selectContractorPilot(eligible: NetworkDiscoveryEntity[]): NetworkDiscoveryEntity[] {
  const sorted = [...eligible].sort((a, b) =>
    a.network_entity_id.localeCompare(b.network_entity_id)
  );
  if (sorted.length <= PILOT_TARGET) return sorted;

  const byStratum = new Map<string, NetworkDiscoveryEntity[]>();
  for (const e of sorted) {
    const key = stratumKey(e);
    const list = byStratum.get(key) ?? [];
    list.push(e);
    byStratum.set(key, list);
  }
  const keys = [...byStratum.keys()].sort();
  const idx: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  const selected: NetworkDiscoveryEntity[] = [];
  const seen = new Set<string>();

  while (selected.length < PILOT_TARGET) {
    let progressed = false;
    for (const key of keys) {
      if (selected.length >= PILOT_TARGET) break;
      const list = byStratum.get(key)!;
      const i = idx[key];
      if (i >= list.length) continue;
      idx[key] = i + 1;
      const ent = list[i]!;
      if (seen.has(ent.network_entity_id)) continue;
      seen.add(ent.network_entity_id);
      selected.push(ent);
      progressed = true;
    }
    if (!progressed) break;
  }

  return selected.sort((a, b) => a.network_entity_id.localeCompare(b.network_entity_id));
}
