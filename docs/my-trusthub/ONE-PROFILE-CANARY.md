> SHUTOFF BRANCH: both server constants are false; the CCC057187-only list is unchanged.
> This forward-fix is based on frozen activation head `b43b561fcfc9488d916dcc834b969d657ad7e51f`.
> The activation specification below describes that parent. Do not merge or deploy this shutoff without separate authorization.

# Contractor one-profile canary — activation artifact

Status of this commit: **unmerged and undeployed**. Production stays on the
reviewed specialist lineage `71c3d9a68a31a7fc08fefbf827cf9f50c15369f4`. `CONTRACTOR_CANARY` in production stays **OFF**
until an operator merges and deploys this commit inside an authorized window.

This commit contains no production secrets and no environment assignments.
It does not create keys. It does not apply migration 016. It does not set
`NEXT_PUBLIC_MY_TRUSTHUB_CONTRACTOR_SYNC`.

## PR #121 MUST NOT MERGE until ALL of these are proven

This is a live production gate. A short label is not proof. No secret values
belong in this document. Merging earlier opens the server gate for one profile
on the next deploy.

1. Ask production code. Ask production contains the final Investor, Contractor,
   Senior, and Packet 19 code, and the serving Ask deployment SHA is recorded.

2. Ask SQL is complete. The certified Ask production SQL sequence has completed
   successfully. Post-SQL validation is PASS.

3. Packet 19 authority is live. Packet 19 is final on the real production
   database only when `v23_private.authority()` fingerprint equals exactly
   `17f464ad69f3d8c7a89dd2cf9229f112` and the final hubs are move, insurance, lender, investor, contractor, and senior.

4. The exact Contractor binding is installed. Production `prod_contractor_dbpr_binding_for(...)` is installed. CCC057187 must resolve to exactly one current accepted binding on an active network entity. The operator must verify the network entity is active in production; accepted binding status alone is insufficient. An inactive or retired entity blocks activation. That binding is hub = contractor, profile class = contractor_profile, namespace = fl.dbpr.license, jurisdiction = FL, canonical profile `/contractors/ccc057187-a-r-roofing-inc`. No ambiguity. The Packet 16 receipt file is saved.

5. The Ask verify key is deployed. Ask production has
   `MY_TRUSTHUB_V23_CONTRACTOR_KEY_ID` and
   `MY_TRUSTHUB_V23_CONTRACTOR_VERIFY_PUBLIC_KEY_PEM` installed, and the
   resulting Ask deployment is recorded.

6. The Contractor signer is deployed. Keys are provisioned under these exact
   Contractor production names:
   `MY_TRUSTHUB_V23_CONTRACTOR_KEY_ID`,
   `MY_TRUSTHUB_V23_CONTRACTOR_SIGNING_PRIVATE_KEY_PEM`,
   `MY_TRUSTHUB_V23_ASK_KEY_ID`,
   `MY_TRUSTHUB_V23_ASK_VERIFY_PUBLIC_KEY_PEM`, and
   `MY_TRUSTHUB_V23_PARENT_ORIGIN` either unset or the exact Ask origin
   `https://www.asktrusthub.com`.

7. Contractor migration 016 is applied. `016_my_trusthub_handoff_acks.sql` is
   applied to the Contractor production database, and the ACK table is verified.

8. The closed-gate kill switch deployment is recorded. Before this pull request merges, the current production Contractor deployment must have the canary constant false, the broad constant false, the UI sync flag unset, a device Save proof, no Ask navigation, and the deployment ID recorded.

9. The prepared shutoff still returns both constants to false. Branch
   `mth-con-one-profile-canary-shutoff` is rebuilt as a forward-fix on this
   frozen activation head. Its exact SHA is recorded in the PR review receipt.

10. The operator explicitly authorizes the canary. Explicit operator and founder authorization is required immediately before merge. There is no automatic merge.

## What this commit changes

| Constant | Value |
| --- | --- |
| `CONTRACTOR_CANARIES` | `ccc057187-a-r-roofing-inc` only (`CCC057187`, A & R ROOFING INC) |
| `CONTRACTOR_CANARY_ACTIVE` | `true` |
| `CONTRACTOR_PARENT_SYNC_BROAD` | `false` |

## Who is admitted

With this code, and a browser build produced later with
`NEXT_PUBLIC_MY_TRUSTHUB_CONTRACTOR_SYNC` set to `1`:

| Profile | DBPR | Result |
| --- | --- | --- |
| `ccc057187-a-r-roofing-inc` | `CCC057187` | admitted |
| `cfc1427249-a-sunny-plumbing-company` | `CFC1427249` | local / device-only |
| `cgc1517216-abaco-construction-inc` | `CGC1517216` | local / device-only |
| `cbc1268883-1776-construction-group-llc` | `CBC1268883` | local / device-only |

Broad mode stays false. A malformed or non-canonical slug is denied. A denied
profile keeps its device Save. Save does not create a Watch.

## The browser flag is not the kill switch

A production build with `NEXT_PUBLIC_MY_TRUSTHUB_CONTRACTOR_SYNC` unset does
not start the parent hand-off. The Save stays on the device.

After PR #121 merges, the SERVER gate is open for `CCC057187`
(`ccc057187-a-r-roofing-inc`). The absence of
`NEXT_PUBLIC_MY_TRUSTHUB_CONTRACTOR_SYNC=1` does NOT close the server gate.
A caller that reaches the endpoint is not stopped by the missing browser flag.
The absence of that flag is not the security kill switch.
Therefore PR #121 must merge only during the controlled canary window.

## Kill switch

Do not deploy the shutoff unless the operator is closing the canary.

The shutoff is a forward-fix commit on this frozen activation head:

- `CONTRACTOR_CANARY_ACTIVE = false`
- `CONTRACTOR_PARENT_SYNC_BROAD = false`
- `CONTRACTOR_CANARIES` remains `ccc057187-a-r-roofing-inc` only.

Do not use `git revert` of the original activation: it restores a stale list.
No prior multi-profile list is restored. With both constants false, the server
returns unavailable with localCopy keep before reading a profile, signing or calling Ask.

At the separately authorized shutoff deployment, remove or leave unset
`NEXT_PUBLIC_MY_TRUSTHUB_CONTRACTOR_SYNC`; the server constants close the gate.
Prepared branch: `mth-con-one-profile-canary-shutoff`. Its exact head and parent
are recorded in the PR review receipt. Keep it unmerged and undeployed until an
operator authorizes shutoff.

## Later three-profile follow-up

This commit does not restore the three-profile list.

After the `CCC057187` Save chain passes in the authorized window, a separate
reviewed change may expand the list to:

- `ccc057187-a-r-roofing-inc`
- `cfc1427249-a-sunny-plumbing-company`
- `cgc1517216-abaco-construction-inc`

`CONTRACTOR_PARENT_SYNC_BROAD` stays false in that follow-up.

## Account entry before broad rollout

The account-entry gap is documented, not activated by this repair.
`lib/my-trusthub/one-account.ts` exposes the My TrustHub account entry only when
`NEXT_PUBLIC_MY_TRUSTHUB_ONE_ACCOUNT` is `1` in the browser build. The CoS
2026-10-07 production pre-check reports this variable absent. With the default
false, the header, `/account` and `/my-contractor` hide the My TrustHub entry.
Existing Contractor workspace sign-in remains a separate optional workspace
sync facility; it is not the shared My TrustHub account.

Before broad rollout, obtain separate approval for the account-entry build,
then verify the My TrustHub entry in the header, account page and workspace,
its exact `https://www.asktrusthub.com/my` destination, signed-in and signed-out
return flows, and the existing local Save, Watch and workspace behavior. The
presentation flag neither opens nor closes the server Save gate. No flag is
set by this task.

The deprecated `MyTrustHubSave` is still mounted on the Trust Report and is
inert by default; its legacy `/api/my-trusthub/issue` is not the V2 account entry.
Remove that legacy mount/component/route in a separately reviewed activation
cleanup before broad rollout, preserving device Save and Watch. Do not enable
the legacy flag as a substitute for the account-entry work.

## Locked rollout and completed Ask work

The Founder/CoS handoff records Ask SQL/authority complete, Ask PR #262 merge
`64ca401d`, and authority fingerprint `17f464ad69f3d8c7a89dd2cf9229f112`.
Do not rerun packets or reopen that PR. This repair checks only Contractor
readiness and the exact binding's active entity using read-only evidence.
Rollout order remains Move (done), Lender, Investor, Insurance, Senior,
Contractor. Contractor remains last; ABACO `CGC1517216` is a later reviewed
expansion candidate, not part of this one-profile activation.
