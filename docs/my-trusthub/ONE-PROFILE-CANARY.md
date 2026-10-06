# Contractor one-profile canary — activation artifact

Status of this commit: **unmerged and undeployed**. Production stays on the
previous specialist build. `CONTRACTOR_CANARY` in production stays **OFF**
until an operator merges and deploys this commit inside an authorized window.

This commit contains no production secrets and no environment assignments.
It does not create keys. It does not apply migration 016. It does not set
`NEXT_PUBLIC_MY_TRUSTHUB_CONTRACTOR_SYNC`.

## Do not merge until every line below is true

1. Ask SQL is complete.
2. Packet 19 is final.
3. The Contractor binding is installed.
4. Contractor migration 016 is applied.
5. Keys are provisioned.
6. The Ask verify key is deployed.
7. The Contractor signer is deployed.
8. The closed-gate kill switch deployment is recorded.
9. The operator explicitly authorizes the canary.

Merging earlier opens the server gate for one profile on the next deploy.

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

After this commit is merged, the server gate is open for
`ccc057187-a-r-roofing-inc`. A caller that reaches the endpoint is not stopped
by the missing browser flag. The absence of that flag is not the security kill switch.
This pull request stays unmerged until the production canary window.

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

Prepared branch: `mth-con-one-profile-canary-shutoff`. It is the revert. It is
not a deployment and it is not this pull request.

## Later three-profile follow-up

This commit does not restore the three-profile list.

After the `CCC057187` Save chain passes in the authorized window, a separate
reviewed change may restore:

- `ccc057187-a-r-roofing-inc`
- `cfc1427249-a-sunny-plumbing-company`
- `cgc1506243-abs-contracting-inc`

`CONTRACTOR_PARENT_SYNC_BROAD` stays false in that follow-up.
