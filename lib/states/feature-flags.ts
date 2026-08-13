/**
 * Product feature flags for multi-state pilots.
 * Stage 7: NJ Verify pilot (search + Trust Report core).
 */

/** Enable New Jersey Verify pilot UI and live state config. */
export function isNjVerifyPilotEnabled(): boolean {
  const v = (
    process.env.NEXT_PUBLIC_NJ_VERIFY_PILOT ||
    process.env.NJ_VERIFY_PILOT ||
    "true"
  )
    .toLowerCase()
    .trim();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
