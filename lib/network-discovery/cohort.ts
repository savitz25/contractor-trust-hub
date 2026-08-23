import type { NetworkDiscoveryEntity } from "./types";
import { matchesQuery, REQUIRED_QUERY_FIXTURES } from "./query-readiness";

export const PILOT_TARGET = 200;

/**
 * Deterministic stratified sample.
 *
 * 1. Reserve one UUID-smallest entity for each required query fixture that
 *    has at least one eligible match. Coverage only — not ranking.
 * 2. Group remaining by first Ask category (UUID-sorted).
 * 3. Round-robin across groups until PILOT_TARGET.
 *
 * Premium, payment, ratings, review counts, and Trust Scores are not consulted.
 */
export function selectContractorPilot(eligible: NetworkDiscoveryEntity[]): NetworkDiscoveryEntity[] {
  const sorted = [...eligible].sort((a, b) =>
    a.network_entity_id.localeCompare(b.network_entity_id)
  );
  if (sorted.length <= PILOT_TARGET) return sorted;

  const selected: NetworkDiscoveryEntity[] = [];
  const seen = new Set<string>();

  for (const fixture of REQUIRED_QUERY_FIXTURES) {
    if (selected.length >= PILOT_TARGET) break;
    const match = sorted.find((e) => !seen.has(e.network_entity_id) && matchesQuery(e, fixture));
    if (!match) continue;
    seen.add(match.network_entity_id);
    selected.push(match);
  }

  const byCat = new Map<string, NetworkDiscoveryEntity[]>();
  for (const e of sorted) {
    if (seen.has(e.network_entity_id)) continue;
    const key = (e.categories && e.categories[0]) || "contractor";
    const list = byCat.get(key) ?? [];
    list.push(e);
    byCat.set(key, list);
  }
  const cats = [...byCat.keys()].sort();
  const idx: Record<string, number> = Object.fromEntries(cats.map((c) => [c, 0]));

  while (selected.length < PILOT_TARGET) {
    let progressed = false;
    for (const c of cats) {
      if (selected.length >= PILOT_TARGET) break;
      const list = byCat.get(c)!;
      const i = idx[c];
      if (i >= list.length) continue;
      idx[c] = i + 1;
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
