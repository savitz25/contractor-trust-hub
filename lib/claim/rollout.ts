import { CLAIM_STATES, claimStateForSource, type ClaimProfile, type ClaimState } from "./eligibility";

// ATH-CLAIM-V2-FLNJ-001 — pure rollout gate + credential selection (no server-only import, unit-testable).

/**
 * ATH-CLAIM-V2-FLNJ-001 — rollout state allow-list. `ATH_CLAIM_ENABLED_STATES=FL,NJ`. Only known claim states
 * count; unknown tokens are ignored and an absent/empty value enables NOTHING (fail closed), including under
 * `ATH_CLAIM_CTA_MODE=all` — "all" means every eligible profile inside this allow-list, never every state.
 */
export function claimEnabledStates(env: Record<string, string | undefined> = process.env): ReadonlySet<ClaimState> {
  const known = new Set<string>(CLAIM_STATES);
  return new Set(
    (env.ATH_CLAIM_ENABLED_STATES || "")
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter((value): value is ClaimState => known.has(value))
  );
}

export function claimStateEnabled(homeState: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(homeState) && claimEnabledStates(env).has(homeState as ClaimState);
}

/** Mode / canary gate (cheap, needs no profile). Unchanged canary semantics. */
export function claimModeEnabledFor(profileId: string, env: Record<string, string | undefined> = process.env): boolean {
  const secret = env.ATH_HANDOFF_SECRET || "";
  if (secret.length < 32) return false;
  const mode = env.ATH_CLAIM_CTA_MODE || "off";
  if (mode === "all") return true;
  if (mode !== "canary") return false;
  return new Set(
    (env.ATH_CLAIM_CANARY_PROFILE_IDS || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  ).has(profileId.toLowerCase());
}

/** Rollout requires BOTH the mode gate and the profile's claim state being enabled. */
export function claimCtaEnabledFor(profileId: string, homeState: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  return claimModeEnabledFor(profileId, env) && claimStateEnabled(homeState, env);
}

/** Pure selection shared with tests: FL rule exactly as before; NJ only when FL does not apply. */
export function selectClaimableCredential(rows: ReadonlyArray<{ id: string; slug: string; display_name: string; home_state: string | null; external_key: string; source_system: string; license_state: string | null }>): ClaimProfile | null {
  for (const state of CLAIM_STATES) {
    const best = rows.find((r) => claimStateForSource(r.source_system) === state);
    if (!best) continue;
    if (best.home_state === state || best.license_state === state) {
      return { id: best.id, slug: best.slug, externalKey: best.external_key, displayName: best.display_name, homeState: state, sourceSystem: best.source_system };
    }
  }
  return null;
}
