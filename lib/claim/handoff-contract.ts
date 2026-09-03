import { createHmac, randomBytes } from "node:crypto";

export const ATH_HANDOFF_AUDIENCE = "asktrusthub" as const;
export const ATH_HANDOFF_TTL_SECONDS = 15 * 60;

export type AthHandoffPayload = {
  v: 2;
  aud: typeof ATH_HANDOFF_AUDIENCE;
  hub_id: "contractor";
  native_profile_id: string;
  slug: string;
  external_key: string;
  source_system: "fl_dbpr";
  home_state: "FL";
  identifier_namespace: "credential";
  entity_class: "contractor";
  canonical_profile_url: string;
  display_name: string;
  iat: number;
  exp: number;
  nonce: string;
};

export function mintAthHandoffToken(
  secret: string,
  profile: { id: string; slug: string; externalKey: string; displayName: string },
  options: { now?: Date; nonce?: string } = {}
): { token: string; payload: AthHandoffPayload } {
  if (secret.length < 32) {
    throw new Error("ATH_HANDOFF_SECRET is unavailable");
  }
  const iat = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const payload: AthHandoffPayload = {
    v: 2,
    aud: ATH_HANDOFF_AUDIENCE,
    hub_id: "contractor",
    native_profile_id: profile.id,
    slug: profile.slug,
    external_key: profile.externalKey,
    source_system: "fl_dbpr",
    home_state: "FL",
    identifier_namespace: "credential",
    entity_class: "contractor",
    canonical_profile_url: `https://www.contractortrusthub.com/contractors/${profile.slug}`,
    display_name: profile.displayName,
    iat,
    exp: iat + ATH_HANDOFF_TTL_SECONDS,
    nonce: options.nonce ?? randomBytes(24).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(body, "utf8").digest("base64url");
  return { token: `${body}.${signature}`, payload };
}
