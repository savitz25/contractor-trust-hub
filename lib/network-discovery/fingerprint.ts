import { createHash } from "node:crypto";
import type { NetworkDiscoveryEntity } from "./types";

export function contentFingerprint(entities: NetworkDiscoveryEntity[]): string {
  const normalized = entities.map((e) => {
    const { updated_at: _u, ...rest } = e;
    return rest;
  });
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}
