# Pinellas official source map (Prompt 1)

## PCCLB / Contractor Licensing Department

**Pinellas County Construction Licensing Board** is a **dependent special district** created by special act (now Chapter 2024-294, Laws of Florida; notes on pinellas.gov: current structure effective **2024-06-14**). It **regulates certain construction and home improvement contractors in Pinellas County, including all local municipalities**.

Day-to-day: Pinellas County **Contractor Licensing Department** (pcclb@pinellas.gov, 727-582-3100). Site: [pcclb.com](https://www.pcclb.com/).

**Do not assume 1973 special-act powers equal 2026 class lists.** HB 735 / HB 1383 specialty-preemption notices are posted on pinellas.gov Contractor Licensing.

### Credential concepts (current vs historical)

From official PCCLB / County pages:

| Concept | Notes | Currentness |
| --- | --- | --- |
| Local certified county contractor (C- licenses) | Exam/reciprocity; insurance + code-compliance bond | CURRENT_LOCAL_AUTHORIZATION **if** class still issued |
| Journeyman (J- licenses) | Not a contractor | CURRENT_LOCAL_AUTHORIZATION as journeyman only |
| State **certified** contractors | **pcclb.com (2026): “DO NOT have to register or renew their registrations with PCCLB to work in Pinellas County.”** Must still show state license + insurance **to each building department** to pull permits | Not a PCCLB enrollment row by default. Permit-gate proof ≠ county credential |
| State **registered** contractors (I- licenses) | County pages still describe I-license renewal June 1–Sep 30 | STATE_ENROLLED / CURRENT_REGISTRATION **only if extract still issues I- rows** |
| Specialty local classes | HB 1383 extended HB 735 impacts | PREEMPTED_CLASS / HISTORICAL unless live class list says otherwise |
| Reciprocity | PCCLB policy with other Florida jurisdictions | As source |

**Access:**

- Contractor Search: https://contractorsearch.pcclb.com/
- Full contractor list: https://publicsecure.pinellascounty.org/clbcontractorlist/index.jsp
- Accela PCCLB module: https://aca-prod.accela.com/PINELLAS/…module=PCCLB
- Insurance certificates: insurancecertificates@pinellas.gov
- Citations / admin fines / expired-permit (CLB-CT#, CLB-AF#, CLB-EX#) payable in Accela

Search/list pages are **not** a bulk CSV. **PRA** for machine-readable roster + insurance/bond fields + DBPR crosswalk.

## Permits

BDRS Accela: unincorporated + **named partner cities** (see `pinellas-jurisdictions.md`). Not St. Petersburg / Clearwater / Largo / etc.

No countywide open-data permit dump found. **PRA** for Accela export.

## Discipline / enforcement

PCCLB: investigations, citations, administrative fines, special magistrate hearings, agendas/minutes, unlicensed contracting (727-582-6767; Formsite — **state law prohibits anonymous complaints**).

Keep: complaint / investigation / citation / hearing / final order / fine / suspension / revocation distinct.

**PRA** for structured citation/order extract (not PDF minutes as the primary product).

## Consumer Protection (separate agency)

Office of Consumer Protection (Human Services): 5-year **business** complaint history (vendor search). Complaint ≠ PCCLB finding. Name-based. **P2 / PRA only if** a contractor-keyed extract exists; otherwise SKIP bulk.

## Courts

Clerk public search. Name-only = UNRESOLVED. **SKIP** as public contractor evidence.

## Contacts

Public contractor-attributed fields:

| Source | Fields |
| --- | --- |
| PCCLB Contractor Search (`contractorsearch.pcclb.com`) | result columns: License Type, Contractor, Business Name, **Contact Info**, Status, License, Expiration Date. Status codes: (A)ctive (I)nactive (P)ending (R)evoked (S)uspended (E)xpired (O)n Hold |
| PCCLB full list (`publicsecure.pinellascounty.org/clbcontractorlist`) | complete licensed-contractor list (not a CSV). Expect firm/person + license; bulk contact fields **PRA** |
| Accela PCCLB | insurance certificate **uploads** are not a public phone dump |
| Accela Building | contractor name/license on permit records if stored — PRA |
| Agency numbers | 727-582-3100 (PCCLB), 727-582-6767 (unlicensed), 727-464-3888 (Building) are **not** contractor phones |
| Consumer Protection vendor search | business complaint history — name-based, not a contractor phone warehouse |
| Google Places | SKIP |
