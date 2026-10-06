# My TrustHub V2 — My Contractor prep (2026-10-03)

One My TrustHub account (on Ask). My Contractor is this hub's specialist
workspace, not a separate consumer account. Save is not Watch. Parent
(My TrustHub) sync is **off** for Contractor; nothing in this prep contacts Ask.

## What existed before this prep

| Area | Route / file | Notes |
| --- | --- | --- |
| Optional Contractor sign-in | `/account`, `components/account/AccountClient.tsx`, `app/api/auth/{request-link,verify,me,logout}`, `lib/auth/*` | Email magic link; own session. Presented as "Account", "Optional account", "Save / sign in". |
| Durable workspace | `app/api/account/{sync,import-local,preferences}`, `lib/passport/{local-workspace,workspace-server}.ts` | Projects, watches, Home Passports, alert preferences. |
| Alerts | `app/api/alerts/check`, alert preferences on `/account` | Email on license-status change for watched contractors. |
| Watch | `/watch`, `components/projects/WatchButton.tsx`, `components/watch/WatchedListClient.tsx`, `lib/projects/store.ts` (`cth-projects-store-v1`) | Device list with a license snapshot; described as "Saved on this device". |
| Compare shortlist | `/compare`, `components/compare/*`, `cth-compare` storage | Max 3. Its toggle was labelled **Save / Saved** on Trust Reports and result cards. |
| Projects | `/projects`, `/projects/[id]`, `/projects/[id]/payments`, `lib/projects/*` | Milestones, payments, contract analysis. |
| Home Passport | `/passport`, `/passport/[propertyId]` | Completed-project records. |
| Property / permits | `/property`, `/property/[id]`, `app/api/property/*` | Permit research where covered. |
| License / credential research | `/verify`, `/contractors/[slug]`, `/contractors/[slug]/summary`, `/credentials`, `/credentials/[id]` | Trust Reports and standalone credential lookup. |
| Decision tools | `/tools/*`, `/plan`, `/studios` | Scope Builder, Quote and Contract Analyzer, Compare bids, Pre-hire checklist. |
| Ask research | `/ask`, `components/ask/SaveToResearch.tsx` | Recent questions on device. |
| Legacy My TrustHub Save | `components/contractor/MyTrustHubSave.tsx`, `app/api/my-trusthub/issue/route.ts` | One hard-coded profile id, old hand-off protocol, behind `MY_TRUSTHUB_CONTRACTOR_SAVE_ENABLED` (off). Untouched. |
| Business claim | `app/api/claim/handoff/[profileId]`, `lib/claim/*` | Business-side, not consumer Save. Untouched. |

There was no saved-contractors list and no profile Save in the Move sense: the
only control reading "Save" was the compare shortlist.

## What this prep adds

- **Save toggle** on Trust Reports (`components/contractor/SaveContractorToggle.tsx`):
  ♡ Save → ♥ Saved → ♡ Save, one control, `aria-pressed`. Device only
  (`cth-saved-contractors-v1`, `lib/saved/store.ts`). Shown only for real,
  non-thin profiles with an exact profile id. No Watch, no network.
- The compare shortlist toggle now reads **Compare / Comparing / Compare full**
  so only one control says Save. Same behaviour and storage.
- **My Contractor** (`/my-contractor`): saved contractors plus links to the
  existing workspace surfaces. No new capability.
- **One-account presentation**, off by default
  (`NEXT_PUBLIC_MY_TRUSTHUB_ONE_ACCOUNT=1`, bundled at build): header
  "My TrustHub" entry to `https://www.asktrusthub.com/my`, a "Your account is
  My TrustHub" card on My Contractor, and the Contractor sign-in described as
  "Workspace sync" instead of an account. It moves no data and changes no
  session; `/account` keeps working as today.
- **Identity and adapter prep** (`lib/my-trusthub/profile-identity.ts`,
  `parent-adapter.ts`): profile classes, exact identity, readiness reasons, the
  adapter contract. The closed-gate prep left `parentSyncMode()` off. The one-profile activation in `ONE-PROFILE-CANARY.md` opens the canary constant for one slug and leaves broad false.

## Profile classes

> Identity update: the first parent ship is Florida DBPR only and the native
> identity is the DBPR license `external_key`, not `contractors.id`. See
> `florida-integration.md`, which supersedes the identity and parent-ready
> columns below.

| Class | Page | Native identity | Namespace | Jurisdiction | Publication source | Grain | Parent-ready |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `contractor_profile` with a Florida DBPR credential | `/contractors/<slug>` | `contractors.id` + an attached license `external_key` | `fl.dbpr.license` | FL | `contractors` joined to `licenses` (`source_system = fl_dbpr`), non-thin, state live | one `contractors` row | YES |
| `contractor_profile` with an NJ DCA credential | `/contractors/<slug>` | `contractors.id` + `external_key` | `nj.dca.license` (proposed; not yet used by Ask) | NJ | same, `source_system = nj_dca` | one `contractors` row | YES on the Contractor side; needs the namespace agreed with Ask |
| `contractor_profile`, other credential sources (`ca_cslb`, `tx_tdlr`, `tx_tsbpe`, `wa_lni`, `az_roc`, `or_ccb`, `co_dora`, `la_lslbc`, `ms_sbc`, `ky_dhbc`, ...) | `/contractors/<slug>` | `contractors.id` + `external_key` | not reviewed | per source | same read | one `contractors` row | NO until each source is reviewed |
| `contractor_profile` with reviewed credentials in two jurisdictions | `/contractors/<slug>` | — | — | ambiguous | — | — | NO |
| thin profile (`is_thin_profile`) | `/contractors/<slug>` | none exact | — | — | name/entity/enforcement evidence only | — | NO (no Save control) |
| `standalone_credential` | `/credentials/<id>` | `licenses (source_system, external_key)` | per source | FL / NY | `licenses` with no contractor, certified batches, behind the publication flag | one credential record (person or regulatory) | NO (different grain; no Save control) |

The `contractor_profile` shape follows the binding My TrustHub already holds for
Contractor: `hub = contractor`, `specialist_entity_type = contractor_profile`,
`specialist_entity_id = contractors.id`, `identifier_namespace = fl.dbpr.license`,
`source_identifier = <license key>`, `jurisdiction = FL`.

Open question before any parent sync: `contractors.id` is a database-generated
UUID. It is treated as durable today (claim and the legacy Save both key on it)
but its stability across a full re-ingest has not been verified here.

## Not done here

No Ask change, no SQL, no auth/session change, no parent runtime, no production
sync. The legacy single-profile hand-off and the claim flow are untouched.
