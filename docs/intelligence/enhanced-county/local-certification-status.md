# Local contractor licensing / certification currentness

Statewide DBPR CILB credentials remain the Florida credential identity. County records are a **separate** regulatory layer.

Florida §163.211 (HB 735 / 2021-214, extended by HB 1383 / SB 1142): local occupational licensing not authorized by general law **expired 1 July 2025**. Local governments that licensed before 1 Jan 2021 could not add classes. Work whose scope does not correspond to §489.105(3)(a)–(o) is not a local-license prerequisite (§489.117). Veneer/gutter/siding/fence classes that existed before 2021 may continue under HB 1383 conditions. Journeyman licenses remain authorized in statute.

**Never display a preempted Certificate of Competency as current authorization.** Preserve `status_raw` and map `currentness` explicitly.

## Shared currentness vocabulary

| Code | Meaning |
| --- | --- |
| CURRENT_LOCAL_AUTHORIZATION | Class still required or still issued under remaining local/general-law authority |
| CURRENT_REGISTRATION | State credential enrolled/registered locally to pull permits |
| STATE_ENROLLED | DBPR license enrolled with the county (PBC $50 enrollment) |
| INSTALLER_REGISTRATION | PBC post-2025 voluntary registration — **not a license** |
| HISTORICAL_LOCAL_LICENSE | Once issued; no longer the current required authorization |
| PREEMPTED_CLASS | Class the county may not require/issue after 2025-07-01 |
| EXPIRED / REVOKED | Source status |
| UNKNOWN | Insufficient source |

## Broward

**Agency:** Building Code Division + Central Examining Board (Division I construction, Division II electrical/plumbing/mechanical). BCS portal for public search.

**Still in the local picture after Ordinance 2025-23 (effective ~30 Jun 2025) and HB 735:**

- CEB continues to examine/certify trades **still authorized** (electrical, plumbing, mechanical work as defined in Chapter 9; elevator technician Class E; remaining Division I construction specialties the ordinance kept).
- Tree-trimming contractor regulations **eliminated**.
- Voluntary CEB licensure still exists; staff warned it will increase lawful unlicensed specialty work.
- Fence / garage door / glass-glazing / commercial pool specialties appear in remaining Chapter 9 “general construction work” definitions — treat as **current only if the live BCS class list still issues them**; otherwise historical.
- State-certified/registered CILB and ECLB credentials are the primary current authorization for corresponding scopes.

**Preempted / historical (do not treat as current local authorization):** specialty occupations that do not correspond to §489.105 contractor categories (painting, flooring, tile, cabinets, tennis courts, awnings, ornamental iron, etc. — same family as the PBC BCAB list).

**Identifiers:** BCS ID, CC number, name, firm. DBPR number if the record stores it. Qualifier/firm relationship if presented.

**Insurance/WC:** BCS states up-to-date workers’ compensation and liability insurance are required **when applying for a permit**. That is a permit-gate, not verified coverage on a public profile unless the extract has dates/status.

## Palm Beach

**Agency:** PZB Contractor Regulations / Construction Industry Licensing Board of Palm Beach County (Special Act 67-1876). Search: ePZB Information & Status.

**State/local interaction:**

- County Certificate of Competency for remaining regulated trades.
- **State contractors must enroll** with PZB ($50, even years) to apply for **unincorporated** permits / schedule inspections; 7-digit ID used for inspections.
- County contractors renew biennially on **odd** years (deadline 30 Sep).
- Reciprocity: Special Act lets a current PBC certificate be exhibited to municipal building officials; municipalities may still charge BTR/permit fees.
- **Installer Registration** (town notices, e.g. Highland Beach): replaces sunset **U-licenses** for preempted trades as of 1 Jul 2025. Requires insurance/WC/bond/BTR. **Not a license, not a state credential.**

**BCAB public notice (effective 1 Jul 2025) — county will no longer require or issue COC for:** acoustical/suspended ceiling; carpentry finish; countertop; decorative metal; dredging and land filling; fabric awnings; insulation; lightning protection; painting; paver brick/systems; paving; reinforcing steel; seal coating/striping; sign (non-electrical); tennis court; tile/terrazzo/stone; underground/overhead transmission lines; wood flooring. Cite §489.117(4)(a).

**Remaining construction/specialty trades** (still described on PBC materials / standards.pdf rev 7/1/25): general, building, residential, electrical, journeyman electrician, plumbing, journeyman plumber, HARV, aluminum specialties, and other classes still in the Special Act standards — **confirm against the 7/1/25 standards file before publishing a class as current.**

**Certification application historically required:** GL certificate, WC, Business Tax Receipt, $2,000 surety bond. Public profile may only show these if the extract has **actual status/dates**.

**Identifiers:** county certification number, 7-digit contractor ID, DBPR license on enrollment, qualifier (owner of the license).

## Miami-Dade (Prompt 1 — not ingested)

**Agency:** RER Contractor Licensing Section + Construction Trades Qualifying Board (Chapter 10). Search: BCCO Contractor Inquiry. No public bulk COC CSV.

**Current vs historical vs preempted:**

| Concept | Currentness |
| --- | --- |
| Certificate of Competency (contractor business, remaining Chapter 10 / §489.105 classes) | `CURRENT_LOCAL_AUTHORIZATION` **if** live CTQB class list still issues it |
| Certificate of eligibility | map from extract status; not a substitute for a current COC |
| Journeyman COC | `CURRENT_LOCAL_AUTHORIZATION` as journeyman only — not a contractor |
| Master COC | as source, after business license exists |
| Authorized Employee COC | county/municipal employees only; not a public contractor credential |
| Maintenance categories | as live class list |
| Voluntary verification of **Florida certified** contractors for **unincorporated** permitting | `STATE_ENROLLED` — “only valid in unincorporated Miami Dade County.” Permit-gate, not a COC |
| County COC holders who must also be **state-registered** (F.S. 489.115 / 489.513) | local row + `REGISTERED_FROM` state credential when DBPR number is stored |
| Reciprocity from Broward / Palm Beach | as source; still a Miami-Dade credential once issued |
| Specialty occupational / non-489.105 classes after HB 735 / HB 1383 | `PREEMPTED_CLASS` / `HISTORICAL_LOCAL_LICENSE` until a live extract proves current issuance |

Do not treat EnerGov Consumer Protection business licenses as COC.

**Identifiers:** county COC / certificate number, company, qualifier, raw status, complaint flag. Full DBPR number **not confirmed in public search UI** — request in PRA.

## Pinellas (Prompt 1 — not ingested)

**Agency:** Pinellas County Construction Licensing Board (dependent special district, Chapter 2024-294, structure effective 2024-06-14) + Contractor Licensing Department. Countywide **credentials**, including all 24 municipalities. That is **not** countywide permits.

**Current vs historical vs preempted:**

| Concept | Currentness |
| --- | --- |
| Local certified county contractor (`C-`) | `CURRENT_LOCAL_AUTHORIZATION` if class still issued. Renewal: certified county + journeyman expire **2026-09-30**; annual window begins June 1 |
| Journeyman (`J-`) | journeyman only — “You cannot hire a Journeyman directly” |
| State **certified** contractors | **pcclb.com 2026: “DO NOT have to register or renew their registrations with PCCLB to work in Pinellas County.”** Not a PCCLB enrollment census. They still show state license + insurance **to each building department** to pull permits. Permit-gate ≠ county credential |
| State **registered** (`I-`) if extract still issues them | `STATE_ENROLLED` / `CURRENT_REGISTRATION` only if live |
| Specialty local classes after HB 735 / HB 1383 | `PREEMPTED_CLASS` / `HISTORICAL_LOCAL_LICENSE` unless live class list (`contractor-class.pdf`) says otherwise |
| Reciprocity with other Florida jurisdictions | as source |

**Identifiers:** local `C-`/`J-`/`I-` number, business name, person, status, expiration. Request full DBPR number in PRA. Insurance/bond on file is currentness support, not a public phone.
