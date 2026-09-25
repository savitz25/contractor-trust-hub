import { createHmac, randomBytes } from "node:crypto";
import { isClaimableCredentialPair, type ClaimState } from "./eligibility";

export const ATH_HANDOFF_AUDIENCE = "asktrusthub" as const;
export const ATH_HANDOFF_TTL_SECONDS = 15 * 60;

/**
 * ATH-CLAIM-V2-001R2 (Q2) — `acquisition_source` travels INSIDE the signed payload, authenticated by the same
 * HMAC as everything else here. It is never read from an unauthenticated query string or browser POST body.
 * The public claim-start route (`lib/claim/start-core.ts`) always mints `organic` and offers no way for
 * request data to change that. Only trusted server-side callers of `mintAthHandoffToken` directly — never
 * reachable from a browser — may set `manual_outreach` or `internal_test`.
 */
export const ATH_HANDOFF_ACQUISITION_SOURCES = ["organic", "manual_outreach", "internal_test", "email_campaign"] as const;
export type AthHandoffAcquisitionSource = (typeof ATH_HANDOFF_ACQUISITION_SOURCES)[number];

export type AthHandoffPayload = {
  v: 2;
  aud: typeof ATH_HANDOFF_AUDIENCE;
  hub_id: "contractor";
  native_profile_id: string;
  slug: string;
  external_key: string;
  /** ATH-CLAIM-V2-FLNJ-001: the selected credential's real source and the claim state it establishes. */
  source_system: "fl_dbpr" | "nj_dca";
  home_state: ClaimState;
  identifier_namespace: "credential";
  entity_class: "contractor";
  canonical_profile_url: string;
  display_name: string;
  acquisition_source: AthHandoffAcquisitionSource;
  iat: number;
  exp: number;
  nonce: string;
};

export function mintAthHandoffToken(
  secret: string,
  profile: { id: string; slug: string; externalKey: string; displayName: string; homeState: ClaimState; sourceSystem: string },
  options: { now?: Date; nonce?: string; acquisitionSource?: AthHandoffAcquisitionSource } = {}
): { token: string; payload: AthHandoffPayload } {
  if (secret.length < 32) {
    throw new Error("ATH_HANDOFF_SECRET is unavailable");
  }
  // Only an allow-listed (source, state) pair from the trusted server-side lookup is ever signed.
  if (!isClaimableCredentialPair(profile.sourceSystem, profile.homeState)) {
    throw new Error("claim credential pair is not claimable");
  }
  const iat = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const payload: AthHandoffPayload = {
    v: 2,
    aud: ATH_HANDOFF_AUDIENCE,
    hub_id: "contractor",
    native_profile_id: profile.id,
    slug: profile.slug,
    external_key: profile.externalKey,
    source_system: profile.sourceSystem as AthHandoffPayload["source_system"],
    home_state: profile.homeState,
    identifier_namespace: "credential",
    entity_class: "contractor",
    canonical_profile_url: `https://www.contractortrusthub.com/contractors/${profile.slug}`,
    display_name: profile.displayName,
    acquisition_source: options.acquisitionSource ?? "organic",
    iat,
    exp: iat + ATH_HANDOFF_TTL_SECONDS,
    nonce: options.nonce ?? randomBytes(24).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(body, "utf8").digest("base64url");
  return { token: `${body}.${signature}`, payload };
}
