# Texas contractor / trade regulatory map (TX-CON-001)

Texas does **not** license general contractors statewide.

## What exists at state level

- **TDLR** licenses specialty trades (air conditioning contractors, electrical contractors, electrical sign, appliance installation, elevator, water well / pump, mold companies, and others). Native download files: <https://www.tdlr.texas.gov/dbproduction2/>. All Licenses Socrata: `7358-krk7`.
- **TSBPE** licenses plumbing. Responsible Master Plumber may contract with the public. Free CSVs: <https://tsbpe.texas.gov/free-licensee-list/>.
- **Comptroller CMBL / HUB / VetHUB** is a vendor mailing list and certification file, not a contractor license. Downloads: <https://comptroller.texas.gov/purchasing/downloads>.
- **TxDOT Project Information** (`drau-zphx`) is project/CSJ grain. `construction_manager` is TxDOT staff, not the awarded contractor.
- **TCEQ Central Registry** is customer / regulated-entity grain. Construction NAICS is not a contractor license.

## What does not exist

- A statewide general-contractor license class.
- A single official “how many Texas contractors” denominator.
- A statewide building-permit file (local / fragmented).

## Identity namespaces (do not collapse)

- `TX-TDLR:{LICENSE_TYPE}:{LICENSE_NUMBER}[:SUBTYPE]`
- `TX-TSBPE:{KIND}:{LICENSE_NBR}`
- `TX-CMBL:{WEB_VID}`
- `TXDOT-CSJ:{CSJ}`

License numbers collide across TDLR types. Person credentials are not contractor businesses.

## Local regulation

Cities and counties issue building permits and may register local contractors. Houston, Dallas, San Antonio, Austin, Fort Worth, and county harvests are out of scope for TX-CON-001.
