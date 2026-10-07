# My TrustHub V2 — Contractor side, Florida DBPR profiles (2026-10-03)

Contractor's half of the shared My TrustHub hand-off, for Florida DBPR
contractor profiles only. Contractor speaks the same protocol Move and Lender
use in production; only the specialist identity differs. **This branch is the
one-profile activation artifact.** `CONTRACTOR_CANARY_ACTIVE` is `true` and
`CONTRACTOR_CANARIES` contains only `ccc057187-a-r-roofing-inc`.
`CONTRACTOR_PARENT_SYNC_BROAD` stays `false`. Production is unchanged until
this commit is merged and deployed. Prerequisites, the kill switch, and the
later three-profile follow-up are in `ONE-PROFILE-CANARY.md`. An unset
browser flag does not close the server gate.

## Identity (founder decision)

| | |
| --- | --- |
| Profile class | `contractor_profile` |
| Identifier namespace | `fl.dbpr.license` |
| Jurisdiction | `FL` |
| Native identity | the one Florida DBPR license `external_key` attached to the profile (e.g. `CCC057187`) |
| Return path | `/contractors/<slug>` |
| Publication source | Contractor production database: `contractors` joined to `licenses`, read through the Trust Report's own `getContractorBySlug` |
| Publication grain | one `contractors` row |

`contractors.id` (a database-generated UUID, durability across re-ingest
unproven) is **not** an identity. It stays a local row reference for the device
Save only and never appears in a manifest. The slug is the return path, not an
identity.

## Eligibility (`lib/my-trusthub/profile-identity.ts`, `publication.ts`)

A profile may stage a parent Save only when all hold:

1. `/contractors/<slug>` resolves to a public profile whose own slug is that slug;
2. not thin;
3. `home_state = FL`;
4. every attached credential is `fl_dbpr` (any other source = unresolved
   multi-jurisdiction identity);
5. exactly one distinct DBPR `external_key`, well formed (`^[A-Z]{1,4}[0-9]{3,9}$`);
6. that key is attached to exactly one public profile, and it is this one.

Otherwise the device Save works and nothing is staged. Reasons are explicit:
`thin_profile`, `not_florida`, `no_fl_dbpr_credential`, `invalid_credential_key`,
`multiple_fl_credentials`, `multi_jurisdiction`, `credential_not_unique`,
`not_public`, `source_unavailable`.

Device Save only in this ship: NJ DCA, CA CSLB, TX, WA, AZ, OR, CO, LA, MS, KY
and every other source; standalone `/credentials/<id>`; thin profiles; Florida
profiles with more than one DBPR credential (no selection rule has been
decided); profiles with credentials in more than one source.

## Shared protocol (`manifest.ts`, `contractor-assertion.ts`, `parent-adapter.ts`, `source-callback.ts`)

The provisional `contractor-profile-save/1` envelope is gone. The wire is the
shared one.

**Identity on the wire.** The shared profile identity is `{ hub, nativeId,
profileClass }`. Contractor's is

```
hub = contractor      profileClass = contractor_profile
nativeId = fl.dbpr.license:<DBPR external_key>      e.g. fl.dbpr.license:CCC057187
```

The namespace prefix carries the jurisdiction (`fl.dbpr.license` is Florida and
nothing else), the way Lender's `nmls:<n>` carries its registry. Changing the
key, the namespace or the class changes the identity and the manifest digest.

**Manifest** `v2-3/selected-profiles/3` (same closed shape and positional
SHA-256 digest as Ask's `contracts/v2-3-profile-transfer.ts`):

```
{ version, sourceHub: "contractor", audience: "ask",
  selected: [{ localItemId: <slug>, revision: "1", digest: sha256(JSON([nativeId, returnPath])), profile }],
  returnTask: { kind: "profile", hub: "contractor", canonicalSlug: <slug>, profile, returnPath: "/contractors/<slug>" } }
```

**Service assertion** (header `x-trusthub-v23-assertion`): compact Ed25519 JWS,
header `{ alg: EdDSA, typ: trusthub-v23+jws, kid }`, claims `v, iss, sub, aud,
scope, method, path, body_sha256, iat, exp (+30 s), jti (single use),
ask_origin, contractor_origin, browser, session, grant`. Identical to Move's and
Lender's except the hub origin claim is named `contractor_origin`. Origins are
pinned: `https://www.asktrusthub.com`, `https://www.contractortrusthub.com`.

**Flow.**

1. Device Save first. The browser then sends `{ slug, intent }` to the
   same-origin endpoint (`intent` = `save` | `save_signin` | `unsave`). Any other
   field (license key, contractor or network UUID, name, jurisdiction,
   namespace, return path) is rejected with 400.
2. The server proves publication, derives the identity, builds the manifest and
   stages it with two signed calls (scope `transfer:stage`) to
   `POST https://www.asktrusthub.com/api/my-trusthub/profile-save`, body
   `{ version: "v2-3/parent-runtime/1", operation, input }`:
   `prepareGuestProfileTransfer` then `prepareProfileSaveContinuation`.
3. The browser makes a top-level form POST of `{ continuationRef, intent }` to
   `https://www.asktrusthub.com/my/profile-save`.
4. Ask calls back `POST /api/my-trusthub/profile-save/source` with its own
   assertion: `resolve` and `source` (scope `source:read`; the manifest is
   rebuilt from Contractor's own read and must match), then `acknowledge`
   (scope `source:ack`).
5. The profile reports an account Save or Unsave only when that
   acknowledgement is held for this hand-off and this browser
   (`ack-store.ts`, table `my_trusthub_handoff_acks`).

Signed out, a `save` returns without asking and the Save stays on the device;
"Sign in to My TrustHub" hands off again with `save_signin` and the parent
finishes the Save after sign-in. An abandoned hand-off leaves a pending marker
on the device; the next visit reports what the parent acknowledged, and an
unacknowledged Unsave keeps "May still be saved in My TrustHub · Remove it
there". Save never creates a Watch; an acknowledgement that mentions one is
refused.

## Configuration (names only; no values exist in this repo)

Contractor deployment:

| Variable | Purpose |
| --- | --- |
| `MY_TRUSTHUB_V23_CONTRACTOR_KEY_ID` | key id of Contractor's signing key |
| `MY_TRUSTHUB_V23_CONTRACTOR_SIGNING_PRIVATE_KEY_PEM` | Contractor's Ed25519 private key (PKCS#8 PEM) |
| `MY_TRUSTHUB_V23_ASK_KEY_ID` | key id of Ask's callback signing key |
| `MY_TRUSTHUB_V23_ASK_VERIFY_PUBLIC_KEY_PEM` | Ask's Ed25519 public key (SPKI PEM) for the source callback |
| `MY_TRUSTHUB_V23_PARENT_ORIGIN` | optional; if set it must equal `https://www.asktrusthub.com` |
| `NEXT_PUBLIC_MY_TRUSTHUB_CONTRACTOR_SYNC` | `1` shows the client half during the authorized deployment window; build-time; this commit does not set it; an unset value is not the server kill switch |

Ask deployment (matching half): `MY_TRUSTHUB_V23_CONTRACTOR_KEY_ID`,
`MY_TRUSTHUB_V23_CONTRACTOR_VERIFY_PUBLIC_KEY_PEM`.

Without the Ask verification key the source callback answers 503. Without the
signing key nothing is staged.

## Runtime pieces

| Piece | File | State |
| --- | --- | --- |
| Same-origin endpoint | `app/api/my-trusthub/profile-save/route.ts`, `lib/my-trusthub/profile-save-http.ts` | gated for `ccc057187-a-r-roofing-inc` when this commit is deployed; 503 while both gate constants are false |
| Adapter and gate | `lib/my-trusthub/parent-adapter.ts` | canary constant true, one slug, broad false; `dry_run` only while both constants are false |
| Source callback | `app/api/my-trusthub/profile-save/source/route.ts`, `lib/my-trusthub/source-callback.ts` | 503 until Ask's verification key is configured |
| Acknowledgements | `lib/my-trusthub/ack-store.ts`, `schema/migrations/016_my_trusthub_handoff_acks.sql` | migration **not applied**; operator applies it before the canary |
| Browser hand-off | `lib/my-trusthub/direct-save-client.ts`, `SaveContractorToggle`, `lib/my-trusthub/client-sync.ts` | starts only when the build value is `1`; this commit does not set that value |

## Activation checklist

This commit is the Contractor code step, reduced to one profile. It is not
merged. Do not merge until `ONE-PROFILE-CANARY.md` is satisfied.

1. Ask SQL is complete, Packet 19 is final, and the Contractor binding is installed.
2. Operator: keys provisioned, Ask verify key deployed, Contractor signer deployed, migration 016 applied, closed-gate kill switch recorded, operator authorization recorded.
3. This commit: `CONTRACTOR_CANARY_ACTIVE = true`, active slug `ccc057187-a-r-roofing-inc` only, `CONTRACTOR_PARENT_SYNC_BROAD` left `false`. The browser value `1` belongs to the authorized deployment build. This commit does not set it.

## Legacy hand-off

`components/contractor/MyTrustHubSave.tsx` and `app/api/my-trusthub/issue/route.ts`
are marked deprecated. They are not used or extended by this path. Remove both
(and the component's use on the Trust Report) when the parent adapter is
activated.

## Florida canary profiles

The first profile is the only activation candidate. The later expansion list
uses ABACO per the Founder decision of 2026-10-07. Reverify each expansion
candidate before admission; the prior 2026-10-03 proof does not certify ABACO.

| # | Slug | Name | DBPR external_key | Credential |
| --- | --- | --- | --- | --- |
| 1 | `ccc057187-a-r-roofing-inc` | A & R ROOFING INC | `CCC057187` | Certified Roofing Contractor |
| 2 | `cfc1427249-a-sunny-plumbing-company` | A SUNNY PLUMBING COMPANY | `CFC1427249` | Certified Plumbing Contractor |
| 3 | `cgc1517216-abaco-construction-inc` | ABACO CONSTRUCTION INC | `CGC1517216` | Certified General Contractor |

CCC057187 readiness and credential uniqueness were checked through the approved
production connector on 2026-10-07; see `lane-b-readiness-20261007.json`. The
adapter re-proves both on the server at stage time. The active array in this commit is only row 1. Rows 2 and
3 remain denied. Expanding to all three is a later reviewed change
after row 1's Save chain passes. Broad mode stays false. See
`ONE-PROFILE-CANARY.md`.

## Tests

`npm run check:mth-con-prep-001` (16 tests): one-profile admission, identity and fail-closed reasons;
publication by slug and by shared profile identity; manifest shape with digests
pinned to Ask's contract code; assertion claim set, replay, expiry, audience,
scope and wrong-hub rejection; the full signed chain for all three canaries
against a stand-in parent that verifies with the same assertion code; tampered
key / jurisdiction / digest and browser-supplied identity rejected; ineligible
and non-canary profiles stage nothing; signed-out continuation; abandoned
hand-off recovery and Project-conflict refusal; production off (nothing read,
signed or sent); legacy unused; Watch, Compare and My Contractor unchanged.
