# TH-ENRICH-2026-09-30-B1 — Contractor publication packet

**Identity review update:** the earlier 80,802-key license projection is withdrawn as a publication proposal. Use the [typed Contractor identity review](TH-ENRICH-2026-09-30-B1-contractor-identity-review.md); it proposes zero license loads pending person and business-holder resolution.

Production changed: **NO**. Eight official source snapshots were acquired and parsed into local `data/staging/th_enrich_b1/` JSONL with raw regulator fields retained. [Immutable source manifest](TH-ENRICH-2026-09-30-B1-source-manifest.json), [per-dataset QA](TH-ENRICH-2026-09-30-B1-qa.json), and [retrieval receipts](TH-ENRICH-2026-09-30-B1-retrieval.json) contain the detailed A–T checks. Raw files and staging are intentionally excluded from Git by repository rules.

## Source census and identity treatment

| Source | Raw / parsed / unique native keys | Eligible identity keys | Denominator rule |
| --- | ---: | ---: | --- |
| FL DBPR ECLB board 08 `lic08el.csv` | 20,103 / 20,103 / 20,083 | 17,976 | 16,614 `C/A` contractor-class rows. 2,127 course/provider/officer rows excluded. Twenty duplicate native keys are `CRS3` course records, held as collisions. ECLB remains separate from CILB board 06. |
| FL DBPR mold board 07 `lic07mold.csv` | 6,933 / 6,933 / 6,933 | 6,558 | MRSA assessor 3,339; MRSR remediator 3,219. 6,060 `C/A` combined. 375 course/provider rows excluded. |
| FL DBPR asbestos board 59 `lic59asb.csv` | 1,157 / 1,157 / 1,157 | 486 | Separate contractor (`CJC` 139), business (`ZA` 228), and consultant classes. 303 `C/A` eligible rows; 671 course/provider/financial officer rows excluded. |
| FL DBPR home inspectors board 04 `lic04home.csv` | 9,396 / 9,396 / 9,396 | 8,026 | `HI` is a person credential, not a general contractor business. 7,628 `C/A`; 1,370 course/provider rows excluded. |
| NYC DOB `t8hj-ruu2` | 103,236 / 103,234 / 103,228 | 44,402 conservative business-class keys | `GENERAL CONTRACTOR` has 34,650 historical/all-status rows and **9,752 ACTIVE** rows. NYC issuing jurisdiction only. Do not combine with DCWP or NY DOL public works. Mixed `ELEVATOR AGENCY / INSPECTOR` remains taxonomy-held. |
| NYS DOL mold `ikqx-ispy` | 2,510 / 2,510 / 2,510 | 2,510 | 1,761 `Active`, 749 `Expired`; assessment and remediation types remain separate. |
| NYS DOL elevator `jrac-r9vc` | 302 / 302 / 302 | 302 | 212 `Active`, 90 `Expired`; contractor and inspection-contractor types remain separate. |
| NJ DFS fire permitted businesses | 542 / 542 / 542 | 542 | Business permits, source PDF dated 2026-03-19. Do not combine with NJ HIC or fire-alarm credentials. One row cites replacement permit `P00485`; `P01619` is its native row key. The citation is not a second row. |

All eight snapshots total **144,179 raw rows**, **144,177 parsed rows**, and **144,151 source-native keys** across distinct issuing systems. Only **80,802 source-native keys** pass the conservative class filter as provider identity candidates. Those are not 80,802 new canonical businesses: no cross-regulator deterministic bridge was present in these extracts. Therefore **zero canonical Contractor identities were created or published**. All 80,802 eligible keys remain in local `unresolved_identity_queue.csv`; 63,375 parsed rows are course/provider, mixed professional, or other records outside the provider identity candidate set. There are 26 duplicate rows across 25 held keys (20 ECLB `CRS3` keys and five NYC placeholder-style professional keys). Local `collision_queue.csv` lists each key. No fuzzy name merges were made.

The NYC source contains two rows with no license type (source rows 11,553 and 62,503); both are held out of the parsed credential set. Two other source rows place a phone-like value in `license_status`; their raw values are preserved and status is not inferred. For Florida, DBPR's official codebook defines `C` Current, `P` Probation, `S` Suspended, and secondary `A` Active / `I` Inactive. The active specialist counts above require `C/A`; `P/A` and `S/A` are not silently added. [`electrical.csv` is continuing education and was not acquired or staged.](https://www2.myfloridalicense.com/about-us/understanding-dbpr-codes/)

The NJ initial URL served a 2022 roster. It was retained only as excluded historical evidence; the [current official PDF](https://www.nj.gov/dca/dfs/pdf/Fire%20Protection%20Equipment%20Contractor%20-%20Permitted%20Business.pdf) produced the 542-row permit census. Fifty-seven listed permits have a lapse date before the 2026-09-30 retrieval, so PDF presence alone is not a current-active assertion. Address states remain address observations, not issuing jurisdictions.

## Existing-owned and publication gate

The local owned CILB source is **270,560 board-06 raw rows**, with **143,516 staged license rows** and **126,666 qualifying-business rows**, keyed by `source_system='fl_dbpr'` and source-native credentials. Its [source manifest](TH-ENRICH-2026-09-30-B1-existing-local.json) proves the local board separation. A [read-only live REST audit](TH-ENRICH-2026-09-30-B1-rest-audit.json) confirms **143,516 board-06 licenses** and **zero licenses** in boards 08/07/59/04 or the proposed NYC DOB, NY DOL, and NJ DFS source systems. The direct Postgres configuration rejected authentication; the [failed audit receipt](TH-ENRICH-2026-09-30-B1-existing-audit.json) is retained. Existing NJ DCA contains 87,355 licenses and remains separate.

The live network has **1,392,730 contractor rows** and **1,266,214 license rows** before B1. Production is unchanged. If all 80,802 identity-eligible new native credentials were later loaded, the license table could reach **1,347,016 rows**; this is a credential-table projection, not a business count or an active Contractor denominator. A post-publication canonical contractor count cannot be computed safely until exact identity resolution is completed.

Founder gate: review source-class-specific entity creation and exact cross-source bridges before loading the new credentials. Keep duplicate and ambiguous keys held, preserve distinct board credentials, and publish specialist denominators only after source-status and date semantics are confirmed. Recheck live source counts immediately before a production mutation. No shared schema or framework file was changed, and no production mutation was executed.

QA run: `python -m py_compile` for all B1 scripts, `python scripts/th_enrich_b1_verify.py`, and `python scripts/th_enrich_b1_queues.py` passed. The verifier checks all eight source hashes, raw/staged row counts, NJ permit extraction, NYC GC active count, and the four held NYC anomalies. The queue script reconciles all 80,802 unresolved keys and 25 collision keys. The live REST audit used only HEAD requests.
