import { count } from "./accepted-contract";
export const STATUS_BUCKETS = [
  "active",
  "current",
  "inactive",
  "expired",
  "suspended",
  "revoked",
  "unlicensed",
  "other",
] as const;
export type StatusBucket = (typeof STATUS_BUCKETS)[number];
/** Exact normalized vocabulary only. Restrictions, missing and novel statuses stay OTHER. */
export function classifyCredentialStatus(status: string | null): StatusBucket {
  const s = status?.trim().toLowerCase();
  return STATUS_BUCKETS.includes(s as StatusBucket)
    ? (s as StatusBucket)
    : "other";
}
export function partitionCredentials(
  groups: Array<{ normalizedStatus: string | null; rows: number }>,
  universe: number,
) {
  const buckets = Object.fromEntries(
    STATUS_BUCKETS.map((k) => [k, 0]),
  ) as Record<StatusBucket, number>;
  for (const group of groups)
    buckets[classifyCredentialStatus(group.normalizedStatus)] += count(
      group.rows,
      "credential status rows",
    );
  const sum = Object.values(buckets).reduce((n, v) => n + v, 0);
  if (sum !== count(universe, "credential universe"))
    throw new Error(`Unexplained credential remainder: ${universe - sum}`);
  return buckets;
}
