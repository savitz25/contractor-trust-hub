/**
 * Saved contractors — device-local, no account required.
 *
 * Save is NOT Watch. A Save keeps a Trust Report in hand on this device; it
 * records no license snapshot, raises no change notice and never touches the
 * watched list (lib/projects/store.ts). It makes no network request.
 *
 * `sync` is the account state of one Save. It is always "device" today: My
 * TrustHub parent sync is not enabled for Contractor. The field exists so the
 * future parent adapter can mark a Save pending/acknowledged without changing
 * the stored shape (see lib/my-trusthub/parent-adapter.ts).
 */
export const SAVED_STORAGE_KEY = "cth-saved-contractors-v1";
export const SAVED_CHANGE_EVENT = "cth-saved-change";
const MAX_SAVED = 200;

export type SavedSync = "device" | "pending" | "synced";
export type SavedContractor = {
  /** Canonical Trust Report slug: the device key and the return path. */
  slug: string;
  name: string;
  /** Exact Contractor profile id, when the profile is identity-safe. Never a display name. */
  profileId: string | null;
  profileClass: "contractor_profile";
  savedAt: string;
  sync: SavedSync;
};

const SLUG = /^[a-z0-9][a-z0-9-]{0,199}$/;

function read(): SavedContractor[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_STORAGE_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.filter((row): row is SavedContractor => {
      if (!row || typeof row !== "object") return false;
      const slug = (row as SavedContractor).slug;
      if (typeof slug !== "string" || !SLUG.test(slug) || seen.has(slug)) return false;
      seen.add(slug);
      return true;
    });
  } catch {
    return [];
  }
}

function write(rows: SavedContractor[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(rows.slice(0, MAX_SAVED)));
    window.dispatchEvent(new Event(SAVED_CHANGE_EVENT));
  } catch {
    /* private mode / quota: the control simply stays unsaved */
  }
}

export function listSavedContractors(): SavedContractor[] {
  return read().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function isContractorSaved(slug: string): boolean {
  return read().some((row) => row.slug === slug);
}

/** Idempotent: saving a saved profile keeps the one existing row. */
export function saveContractor(input: { slug: string; name: string; profileId?: string | null }): SavedContractor | null {
  if (!SLUG.test(input.slug)) return null;
  const rows = read();
  const existing = rows.find((row) => row.slug === input.slug);
  if (existing) return existing;
  const row: SavedContractor = {
    slug: input.slug,
    name: input.name.trim().slice(0, 200) || input.slug,
    profileId: input.profileId ?? null,
    profileClass: "contractor_profile",
    savedAt: new Date().toISOString(),
    sync: "device",
  };
  write([row, ...rows]);
  return row;
}

export function unsaveContractor(slug: string): void {
  const rows = read();
  if (rows.some((row) => row.slug === slug)) write(rows.filter((row) => row.slug !== slug));
}
