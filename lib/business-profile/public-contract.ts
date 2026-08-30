export type PublicBusinessProfile = {
  contractVersion: 1;
  hub: "contractor";
  nativeProfileId: string;
  managed: true;
  source: "BUSINESS_SUPPLIED";
  freshness: { state: "CURRENT" | "RECONFIRM_SOON" | "STALE"; lastConfirmedAt: string; label: string; mayBeOutdated: boolean };
  fields: Partial<Record<"description" | "website" | "public_phone" | "public_email" | "founded_year" | "emergency_service" | "contact_context", string>>;
  services: string[];
  serviceAreas: string[];
  languages: string[];
  hours: Array<{ weekday: number; closed: boolean; opensAt?: string; closesAt?: string }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_FIELDS = new Set(["description", "website", "public_phone", "public_email", "founded_year", "emergency_service", "contact_context"]);
const text = (value: unknown, max: number) => typeof value === "string" && value.length <= max ? value : undefined;
const list = (value: unknown) => Array.isArray(value) && value.length <= 30 && value.every((item) => typeof item === "string" && item.length <= 120) ? value as string[] : null;

export function parsePublicBusinessProfile(value: unknown, expectedId: string): PublicBusinessProfile | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.contractVersion !== 1 || row.hub !== "contractor" || row.managed !== true || row.source !== "BUSINESS_SUPPLIED" || row.nativeProfileId !== expectedId || !UUID.test(expectedId)) return null;
  if (!row.fields || typeof row.fields !== "object" || Array.isArray(row.fields)) return null;
  const rawFields = row.fields as Record<string, unknown>; const fields: PublicBusinessProfile["fields"] = {};
  for (const key of Object.keys(rawFields)) if (!PUBLIC_FIELDS.has(key)) return null;
  const limits: Record<string, number> = { description: 2000, website: 300, public_phone: 40, public_email: 254, founded_year: 4, emergency_service: 5, contact_context: 500 };
  for (const key of PUBLIC_FIELDS) { const parsed = text(rawFields[key], limits[key]); if (rawFields[key] !== undefined && parsed === undefined) return null; if (parsed) fields[key as keyof typeof fields] = parsed; }
  if (fields.website) { try { const url = new URL(fields.website); if (!['http:', 'https:'].includes(url.protocol)) return null; } catch { return null; } }
  if (fields.public_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.public_email)) return null;
  if (fields.founded_year && !/^\d{4}$/.test(fields.founded_year)) return null;
  if (fields.emergency_service && !['true', 'false'].includes(fields.emergency_service)) return null;
  const services = list(row.services), serviceAreas = list(row.serviceAreas), languages = list(row.languages);
  if (!services || !serviceAreas || !languages || !Array.isArray(row.hours) || row.hours.length > 7) return null;
  const hours = row.hours.map((entry) => {
    if (!entry || typeof entry !== "object") return null; const h = entry as Record<string, unknown>;
    if (!Number.isInteger(h.weekday) || Number(h.weekday) < 0 || Number(h.weekday) > 6 || typeof h.closed !== "boolean") return null;
    const opensAt = text(h.opensAt, 5), closesAt = text(h.closesAt, 5);
    if ((opensAt && !/^\d{2}:\d{2}$/.test(opensAt)) || (closesAt && !/^\d{2}:\d{2}$/.test(closesAt))) return null;
    return { weekday: Number(h.weekday), closed: h.closed, ...(opensAt ? { opensAt } : {}), ...(closesAt ? { closesAt } : {}) };
  });
  if (hours.some((hour) => !hour)) return null;
  if (!row.freshness || typeof row.freshness !== "object") return null;
  const f = row.freshness as Record<string, unknown>;
  if (!['CURRENT','RECONFIRM_SOON','STALE'].includes(String(f.state)) || typeof f.lastConfirmedAt !== "string" || Number.isNaN(Date.parse(f.lastConfirmedAt)) || typeof f.label !== "string" || typeof f.mayBeOutdated !== "boolean") return null;
  return { contractVersion: 1, hub: "contractor", nativeProfileId: expectedId, managed: true, source: "BUSINESS_SUPPLIED", fields, services, serviceAreas, languages,
    hours: hours as PublicBusinessProfile["hours"], freshness: { state: f.state as PublicBusinessProfile["freshness"]["state"], lastConfirmedAt: f.lastConfirmedAt, label: f.label, mayBeOutdated: f.mayBeOutdated } };
}
