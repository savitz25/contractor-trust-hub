export function formatIntelNumber(value: number | null | undefined, timedOut: boolean): string {
  if (timedOut || value == null) return "—";
  return value.toLocaleString("en-US");
}

export function formatAsOf(iso: string | null): string | null {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  return d || null;
}
