# CA-CON-001 network-wide contractor acquisition lessons

These checks should become standard for future Contractor state tickets.

1. **Regulator bulk portal first.** CSLB's free License Master is the identity spine. County/class Excel extracts are incomplete substitutes.
2. **Paid full files are a documented follow-up**, not a blocker. Historical revoked/cancelled rows live there.
3. **Public works registration** is a mandatory check. In California it is SEARCH_ONLY; still record the gap. When a state publishes PWCR with license IDs, treat it as a first-class overlay, not a license substitute.
4. **Debarment / labor lists** with exact license IDs are high-value and usually small HTML/CSV. Attach EXACT only.
5. **Procurement/vendor dumps** (the NJSAVI lesson) remain mandatory to look for. California's Cal eProcure dump is not open; do not invent vendor-as-license profiles.
6. **Qualifier/personnel files** are mandatory to attempt. They improve continuity without becoming public person profiles.
7. **Specialty rosters** (asbestos, electrician, fire, lead) are worth a bounded pass if they carry the contractor license ID. Person-only certificates do not mint contractor businesses.
8. **Contact policy:** emails may be legally withheld (California BPC 27). Phones on the license master were nearly complete. Sole-owner mailing addresses are REVIEW_REQUIRED.
9. **Statewide permits** are often local-fragmented. Do not start city crawls in a foundation ticket.
10. **Transport robustness:** large ASP.NET CSV postbacks can drop at ~30 seconds. Retry, stream, and keep truncated files hashed rather than discarding them.

Mandatory Contractor state-source checklist:

- license universe bulk
- status dictionary
- classification dictionary
- public works registration
- debarment / labor enforcement
- procurement/vendor discovery
- qualifier graph
- specialty credentials with license IDs
- contact completeness + publication eligibility
- permit statewide vs local
- business-entity bulk (only if official and cheap)
