import "server-only";
import labels from "./classification-labels.json";

export type TnLicense = {
  license: string;
  name: string;
  status: string;
  expires: string | null;
  originated: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  classifications: string[];
  monetaryLimit: string | null;
  qualifyingAgents: number;
};

const LABELS = labels as Record<string, string>;

/** Exact Contractor license-number lookup in the dashboard export. Never a name match. */
export async function findTnLicense(input: string): Promise<TnLicense | null> {
  const digits = input.trim().replace(/^(?:license|lic\.?|#|no\.?)\s*/i, "").replace(/\D/g, "");
  if (!/^\d{1,7}$/.test(digits) || digits !== input.trim().replace(/^(?:license|lic\.?|#|no\.?)\s*/i, "").trim()) return null;
  const license = String(Number(digits));
  const shard = license.slice(-2).padStart(2, "0");
  const rows = (await import(`./licenses/${shard}.json`)).default as TnLicense[];
  return rows.find((r) => r.license === license) ?? null;
}

export function classificationLabel(id: string): string {
  return LABELS[id] ?? id;
}
