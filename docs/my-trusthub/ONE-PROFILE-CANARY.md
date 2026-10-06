# Contractor one-profile canary — activation artifact

Status of this commit: **unmerged and undeployed**. Production stays on the
previous specialist build. `CONTRACTOR_CANARY` in production stays **OFF**
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

4. The exact Contractor binding is installed. Production `prod_contractor_dbpr_binding_for(...)` is installed, and the first canary `CCC057187` resolves to exactly one current accepted binding: hub = contractor, profile class = contractor_profile, namespace = fl.dbpr.license, jurisdiction = FL, canonical profile `/contractors/ccc057187-a-r-roofing-inc`. No ambiguity. The Packet 16 receipt file is saved.

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
   `mth-con-one-profile-canary-shutoff` at
   `1290c2b32a91d0393d4525d365ed7c785b9bb516` is that shutoff.

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
| `cgc1506243-abs-contracting-inc` | `CGC1506243` | local / device-only |
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

The shutoff is one commit: `git revert` of the activation commit (the commit
that introduces this document). That revert returns:

- `CONTRACTOR_CANARY_ACTIVE = false`
- `CONTRACTOR_PARENT_SYNC_BROAD = false`

The canary array returns to the previous three certified slugs. Those slugs
stay inactive because the canary constant is false.

At that deployment, remove or leave unset
`NEXT_PUBLIC_MY_TRUSTHUB_CONTRACTOR_SYNC`.

Prepared branch: `mth-con-one-profile-canary-shutoff`, head
`1290c2b32a91d0393d4525d365ed7c785b9bb516`. It is the revert. It must still
cleanly return both constants to false. It is not a deployment and it is not
this pull request.

## Later three-profile follow-up

This commit does not restore the three-profile list.

After the `CCC057187` Save chain passes in the authorized window, a separate
reviewed change may restore:

- `ccc057187-a-r-roofing-inc`
- `cfc1427249-a-sunny-plumbing-company`
- `cgc1506243-abs-contracting-inc`

`CONTRACTOR_PARENT_SYNC_BROAD` stays false in that follow-up.
