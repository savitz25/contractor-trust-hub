import "server-only";
import labels from "./classification-labels.json";
import events from "./events.json";

export type NvLicense = {
  license: string;
  name: string;
  status: string;
  expires: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  classifications: number[];
  monetaryLimit: string | null;
  limitation: string | null;
  disciplineEvents: number;
};
export type NvEvent = (typeof events)[number];

const LABELS = labels as string[];

/**
 * Normalize a Nevada contractor license number: optional "license"/"#" prefix, up to seven digits, optional
 * one-letter suffix. Digits are left-padded to the Board's seven-digit form. Anything else is not a license number.
 */
export function normalizeNvLicense(input: string): string | null {
  const raw = input.trim().replace(/^(?:license|lic\.?|#|no\.?)\s*#?\s*/i, "").trim().toUpperCase();
  const m = raw.match(/^(\d{1,7})([A-Z]?)$/);
  if (!m) return null;
  return m[1].padStart(7, "0") + m[2];
}

/** Exact license-number lookup in the Board's active directory. Never a name match. */
export async function findNvLicense(input: string): Promise<NvLicense | null> {
  const license = normalizeNvLicense(input);
  if (!license) return null;
  const shard = license.replace(/[A-Z]$/, "").slice(-2);
  const rows = (await import(`./licenses/${shard}.json`)).default as NvLicense[];
  return rows.find((r) => r.license === license) ?? null;
}

/** Board actions printed with exactly this license number. */
export function nvEventsForLicense(license: string): NvEvent[] {
  return events.filter((e) => e.licenseNumberPrinted === license);
}

export function nvClassificationLabel(id: number): string {
  return LABELS[id] ?? String(id);
}
