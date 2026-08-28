import { createHash } from "node:crypto";

/** Wall-clock / request fields that must not affect the data-contract hash. */
export const CANONICAL_EXCLUDED_KEYS = [
  "generatedAt",
  "timedOut",
  "canonicalFingerprint",
  "payloadFingerprint",
] as const;

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(rec).sort()) {
      if ((CANONICAL_EXCLUDED_KEYS as readonly string[]).includes(key)) continue;
      out[key] = sortValue(rec[key]);
    }
    return out;
  }
  return value;
}

export function canonicalizeIntelligencePayload(payload: unknown): string {
  return JSON.stringify(sortValue(payload));
}

export function intelligenceFingerprint(payload: unknown): string {
  return createHash("sha256").update(canonicalizeIntelligencePayload(payload)).digest("hex");
}
