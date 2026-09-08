export type PublicBusinessProfile = {
  contractVersion: 1;
  hub: "contractor";
  nativeProfileId: string;
  managed: true;
  source: "BUSINESS_SUPPLIED";
  freshness: { state: "CURRENT" | "RECONFIRM_SOON" | "STALE"; lastConfirmedAt: string; label: string; mayBeOutdated: boolean };
  fields: Partial<Record<"description" | "website" | "public_phone" | "public_email" | "founded_year" | "emergency_service", string>>;
  services: string[];
  serviceAreas: string[];
  languages: string[];
  hours: Array<{ weekday: number; closed: boolean; opensAt?: string; closesAt?: string }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_FIELDS = new Set(["description", "website", "public_phone", "public_email", "founded_year", "emergency_service"]);
const TOP_LEVEL = new Set(["contractVersion", "hub", "nativeProfileId", "managed", "source", "freshness", "fields", "services", "serviceAreas", "languages", "hours"]);
const FRESHNESS_KEYS = new Set(["state", "lastConfirmedAt", "label", "mayBeOutdated"]);
const HOURS_KEYS = new Set(["weekday", "closed", "opensAt", "closesAt"]);
const unsafeMarkup = /<\/?[a-z!][^>]*>|javascript\s*:|data\s*:/i;
const text = (value: unknown, max: number) => typeof value === "string" && value.length > 0 && value.length <= max && !unsafeMarkup.test(value) ? value : undefined;
const exactKeys = (row: Record<string, unknown>, allowed: Set<string>) => Object.keys(row).every((key) => allowed.has(key));
const list = (value: unknown) => {
  if (!Array.isArray(value) || value.length > 30 || !value.every((item) => text(item, 80) !== undefined)) return null;
  const parsed = value as string[];
  return new Set(parsed.map((item) => item.toLocaleLowerCase())).size === parsed.length ? parsed : null;
};
const validTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

export function parsePublicBusinessProfile(value: unknown, expectedId: string): PublicBusinessProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!exactKeys(row, TOP_LEVEL) || row.contractVersion !== 1 || row.hub !== "contractor" || row.managed !== true || row.source !== "BUSINESS_SUPPLIED" || row.nativeProfileId !== expectedId || !UUID.test(expectedId)) return null;
  if (!row.fields || typeof row.fields !== "object" || Array.isArray(row.fields)) return null;
  const rawFields = row.fields as Record<string, unknown>; const fields: PublicBusinessProfile["fields"] = {};
  if (!exactKeys(rawFields, PUBLIC_FIELDS)) return null;
  const limits: Record<string, number> = { description: 2000, website: 300, public_phone: 40, public_email: 254, founded_year: 4, emergency_service: 5 };
  for (const key of PUBLIC_FIELDS) { const parsed = text(rawFields[key], limits[key]); if (rawFields[key] !== undefined && parsed === undefined) return null; if (parsed) fields[key as keyof typeof fields] = parsed; }
  if (fields.website) { try { const url = new URL(fields.website); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null; } catch { return null; } }
  if (fields.public_email && !/^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/.test(fields.public_email)) return null;
  if (fields.public_phone && !/^[0-9+().\-\s]{7,40}$/.test(fields.public_phone)) return null;
  if (fields.founded_year && (!/^\d{4}$/.test(fields.founded_year) || Number(fields.founded_year) < 1700 || Number(fields.founded_year) > new Date().getUTCFullYear())) return null;
  if (fields.emergency_service && !['true', 'false'].includes(fields.emergency_service)) return null;
  const services = list(row.services), serviceAreas = list(row.serviceAreas), languages = list(row.languages);
  if (!services || !serviceAreas || !languages || !Array.isArray(row.hours) || row.hours.length > 7) return null;
  const seenDays = new Set<number>();
  const hours = row.hours.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null; const h = entry as Record<string, unknown>;
    if (!exactKeys(h, HOURS_KEYS) || !Number.isInteger(h.weekday) || Number(h.weekday) < 0 || Number(h.weekday) > 6 || seenDays.has(Number(h.weekday)) || typeof h.closed !== "boolean") return null;
    seenDays.add(Number(h.weekday));
    const opensAt = text(h.opensAt, 5), closesAt = text(h.closesAt, 5);
    if (h.closed ? h.opensAt !== undefined || h.closesAt !== undefined : !opensAt || !closesAt || !validTime(opensAt) || !validTime(closesAt) || opensAt >= closesAt) return null;
    return { weekday: Number(h.weekday), closed: h.closed, ...(opensAt ? { opensAt } : {}), ...(closesAt ? { closesAt } : {}) };
  });
  if (hours.some((hour) => !hour)) return null;
  if (!row.freshness || typeof row.freshness !== "object" || Array.isArray(row.freshness)) return null;
  const f = row.freshness as Record<string, unknown>;
  if (!exactKeys(f, FRESHNESS_KEYS) || !['CURRENT','RECONFIRM_SOON','STALE'].includes(String(f.state)) || typeof f.lastConfirmedAt !== "string" || Number.isNaN(Date.parse(f.lastConfirmedAt)) || text(f.label, 120) === undefined || typeof f.mayBeOutdated !== "boolean" || (f.state === 'STALE') !== f.mayBeOutdated) return null;
  return { contractVersion: 1, hub: "contractor", nativeProfileId: expectedId, managed: true, source: "BUSINESS_SUPPLIED", fields, services, serviceAreas, languages,
    hours: hours as PublicBusinessProfile["hours"], freshness: { state: f.state as PublicBusinessProfile["freshness"]["state"], lastConfirmedAt: f.lastConfirmedAt, label: String(f.label), mayBeOutdated: f.mayBeOutdated } };
}
