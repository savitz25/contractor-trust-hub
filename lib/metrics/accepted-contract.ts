import { createHash } from "node:crypto";
export type CapabilityStatus =
  | "STATE_SOURCE_LIVE"
  | "STATE_SOURCE_ACQUIRED"
  | "SEARCH_ONLY"
  | "REQUEST_ONLY"
  | "FEDERAL_BASELINE"
  | "NOT_ACQUIRED"
  | "UNKNOWN"
  | "SPECIALIST_COMPLETE";
export type StateCapability = {
  state: string;
  route: string | null;
  status: CapabilityStatus;
  specialistComplete: boolean;
  completion: "PENDING" | "NOT_ASSERTED" | "ACCEPTED";
  capabilities: Array<{
    id: string;
    status: CapabilityStatus;
    metricKeys: string[];
    bulkCount: number | null;
  }>;
};
export type AcceptedSource = {
  path: string;
  sha256: string;
  sourceAsOf: string | null;
  retrievedAt: string | null;
  snapshotAsOf: string | null;
};
export function count(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error(`Missing/invalid accepted count: ${label}`);
  return value;
}
export function exactCountHeader(header: string | null): number {
  if (!header || !/\/\d+$/.test(header))
    throw new Error("Missing exact Content-Range count");
  return count(Number(header.split("/")[1]), "Content-Range");
}
export function stable(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(
          (k) =>
            JSON.stringify(k) +
            ":" +
            stable((value as Record<string, unknown>)[k]),
        )
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export function fingerprint(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}
