/** Client-side compare set (localStorage). Max 3 contractor slugs. */

export const COMPARE_STORAGE_KEY = "cth-compare-slugs";
export const MAX_COMPARE = 3;

export function readCompareSlugs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .slice(0, MAX_COMPARE);
  } catch {
    return [];
  }
}

export function writeCompareSlugs(slugs: string[]): void {
  if (typeof window === "undefined") return;
  const unique = [...new Set(slugs)].slice(0, MAX_COMPARE);
  localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(unique));
  window.dispatchEvent(new CustomEvent("cth-compare-change", { detail: unique }));
}

export function toggleCompareSlug(slug: string): { slugs: string[]; added: boolean; full: boolean } {
  const current = readCompareSlugs();
  if (current.includes(slug)) {
    const next = current.filter((s) => s !== slug);
    writeCompareSlugs(next);
    return { slugs: next, added: false, full: false };
  }
  if (current.length >= MAX_COMPARE) {
    return { slugs: current, added: false, full: true };
  }
  const next = [...current, slug];
  writeCompareSlugs(next);
  return { slugs: next, added: true, full: false };
}

export function clearCompareSlugs(): void {
  writeCompareSlugs([]);
}

export function comparePageHref(slugs: string[]): string {
  const q = slugs.map(encodeURIComponent).join(",");
  return `/compare?slugs=${q}`;
}
