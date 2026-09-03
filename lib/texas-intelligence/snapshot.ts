import accepted from "./accepted-snapshot.json";

export type TexasContractorSnapshot = typeof accepted;

export const TEXAS_SNAPSHOT = accepted as TexasContractorSnapshot;

export function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US");
}

export function fmtHero(value: string | number): string {
  if (typeof value === "number") return fmtInt(value);
  return value;
}
