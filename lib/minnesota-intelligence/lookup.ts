import "server-only";
import labels from "./credential-labels.json";
import events from "./events.json";

/** One DLI export row. Person rows carry no name, city, or ZIP; business rows carry name, DBA, city, ZIP. */
export type MnCredential = {
  n: string;
  k: number;
  g: "B" | "P";
  st: string | null;
  s: string;
  o: string | null;
  e: string | null;
  ea: 0 | 1;
  rp: 0 | 1;
  name?: string;
  dba?: string | null;
  city?: string | null;
  zip?: string | null;
};
export type MnLabel = (typeof labels)[number];
export type MnEvent = (typeof events)[number];

const LABELS = labels as MnLabel[];

/**
 * Normalize a Minnesota DLI credential number: optional "license"/"#"/"no." prefix, then the number as DLI prints it —
 * a two-character prefix and six digits (BC123456, QB123456, 1A012345), or an MPCA pipelaying bond number (L1234).
 * Letters are upper-cased; nothing is padded or guessed. Anything else is not a credential number.
 */
export function normalizeMnCredential(input: string): string | null {
  const raw = input.trim().replace(/^(?:license|lic\.?|registration|#|no\.?)\s*#?\s*/i, "").trim().toUpperCase();
  if (/^[A-Z0-9]{2}\d{6}$/.test(raw) && /[A-Z]/.test(raw.slice(0, 2))) return raw;
  if (/^L:?\d{1,4}$/.test(raw)) return raw;
  return null;
}

/** Exact credential-number lookup in the DLI export. Never a name match. */
export async function findMnCredential(input: string): Promise<MnCredential | null> {
  const n = normalizeMnCredential(input);
  if (!n) return null;
  const digits = n.replace(/\D/g, "");
  const shard = digits.slice(-2).padStart(2, "0");
  if (digits.length < 2) return null;
  const rows = (await import(`./credentials/${shard}.json`)).default as MnCredential[];
  return rows.find((r) => r.n === n) ?? null;
}

export function mnLabel(id: number): MnLabel | null {
  return LABELS[id] ?? null;
}

/** Enforcement rows that print exactly this credential number and matched it in the export. */
export function mnEventsForCredential(n: string): MnEvent[] {
  return events.filter((e) => e.credentialNumbersInExport.includes(n));
}
