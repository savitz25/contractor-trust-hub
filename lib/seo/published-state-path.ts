/**
 * PA-REL-001: normalize mixed-case published statewide intelligence paths.
 * Does not lowercase business slugs, IDs, or other routes.
 */
export const PUBLISHED_STATEWIDE_SLUGS = [
  "arizona",
  "california",
  "colorado",
  "florida",
  "georgia",
  "illinois",
  "massachusetts",
  "minnesota",
  "nevada",
  "new-jersey",
  "new-york",
  "north-carolina",
  "ohio",
  "oregon",
  "pennsylvania",
  "tennessee",
  "texas",
  "virginia",
  "washington",
] as const;

const SLUGS = new Set<string>(PUBLISHED_STATEWIDE_SLUGS);

export function normalizedPublishedStatePath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 1) return null;
  const first = parts[0];
  const lower = first.toLowerCase();
  if (!SLUGS.has(lower)) return null;
  if (first === lower) return null;
  return `/${lower}`;
}
