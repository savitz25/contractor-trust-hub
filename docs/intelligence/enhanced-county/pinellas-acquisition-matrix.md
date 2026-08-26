# Pinellas acquisition matrix (Prompt 1)

| Agency | Dataset | Value | Entity | Coverage | Access | IDs | DBPR link | Contacts | PRA? | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PCCLB / Contractor Licensing | Local C-/J- credentials + remaining I- if any | VERY HIGH | local_credential | Countywide all 24 cities + unincorporated | Search + list + Accela PCCLB | C-/J-/I- #, company | request full state license | phone/address likely | **Yes** | **P0** |
| PCCLB | Citations, admin fines, expired-permit cases, magistrate orders | VERY HIGH if dispositions keyed | observation / disposition | Countywide licensing | Accela CLB-CT/AF/EX; PDFs | citation #, license # | if stored | no | **Yes** | **P0** |
| BDRS | Accela building permits | VERY HIGH | permit | Unincorporated + partner cities **only** | Accela; no bulk found | permit #, contractor | possible | possible | **Yes** | **P0** |
| PCCLB | Insurance/bond certificates on file | HIGH | credential currentness | Locally certified | email intake | license | n/a | no | Include in contractor PRA | **P1** |
| Consumer Protection | 5-year business complaint history | MEDIUM | complaint | County businesses | vendor name search | business name | name-only | no | Only if keyed extract | **P2** |
| St. Pete / Clearwater / Largo / others | Municipal permits | HIGH per AHJ | permit | That city | independent portals | local | weak | weak | Prompt 2+ city harvest | **P2** |
| Clerk | Civil | LOW | lawsuit | County | search | name | name-only | n/a | No | **SKIP** |
| Google Places | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | **SKIP** |

**Critical semantic:** State **certified** contractors currently **need not register with PCCLB** (pcclb.com 2026 notice). Permit activity for those firms appears in **building-department** files, not a PCCLB enrollment census.
