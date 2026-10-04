import { createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify } from "node:crypto";

/**
 * Service assertion for the Contractor <-> My TrustHub (Ask) channel.
 *
 * This is the shared v23 assertion used by Move and Lender, with the hub claim
 * named for Contractor. Same header, same JWS shape, same claim set, same TTL,
 * same replay rule. Claim keys include contractor_origin and never move_origin
 * or lender_origin, so a token for one hub cannot verify as another.
 *
 *   header  { alg: "EdDSA", typ: "trusthub-v23+jws", kid }
 *   claims  v, iss, sub, aud, scope, method, path, body_sha256, iat, exp, jti,
 *           ask_origin, contractor_origin, browser, session, grant
 *   iss     urn:trusthub:v23:<ask project>:<service>
 *   sub     svc:trusthub:<service>:v23:<environment>
 *   aud     the exact target URL; exp = iat + 30s; jti single use
 */
export const ASSERTION_HEADER = "x-trusthub-v23-assertion";
export const ASSERTION_TTL_SECONDS = 30;
export type Scope = "source:read" | "source:ack" | "transfer:stage" | "receipt:verify";
export type ContractorService = "ask" | "contractor";
export type AssertionKey = { kid: string; pem: string };
export type ContractorPins = {
  parentOrigin: string;
  contractorOrigin: string;
  project: string;
  assertionEnvironment: "isolated" | "production";
};
export const CONTRACTOR_PRODUCTION_PINS: ContractorPins = {
  parentOrigin: "https://www.asktrusthub.com",
  contractorOrigin: "https://www.contractortrusthub.com",
  project: "qvvxvbcdmbjzrgvwjatw",
  assertionEnvironment: "production",
};
const opaque = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{43}$/.test(v);
export const contractorServiceIdentity = (service: ContractorService, pins: ContractorPins) => `svc:trusthub:${service}:v23:${pins.assertionEnvironment}`;
export const contractorIssuer = (service: ContractorService, pins: ContractorPins) => `urn:trusthub:v23:${pins.project}:${service}`;
export type ContractorAssertionClaims = {
  v: 1; iss: string; sub: string; aud: string; scope: Scope; method: "POST"; path: string;
  body_sha256: string; iat: number; exp: number; jti: string;
  ask_origin: string; contractor_origin: string; browser: string; session: string | null; grant: string | null;
};
const CLAIM_KEYS = "ask_origin,aud,body_sha256,browser,contractor_origin,exp,grant,iat,iss,jti,method,path,scope,session,sub,v";
const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
function decode(value: string): unknown {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || Buffer.from(value, "base64url").toString("base64url") !== value) throw new Error("unauthorized");
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}
export const bodyDigest = (body: Uint8Array) => createHash("sha256").update(body).digest("hex");
export type NonceStore = { claim(key: string, expiresAt: number): Promise<boolean> };

/** Contractor signs toward Ask; Ask signs toward Contractor. The target origin
 * must be the other party's pinned origin. */
export function signContractorAssertion(key: AssertionKey, service: ContractorService, target: string, scope: Scope, body: Uint8Array,
  browser: string, session: string | null = null, grant: string | null = null, now = Date.now(), pins: ContractorPins = CONTRACTOR_PRODUCTION_PINS): string {
  const url = new URL(target), privateKey = createPrivateKey(key.pem);
  if (privateKey.asymmetricKeyType !== "ed25519" || !opaque(browser) || url.search || url.hash ||
      url.origin !== (service === "ask" ? pins.contractorOrigin : pins.parentOrigin)) throw new Error("unavailable");
  const iat = Math.floor(now / 1000);
  const claims: ContractorAssertionClaims = { v: 1, iss: contractorIssuer(service, pins), sub: contractorServiceIdentity(service, pins), aud: target,
    scope, method: "POST", path: url.pathname, body_sha256: bodyDigest(body), iat, exp: iat + ASSERTION_TTL_SECONDS,
    jti: randomBytes(32).toString("base64url"), ask_origin: pins.parentOrigin, contractor_origin: pins.contractorOrigin, browser, session, grant };
  const unsigned = encode({ alg: "EdDSA", typ: "trusthub-v23+jws", kid: key.kid }) + "." + encode(claims);
  return unsigned + "." + sign(null, Buffer.from(unsigned), privateKey).toString("base64url");
}

export async function verifyContractorAssertion(request: Request, body: Uint8Array, key: AssertionKey, service: ContractorService,
  scope: Scope, nonces: NonceStore, now = Date.now(), pins: ContractorPins = CONTRACTOR_PRODUCTION_PINS): Promise<ContractorAssertionClaims> {
  try {
    const value = request.headers.get(ASSERTION_HEADER);
    if (!value || value.length > 4096 || request.method !== "POST" || body.length > 131072) throw 0;
    const pieces = value.split("."); if (pieces.length !== 3) throw 0;
    const header = decode(pieces[0]!) as Record<string, unknown>;
    if (!header || Object.keys(header).sort().join() !== "alg,kid,typ" || header.alg !== "EdDSA" || header.typ !== "trusthub-v23+jws" || header.kid !== key.kid) throw 0;
    const publicKey = createPublicKey(key.pem), signature = Buffer.from(pieces[2]!, "base64url");
    if (publicKey.asymmetricKeyType !== "ed25519" || signature.length !== 64 || signature.toString("base64url") !== pieces[2] ||
      !verify(null, Buffer.from(pieces[0] + "." + pieces[1]), publicKey, signature)) throw 0;
    const claims = decode(pieces[1]!) as ContractorAssertionClaims;
    if (!claims || Object.keys(claims).sort().join() !== CLAIM_KEYS) throw 0;
    const url = new URL(request.url), seconds = Math.floor(now / 1000);
    if (url.search || url.hash || url.origin !== (service === "contractor" ? pins.parentOrigin : pins.contractorOrigin) ||
      claims.v !== 1 || claims.iss !== contractorIssuer(service, pins) || claims.sub !== contractorServiceIdentity(service, pins) || claims.aud !== request.url ||
      claims.scope !== scope || claims.method !== request.method || claims.path !== url.pathname || claims.body_sha256 !== bodyDigest(body) ||
      claims.ask_origin !== pins.parentOrigin || claims.contractor_origin !== pins.contractorOrigin || !opaque(claims.browser) || !opaque(claims.jti) ||
      claims.session !== null && !/^[a-f0-9]{64}$/.test(claims.session) || claims.grant !== null && !opaque(claims.grant) ||
      !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.exp - claims.iat !== ASSERTION_TTL_SECONDS ||
      claims.iat > seconds + 2 || claims.exp <= seconds || claims.iat < seconds - ASSERTION_TTL_SECONDS) throw 0;
    if (!await nonces.claim(bodyDigest(Buffer.from(claims.iss + ":" + key.kid + ":" + claims.jti)), (claims.exp + 2) * 1000)) throw 0;
    return claims;
  } catch { throw new Error("unauthorized"); }
}
