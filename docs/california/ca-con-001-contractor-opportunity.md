# CA-CON-001 — California contractor opportunity report

Foundation ticket. `/california` is **not published**.

Counts below are exact from acquired official files, or **UNKNOWN**.

## 1. How large is the official California contractor license universe?

**UNKNOWN** for the complete historical CSLB database.

CSLB's paid Full File is described as 700,000+ to 830,000+ records including current, expired, cancelled, and revoked (**REQUEST_ONLY**, $235).

The free Public Data Portal License Master includes only licenses that are **currently renewed** or **expired but renewable** (BPC 7141 five-year window). Cancelled, revoked, and expired-nonrenewable rows are excluded even from a complete portal download.

This ticket acquired a **truncated** portal License Master stream:

- **75,572** license rows
- SHA-256 `f6ebbee6ed6c8b9476414e972382e6fcb4065f2c6e88a19392371a1e1e996838`
- as of **2026-09-02**
- coverage `ACQUIRED_PARTIAL_STREAM_TRUNCATED`

The complete portal master row count is **UNKNOWN**.

## 2. How many are current/active?

In the acquired extract, source-native `PrimaryStatus=CLEAR`: **67,239**.

Remaining acquired rows are source-native suspensions (bond, workers' comp, SOS, qualifier, citation, etc.), not collapsed into CLEAR.

Statewide CLEAR count for the complete portal file: **UNKNOWN**.

## 3. How many unique businesses?

In the acquired extract:

- distinct license numbers: **75,572**
- distinct FullBusinessName + mailing address + ZIP5: **75,560**

## 4. How many source-native classifications?

Official CSLB List-by-Classification form options: **78**.

Observed classification tokens in the acquired master extract (normalized): **81**.

Do not treat 81 as the official dictionary size. The 78 form options are the official selectable classes/certifications, including C-61/D-* limited specialties, ASB, and HAZ.

## 5. Which classifications dominate?

In this truncated extract (not a complete statewide ranking):

| Token | License rows holding the class |
|-------|--------------------------------:|
| B | 30,813 |
| C10 | 8,659 |
| C36 | 5,592 |
| C33 | 5,028 |
| C20 | 4,047 |
| A | 4,035 |
| C27 | 3,873 |

Multi-class licenses are counted in each token. This is not a consumer ranking.

## 6. How many rows have phones?

**75,483** of 75,572 acquired license rows have a business phone with at least 7 digits.

## 7. How many have public emails?

**0**. CSLB does not provide emails (Business & Professions Code § 27).

## 8. How many have websites?

**0**. Website is not a License Master field.

## 9. How many have usable business addresses?

**75,571** acquired rows have mailing address + city.

Publication eligibility: **REVIEW_REQUIRED**. Sole-owner mailing locations may be residential. Do not auto-publish as a storefront.

## 10. What qualifier/personnel relationships are available?

The portal Personnel file exists (license number, personnel names, titles, classifications, bond; disassociated personnel excluded). The same ASP.NET download stream failed before a complete file arrived.

`NAME-TP-2` on the master file is a flag (`Current Name`, 8,086 rows), **not** a qualifier identity graph.

Qualifier/person graph: **UNKNOWN / SOURCE_AVAILABLE_NOT_ACQUIRED**.

Do not convert a qualifier person into a public contractor business profile.

## 11. How much enforcement exists?

CSLB legal-action / complaint-disclosure bulk files are **REQUEST_ONLY** (paid Full File "Complaint Disclosure/Legal Action File"). Instant License Check legal actions are **SEARCH_ONLY**.

Acquired structured adverse list: DIR DLSE public-works debarment HTML.

- distinct CSLB license IDs parsed: **57**
- decision PDF links present on the page
- page footer: July 2025

## 12. What exact-ID enforcement can attach safely?

**57** DLSE debarment CSLB IDs are EXACT.

**0** of those 57 appear in the acquired renewable master extract. That is consistent with the portal excluding cancelled/revoked/expired-nonrenewable licenses. Exact-ID attachment remains valid against a future full spine. Name-only debarment rows stay **UNSAFE**. One listing is court-stayed (Michael Flooring / 874947) and is not a current debarment.

## 13. How large is the public works registry?

**UNKNOWN**. DIR Public Works Contractor Registration is account/search (`https://services.dir.ca.gov/pw`). No official bulk CSV/API was found. Public list download of local debarments requires CAPTCHA.

## 14. How much exact contractor-ID overlap exists?

Public works registry overlap: **UNKNOWN** (registry not acquired).

Cal/OSHA asbestos registrants: **312** rows with CSLB IDs; **65** of those IDs are in the acquired master extract; **247** are not.

## 15. How large are the useful vendor/procurement datasets?

**UNKNOWN**. Cal eProcure / FI$Cal SCPRS is search-plus-download with a 65,000-row cap and required search parameters. Not an open statewide vendor dump. DGS NCB $1M+ file exists on data.ca.gov but is not a contractor license universe.

## 16. How many net-new businesses do they reveal?

Vendor net-new licensed contractors: **UNKNOWN** (no bulk vendor file).

DIR electrician lists: **36,983** certified + **19,661** trainees. Grain is **person certificate**. CSLB license ID is absent. Net-new contractor businesses from ECU: **0** (do not auto-create).

Asbestos registrants without a row in the acquired master: **247** exact CSLB IDs. Those IDs are still CSLB licenses, not vendor-only businesses. They are missing from this truncated extract, not proof of unlicensed firms.

## 17. How many public business contacts can be added?

From the acquired CSLB master extract:

| Field | Count | Eligibility |
|-------|------:|-------------|
| Business phone | 75,483 | PUBLIC_ELIGIBLE |
| Mailing address | 75,571 | REVIEW_REQUIRED |
| Email | 0 | NOT_IN_SOURCE |
| Website | 0 | NOT_IN_SOURCE |

Asbestos registrant phones: **321** rows, with phone populated on the official table. Treat as PUBLIC_ELIGIBLE for the registrant record, not as a CSLB profile overlay unless EXACT license join.

This ticket does **not** publish contacts onto live profiles.

## 18. What specialty sources add additional businesses?

| Source | Rows | Exact CSLB IDs | Adds contractor businesses? |
|--------|-----:|---------------:|-----------------------------|
| DIR ECU certified electricians | 36,983 | 0 | No — person credential |
| DIR ECU trainees | 19,661 | 0 | No |
| Cal/OSHA asbestos registrants | 321 | 312 | Specialty evidence; 65 EXACT joins to acquired master |

## 19. What data is blocked/search-only?

See [ca-con-001-source-manifest.md](./ca-con-001-source-manifest.md). Headline blockers: CSLB Full File (REQUEST_ONLY), CSLB Personnel complete file (stream failed), DIR PWCR (SEARCH_ONLY), Cal eProcure vendor dump (SEARCH_ONLY), CSLB legal actions (SEARCH_ONLY / REQUEST_ONLY), SOS entity bulk (REQUEST_ONLY / DATA_SALES).

## 20. What belongs on the eventual /california Contractor page?

When a later ticket authorizes publication:

- CSLB License Master counts with the portal universe caveat (renewed + expired-renewable ≠ historical complete file)
- CLEAR vs source-native suspension statuses, never collapsed
- Official classification dictionary and token frequencies, not a ranking
- Phone completeness; emails explicitly unavailable (BPC 27)
- Separate cards for DLSE debarment and Cal/OSHA asbestos, EXACT license joins only
- Instant License Check as the live-status destination
- No Trust Score, no combined “California contractors” denominator, no vendor-as-license

CA-CON-002 should first finish the portal License Master + Personnel + WC files, then decide whether the paid Full File is worth it for revoked/cancelled history.
