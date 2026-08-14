/** Florida discovery browse params — evidence filters and disclosed sort only. */

export const CITY_INDEX_MIN = 8;

export type BrowseSort = "name" | "longest" | "updated" | "entity";
export type BrowseStatus = "any" | "active" | "inactive";
export type BrowseEntity = "any" | "linked" | "unlinked";
export type BrowseDiscipline = "any" | "present" | "none";
export type BrowseTenure = "any" | "lt5" | "5to15" | "gt15";

export type DiscoveryBrowse = {
  citySlug: string | null;
  status: BrowseStatus;
  entity: BrowseEntity;
  discipline: BrowseDiscipline;
  tenure: BrowseTenure;
  sort: BrowseSort;
  page: number;
};

export const DEFAULT_BROWSE: DiscoveryBrowse = {
  citySlug: null,
  status: "any",
  entity: "any",
  discipline: "any",
  tenure: "any",
  sort: "name",
  page: 1,
};

const SORTS = new Set<BrowseSort>(["name", "longest", "updated", "entity"]);
const STATUSES = new Set<BrowseStatus>(["any", "active", "inactive"]);
const ENTITIES = new Set<BrowseEntity>(["any", "linked", "unlinked"]);
const DISC = new Set<BrowseDiscipline>(["any", "present", "none"]);
const TENURES = new Set<BrowseTenure>(["any", "lt5", "5to15", "gt15"]);

export function cityToSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function cityLabelFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function parseBrowseParams(
  sp: Record<string, string | string[] | undefined>
): DiscoveryBrowse {
  const one = (key: string) => {
    const v = sp[key];
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  };
  const sort = one("sort");
  const status = one("status");
  const entity = one("entity");
  const discipline = one("discipline");
  const tenure = one("tenure");
  const city = one("city");
  const page = Math.max(1, Number(one("page")) || 1);
  return {
    citySlug: city ? cityToSlug(city) : null,
    status: STATUSES.has(status as BrowseStatus) ? (status as BrowseStatus) : "any",
    entity: ENTITIES.has(entity as BrowseEntity) ? (entity as BrowseEntity) : "any",
    discipline: DISC.has(discipline as BrowseDiscipline)
      ? (discipline as BrowseDiscipline)
      : "any",
    tenure: TENURES.has(tenure as BrowseTenure) ? (tenure as BrowseTenure) : "any",
    sort: SORTS.has(sort as BrowseSort) ? (sort as BrowseSort) : "name",
    page,
  };
}

/** True when the URL is a filtered/sorted variant (keep page-1 clean URLs indexable). */
export function browseIsVariant(b: DiscoveryBrowse, pathHasCity = false): boolean {
  if (b.page > 1) return true;
  if (b.status !== "any") return true;
  if (b.entity !== "any") return true;
  if (b.discipline !== "any") return true;
  if (b.tenure !== "any") return true;
  if (b.sort !== "name") return true;
  if (b.citySlug && !pathHasCity) return true;
  return false;
}

export function browseQueryString(
  b: Partial<DiscoveryBrowse>,
  opts?: { omitCity?: boolean }
): string {
  const p = new URLSearchParams();
  if (!opts?.omitCity && b.citySlug) p.set("city", b.citySlug);
  if (b.status && b.status !== "any") p.set("status", b.status);
  if (b.entity && b.entity !== "any") p.set("entity", b.entity);
  if (b.discipline && b.discipline !== "any") p.set("discipline", b.discipline);
  if (b.tenure && b.tenure !== "any") p.set("tenure", b.tenure);
  if (b.sort && b.sort !== "name") p.set("sort", b.sort);
  if (b.page && b.page > 1) p.set("page", String(b.page));
  const q = p.toString();
  return q ? `?${q}` : "";
}

export function browseHref(
  basePath: string,
  b: Partial<DiscoveryBrowse>,
  opts?: { omitCity?: boolean }
): string {
  return `${basePath}${browseQueryString(b, opts)}`;
}

export const SORT_LABELS: Record<BrowseSort, string> = {
  name: "Name A–Z",
  longest: "Longest licensed",
  updated: "Recently updated",
  entity: "Entity linked first",
};

export const SORT_DISCLOSURE =
  "Browse order is for scanning this extract — not a quality ranking or paid placement.";
