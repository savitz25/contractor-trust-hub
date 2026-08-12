/** Wave A production focus — Florida pilots only. */

export const WAVE_A_COUNTIES = [
  "Miami-Dade",
  "Broward",
  "Orange",
  "Hillsborough",
] as const;

export const WAVE_A_SLUGS = [
  "miami-dade",
  "broward",
  "orange",
  "hillsborough",
] as const;

export function isWaveACounty(county: string | null | undefined): boolean {
  if (!county) return false;
  const c = county.toLowerCase();
  return WAVE_A_COUNTIES.some(
    (w) => w.toLowerCase() === c || c.includes(w.toLowerCase().split("-")[0])
  );
}

export function isWaveASlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return (WAVE_A_SLUGS as readonly string[]).includes(slug.toLowerCase());
}

export const WAVE_A_COVERAGE_NOTE =
  "Wave A partial coverage (Miami-Dade, Broward, Orange, Hillsborough). Many addresses return no rows even when the AHJ has permits. Empty results do not prove a clean history.";
