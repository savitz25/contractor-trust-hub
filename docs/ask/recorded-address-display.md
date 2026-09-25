# Recorded address on company-name cards

`contractor-name-candidates-v1` does not return street or ZIP. `check:th-search-r1-019b` test 14 keeps those fields out of that operation, its SQL, and its JSON response. This page does not change that contract.

The public Trust Report already shows `licenses.address_line_1`, city, state, `postal_code`, and `county_name` for a published, non-thin profile. `/ask` reuses that same license row for the cards on the current page only.

The lookup is one statement. It pairs each card's stored profile slug with that card's credential key. It does not match by name, and it does not read phone, email, claim, account, or raw license payloads. A thin profile is excluded. If the statement fails, the page says the address could not be loaded. That is not a claim that the source has no address.

Credential jurisdiction stays separate from the address state. A county value of "Out-of-State" is a source marker, not a county and not an address state.
