/**
 * My TrustHub — Contractor parent adapter (INTERFACE PREP ONLY, sync OFF).
 *
 * The production pattern proven on Move, restated for Contractor:
 *
 *   1. The device Save happens first and never waits for anything.
 *   2. The specialist server proves the profile is publicly published and
 *      derives its exact identity (profile-identity.ts). The browser never
 *      supplies an identity.
 *   3. The specialist asks the parent, over a signed server channel, whether
 *      exactly one accepted binding matches that identity. Zero, several,
 *      review_required or any grain disagreement is "not eligible".
 *   4. The browser is handed to the parent, which commits or removes under the
 *      verified My TrustHub session and returns to the canonical profile.
 *   5. The specialist reports an account Save or Unsave only when it holds the
 *      parent's signed acknowledgement for that hand-off. Otherwise the Save
 *      stays "device", and an Unsave is shown as possibly still in the account.
 *
 * This file defines that contract for Contractor and nothing more. There is no
 * transport, no key, no origin and no request here. `parentSyncMode` returns
 * "off" unless an explicit server setting says otherwise, and no production
 * setting is defined in this ship: turning sync on requires the reviewed
 * runtime (signed channel, transfer store, parent packets) that does not exist
 * for Contractor yet.
 */
import type { ContractorSaveIdentity, NotReadyReason } from "./profile-identity";

export type ParentSyncMode = "off";
/** Always "off" in this ship. A future reviewed runtime replaces this. */
export function parentSyncMode(env: Record<string, string | undefined> = process.env): ParentSyncMode {
  void env;
  return "off";
}

export type DeviceIntent = "save" | "unsave";
/** What a device Save may do next. With sync off it is always device-only. */
export type SyncPlan =
  | { kind: "device_only"; reason: "sync_off" | "not_on_profile" | NotReadyReason | "not_eligible" }
  | { kind: "hand_off"; intent: DeviceIntent; identity: ContractorSaveIdentity };

export function planSync(input: { mode: ParentSyncMode; onCanonicalProfile: boolean; identity: ContractorSaveIdentity | null; notReady?: NotReadyReason; intent: DeviceIntent }): SyncPlan {
  if (input.mode === "off") return { kind: "device_only", reason: "sync_off" };
  if (!input.onCanonicalProfile) return { kind: "device_only", reason: "not_on_profile" };
  if (!input.identity) return { kind: "device_only", reason: input.notReady ?? "not_eligible" };
  return { kind: "hand_off", intent: input.intent, identity: input.identity };
}

/** Outcome of one hand-off, read back after the parent returns. Only
 * `confirmed` is an account Save / Unsave. */
export type ParentOutcome = "confirmed" | "not_confirmed" | "unknown";

/** Server port the future runtime implements. Named after the Move runtime's
 * steps so the two stay comparable. */
export interface ContractorParentPort {
  /** Publication proof for one exact identity from Contractor's own source. */
  resolvePublication(identity: Pick<ContractorSaveIdentity, "nativeId" | "profileClass">): Promise<ContractorSaveIdentity | null>;
  /** Exactly one accepted parent binding for the identity, or null. */
  acceptedBinding(identity: ContractorSaveIdentity): Promise<{ bindingRef: string } | null>;
  /** Stage a Save or Unsave hand-off. Returns an opaque ticket and the fixed
   * parent form target, or null when not eligible / unavailable. */
  stage(identity: ContractorSaveIdentity, intent: DeviceIntent): Promise<{ ticket: string; target: string; continuationRef: string } | null>;
  /** Whether the parent's signed acknowledgement is held for a ticket. */
  acknowledged(ticket: string): Promise<boolean>;
}

/** The port in this ship: nothing is eligible, nothing is staged. */
export const DISABLED_PARENT_PORT: ContractorParentPort = {
  resolvePublication: async () => null,
  acceptedBinding: async () => null,
  stage: async () => null,
  acknowledged: async () => false,
};

/** Device sync state after a hand-off outcome. An Unsave that is not confirmed
 * keeps the belief that the profile is still in the account. */
export function nextSyncState(current: "device" | "pending" | "synced", intent: DeviceIntent, outcome: ParentOutcome): "device" | "pending" | "synced" {
  if (intent === "save") return outcome === "confirmed" ? "synced" : outcome === "unknown" ? "pending" : "device";
  return outcome === "confirmed" ? "device" : current;
}
