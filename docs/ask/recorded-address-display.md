# Recorded address on company-name cards

`contractor-name-candidates-v1` does not return street or ZIP. `check:th-search-r1-019b` test 14 keeps those fields out of that operation, its SQL, and its JSON response. This page does not change that contract.

The public Trust Report shows `licenses.address_line_1`, city, state, `postal_code`, and `county_name`. A public profile page can still render a limited thin profile. This `/ask` projection does not: thin profiles are excluded, so its eligibility is narrower than that page.

The lookup is one statement for the page. It pairs each card's stored profile slug with that card's credential key, and it attaches an address only when that pair matches exactly one license row. It does not match by name, and it does not read phone, email, claim, account, or raw license payloads. If the statement fails, the page says the address could not be loaded. That is not a claim that the source has no address. Two rows for one pair stay unconfirmed, even when one of them has a street.

Credential jurisdiction stays separate from the address state. A county value of "Out-of-State" is a source marker, not a county and not an address state.
