# My TrustHub V2 — Contractor side, Florida DBPR profiles (2026-10-03)

Contractor's half of the model proven on Move, for Florida DBPR contractor
profiles only. **Production parent sync is OFF and cannot be turned on from
this code:** there is no live mode and the parent port has no transport. Ask is
not modified and not contacted.

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

## Signed manifest (`lib/my-trusthub/manifest.ts`)

Built and signed on the server. Closed field set, fixed order:

```
version = contractor-profile-save/1
hub = contractor            audience = ask           intent = save | unsave
profile_class = contractor_profile
identifier_namespace = fl.dbpr.license
source_identifier = <DBPR external_key>
jurisdiction = FL
canonical_return_path = /contractors/<slug>
browser = sha256(hand-off binding)     nonce     issued_at     expires_at (+600 s)
```

Envelope: `base64url(header).base64url(payload).base64url(Ed25519 signature)`,
header `{ alg: EdDSA, typ: trusthub-save-manifest, kid, v }`. Key:
`MY_TRUSTHUB_CONTRACTOR_KEY_ID` + `MY_TRUSTHUB_CONTRACTOR_SIGNING_PRIVATE_KEY_PEM`
(not configured anywhere today). The envelope is Contractor's side of a shared
contract that is still being built on Ask; the fields are the fixed part.

The browser can send only `{ slug, intent }`. Any identity field from the
browser (license key, contractor or network UUID, name, jurisdiction, return
path) is rejected with 400.

## Runtime pieces

| Piece | File | State |
| --- | --- | --- |
| Same-origin endpoint | `app/api/my-trusthub/profile-save/route.ts`, `lib/my-trusthub/profile-save-http.ts` | 503 in production (mode `off`) |
| Adapter | `lib/my-trusthub/parent-adapter.ts` | modes `off` (default; forced in production) and `dry_run` (non-production: resolve + build + sign, contact nobody) |
| Parent port | `ContractorParentPort` | `DISABLED_PARENT_PORT` only: no transport |
| Browser hand-off | `lib/my-trusthub/direct-save-client.ts`, `SaveContractorToggle` | behind `NEXT_PUBLIC_MY_TRUSTHUB_CONTRACTOR_SYNC=1` (off): device first, blocking "keep this page open" notice, pending marker on the device, Save/Unsave reported only on the parent's acknowledgement, "May still be saved in My TrustHub · Remove it there" recovery |

What the shared runtime still has to supply before activation: the signed
server channel to Ask, a durable transfer store for tickets, the parent's
exact-binding resolver for `contractor / contractor_profile / fl.dbpr.license / FL`,
the acknowledgement callback, and the Contractor signing key. `stage()` and
`acknowledged()` on the port are where it plugs in.

## Legacy hand-off

`components/contractor/MyTrustHubSave.tsx` and `app/api/my-trusthub/issue/route.ts`
are marked deprecated. They are not used or extended by this path. Remove both
(and the component's use on the Trust Report) when the parent adapter is
activated.

## Florida canary profiles

Ordinary live Trust Reports, non-thin, one DBPR license key on the public page,
active status, three different trades (checked on production 2026-10-03):

| # | Slug | Name | DBPR external_key | Credential |
| --- | --- | --- | --- | --- |
| 1 | `ccc057187-a-r-roofing-inc` | A & R ROOFING INC | `CCC057187` | Certified Roofing Contractor |
| 2 | `cfc1427249-a-sunny-plumbing-company` | A SUNNY PLUMBING COMPANY | `CFC1427249` | Certified Plumbing Contractor |
| 3 | `cgc1506243-abs-contracting-inc` | ABS CONTRACTING INC | `CGC1506243` | Certified General Contractor |

"Exactly one attached credential" and "key attached to one profile" were read
from the public pages, not from the database; the adapter re-proves both on the
server at stage time. Run a dry-run `prepare` for each before the first live proof.

## Tests

`npm run check:mth-con-prep-001` (11 tests): identity and fail-closed reasons,
publication by slug and by credential, manifest sign/verify/tamper, adapter
dry-run and the shape of the live path with a fake port, endpoint CSRF and
field rejection, production-off, hand-off client including abandoned hand-off
and refusal, device Save, Watch/Compare/My Contractor unchanged, legacy unused.
