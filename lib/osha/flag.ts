/**
 * CON-OSHA-001 profile gate.
 * Default off. Invalid values fail closed. This flag is not a shared rollout switch.
 */
export const OSHA_PROFILE_FLAG = "CON_OSHA_001_PROFILE";

const ON = new Set(["1", "true", "yes", "on"]);
const OFF = new Set(["0", "false", "no", "off"]);

export function oshaProfileFlag(
  env: Record<string, string | undefined> = process.env,
): "on" | "off" {
  const raw = env[OSHA_PROFILE_FLAG];
  if (raw == null || raw.trim() === "") return "off";
  const value = raw.trim().toLowerCase();
  if (ON.has(value)) return "on";
  if (OFF.has(value)) return "off";
  return "off";
}

export function isOshaProfileEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return oshaProfileFlag(env) === "on";
}

/** Showcase route only. Production always refuses, including a contradictory NODE_ENV. */
export function oshaPreviewShowcaseAllowed(env: {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
}): boolean {
  if (env.VERCEL_ENV === "production") return false;
  if (env.NODE_ENV === "development") return true;
  return env.VERCEL_ENV === "preview";
}
