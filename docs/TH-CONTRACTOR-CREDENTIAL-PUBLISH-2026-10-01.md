# Contractor Credential Lookup — Founder preview packet

This branch adds a separate regulatory credential lookup. It does not load records, create person or business profiles, attach names to businesses, or modify ordinary contractor search. `contractor_id` must be NULL for every eligible credential.

## Publication boundary

`CONTRACTOR_CREDENTIAL_PUBLICATION_BATCH=certified-2026-10-01` is the only activation value. The flag is unset by default. The public `/credentials` search and `/credentials/[id]` detail routes return 404 with the flag off. The `Verify` page shows its separate Credential Lookup entry point only with the flag on. `/credential-lookup-preview` is available in local development and Vercel SSO-protected preview deployments, using eight certified representative fixtures; it is not a live index. The route remains 404 on production deployments.

| Certified source | Batch ID | Eligible records | Source SHA-256 |
|---|---|---:|---|
| FL DBPR Electrical Board 08 | `e3e1c7c3-e337-5bc4-8143-4631415db763` | 17,976 | `b1bbbd8f6c707869376357ec914ce98a3fb1269669e4b79ebe61442b74540754` |
| FL DBPR Mold Board 07 | `1a89ece4-7f97-576c-a639-ca15316054c5` | 6,558 (MRSA 3,339; MRSR 3,219) | `705bcf08e2b82f71c79fa0afffc906c5f853362dd9232d6506efdb546b3cd08e` |
| FL DBPR Home Inspector Board 04 | `20a365ff-a740-515d-bd96-574809e62a4d` | 8,026 | `d403712866922381a124ec6def6c0f61e57a7cc3f51b46708029eecfd9b93cf1` |
| NY DOL Mold | `637955be-0fc3-5beb-aa6f-52904f3184f0` | 2,511 (Active 1,737; Expired 774) | `5eda889f071350c8e1c1bed040f177de1b0a28e64619afabadb9a4fae468927c` |
| NY DOL Elevator | `cf41ef92-452b-553d-927e-f3944c3d2dfd` | 302 (Active 212; Expired 90) | `4e7dd536aacb197589ffc0df56c35ffc2b6289912cb24bf6289bd141b2f741da` |

The live read-only eligibility query returned exactly **35,373** rows and **35,373** distinct `(source_system, external_key)` pairs, with zero non-null `contractor_id` values. The allowlist contains no NJ Fire batch. Board 06 is absent. Florida `state` in `licenses` is a mailing address, so the regulator-state filter uses the certified dataset, not the mailing address.

## Pre-activation checks for later Founder review

Before any future flag change, Evidence should recheck the five batch IDs, source hashes, per-batch rows, MRSA/MRSR counts, NY Active/Expired counts, unique source keys, all `contractor_id IS NULL`, and that no other source enters the allowlist. With the flag off, `/credentials` and detail routes must remain 404. With a simulated flag on in a protected preview, the eligible population must be exactly 35,373. Verify business and person profile counts before and after deployment and check ordinary `/verify` search parity. No activation is authorized by this packet.

Rollback of **presentation** is to unset `CONTRACTOR_CREDENTIAL_PUBLICATION_BATCH`; the source rows remain in production. No data rollback is part of this experience.

## Preview and QA

Protected PR preview: `/credential-lookup-preview` on the Vercel preview URL. Its anonymous request redirects to Vercel SSO. Local development preview: `http://127.0.0.1:3107/credential-lookup-preview` while the dev server runs. Representative fixtures cover FL Electrical, FL Mold MRSA, FL Mold MRSR, FL Home Inspector, NY Mold Active and Expired, and NY Elevator Active and Expired. Desktop and 390px mobile screenshots accompany this packet. Browser snapshots confirmed all eight records, number/name lookup, status and type controls, detail content, keyboard-focusable controls, and no console errors. Gate-off `/credentials` returned HTTP 404. TypeScript passed. Live read-only SQL confirmed the certified eligibility counts, an exact NY number hit, FL holder-name hits, and 774 NY Mold Expired rows.

Local runtime database credentials currently reject authentication. The complete production-backed route must therefore be exercised in an authenticated protected deployment during independent Evidence QA before public activation. The local eight-record preview is a UI demonstration, not proof of production route connectivity.
