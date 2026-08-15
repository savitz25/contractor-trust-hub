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
  name: "Name A-Z",
  longest: "Longest licensed",
  updated: "Recently updated",
  entity: "Entity linked first",
};

export const SORT_DISCLOSURE =
  "Browse order is for scanning this extract - not a quality ranking or paid placement.";

/** List results vs city-clustered navigation (no map — no lat/lng in extracts). */
export type BrowseView = "list" | "cities";

export function parseBrowseView(
  sp: Record<string, string | string[] | undefined>
): BrowseView {
  const v = sp.view;
  const raw = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  return raw === "cities" ? "cities" : "list";
}

export type ActiveFilterChip = {
  id: string;
  /** Short chip label */
  label: string;
  /** Browse state with this filter cleared (keeps others + sort/page reset to 1) */
  without: DiscoveryBrowse;
};

const STATUS_CHIP: Record<Exclude<BrowseStatus, "any">, string> = {
  active: "Active / current only",
  inactive: "Not active in extract",
};

const ENTITY_CHIP: Record<Exclude<BrowseEntity, "any">, string> = {
  linked: "Sunbiz linked",
  unlinked: "No Sunbiz link",
};

const DISC_CHIP: Record<Exclude<BrowseDiscipline, "any">, string> = {
  present: "Has discipline in extract",
  none: "No discipline linked",
};

const TENURE_CHIP: Record<Exclude<BrowseTenure, "any">, string> = {
  lt5: "Licensed < 5 years",
  "5to15": "Licensed 5-15 years",
  gt15: "Licensed 15+ years",
};

/** Active evidence filters as removable chips (sort is separate — always shown). */
export function activeFilterChips(
  browse: DiscoveryBrowse,
  opts?: { pathCitySlug?: string | null; pathCityLabel?: string | null }
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  const base = { ...browse, page: 1 };

  if (opts?.pathCitySlug) {
    chips.push({
      id: "path-city",
      label: opts.pathCityLabel
        ? `City: ${opts.pathCityLabel}`
        : `City: ${cityLabelFromSlug(opts.pathCitySlug)}`,
      // Path city cannot be cleared via query — caller should link to parent trade page
      without: base,
    });
  } else if (browse.citySlug) {
    chips.push({
      id: "city",
      label: `City: ${cityLabelFromSlug(browse.citySlug)}`,
      without: { ...base, citySlug: null },
    });
  }
  if (browse.status !== "any") {
    chips.push({
      id: "status",
      label: STATUS_CHIP[browse.status],
      without: { ...base, status: "any" },
    });
  }
  if (browse.entity !== "any") {
    chips.push({
      id: "entity",
      label: ENTITY_CHIP[browse.entity],
      without: { ...base, entity: "any" },
    });
  }
  if (browse.discipline !== "any") {
    chips.push({
      id: "discipline",
      label: DISC_CHIP[browse.discipline],
      without: { ...base, discipline: "any" },
    });
  }
  if (browse.tenure !== "any") {
    chips.push({
      id: "tenure",
      label: TENURE_CHIP[browse.tenure],
      without: { ...base, tenure: "any" },
    });
  }
  return chips;
}

/** Filters that a user can loosen via query (excludes path city). */
export function loosenableFilterCount(
  browse: DiscoveryBrowse,
  pathCitySlug?: string | null
): number {
  let n = 0;
  if (browse.citySlug && !pathCitySlug) n += 1;
  if (browse.status !== "any") n += 1;
  if (browse.entity !== "any") n += 1;
  if (browse.discipline !== "any") n += 1;
  if (browse.tenure !== "any") n += 1;
  return n;
}

export function clearedBrowse(browse: DiscoveryBrowse): DiscoveryBrowse {
  return {
    ...DEFAULT_BROWSE,
    sort: browse.sort,
    page: 1,
  };
}

/** Short copy for empty results: which filters to loosen. */
export function emptyFilterHints(browse: DiscoveryBrowse, pathCitySlug?: string | null): string[] {
  const hints: string[] = [];
  if (browse.status === "active") hints.push("allow any published license status");
  if (browse.status === "inactive") hints.push("include active licenses");
  if (browse.entity === "linked") hints.push("include firms without a high-confidence Sunbiz link");
  if (browse.entity === "unlinked") hints.push("include Sunbiz-linked firms");
  if (browse.discipline === "present") hints.push("include firms with no discipline in the extract");
  if (browse.discipline === "none") hints.push("include firms with a linked discipline action");
  if (browse.tenure !== "any") hints.push("clear the license-tenure band");
  if (browse.citySlug && !pathCitySlug) hints.push("clear the city filter");
  if (pathCitySlug) hints.push("step up to the full county + trade list");
  if (hints.length === 0) hints.push("try a nearby city or a broader trade");
  return hints;
}
