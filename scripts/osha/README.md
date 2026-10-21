# CON-OSHA-002 Group 1 offline matcher

This lane computes private candidate matches for VA (`va_dpor`), AZ
(`az_roc`), NV (`nv_nscb`), LA (`la_lslbc`), and CA (`ca_cslb`). It reads
existing license rows only. It does not create contractors or modify product
code, schema, feature flags, or publication behavior.

## Inputs

Export these columns from the existing `public.licenses` table with a
read-only query, then keep the resulting CSV outside Git:

```sql
SELECT id, contractor_id, source_system, state, dba_name_raw,
       licensee_name_raw, postal_code, county_name
FROM public.licenses
WHERE (state, source_system) IN (
  ('VA', 'va_dpor'), ('AZ', 'az_roc'), ('NV', 'nv_nscb'),
  ('LA', 'la_lslbc'), ('CA', 'ca_cslb')
)
ORDER BY state, id;
```

Use the public OSHA inspection export fields `activity_nr`, `estab_name`,
`site_state`, `site_zip`, `mail_zip`, and `open_date`. Input rows are filtered
by `site_state` again by the matcher. No profile pages are fetched.

The public Census crosswalk is the [2020 ZCTA-to-county relationship
file](https://www.census.gov/geographies/reference-files/2020/geo/relationship-files.html),
downloaded from:

`https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt`

Its delimiter is `|`. Because a ZCTA can cross county boundaries, this matcher
assigns it to the in-state county with the greatest `AREALAND_PART`; county
GEOID breaks an area tie. That chosen county is compared to the license
`county_name`; where that field is blank, the same crosswalk resolves the
existing license `postal_code` to a county. This is a deterministic geography
approximation, not a USPS ZIP boundary claim. The original crosswalk and its
receipt stay outside Git.

## Match tiers

- Use `dba_name_raw` when it has a nonempty normalized name; otherwise fall back
  to `licensee_name_raw`. Normalize business names conservatively (uppercase,
  punctuation and common entity suffix removal), then require exact
  normalized-name equality.
- **Exact:** the license ZIP5 is present and equals the OSHA site or mail ZIP5.
- **Strong:** exact did not apply and an OSHA site or mail ZIP maps to the
  license county through the crosswalk.
- **Weak:** names match but neither ZIP rule applies. A person-name licensee
  caps every result at weak. Weak rows remain private and never become public.
- Missing license ZIP cannot qualify as exact. A match is never created without
  an existing matching license row. No fuzzy-name publication match is used.

## Run

Keep all inputs and outputs under a private path such as
`C:\TrustHub-Work\osha-con-002-g1\`. Run once per state:

```powershell
python scripts/osha/group1_matcher.py `
  --state VA `
  --licenses C:\TrustHub-Work\osha-con-002-g1\raw\licenses.csv `
  --inspections C:\TrustHub-Work\osha-con-002-g1\raw\osha_by_state\va_inspections.csv.gz `
  --crosswalk C:\TrustHub-Work\osha-con-002-g1\raw\tab20_zcta520_county20_natl.txt `
  --output-dir C:\TrustHub-Work\osha-con-002-g1\spot-review\va
```

The output is a deterministic gzip CSV, receipt JSON, and ZIP package whose
SHA256 is printed. Candidate rows include business and license identifiers;
do not copy them into Git, Slack, or public artifacts. Select the first 25
exact, strong, and weak candidate rows per state for private spot review.

Run matcher regression tests with:

```powershell
python -X utf8 scripts/osha/test_group1_matcher.py
```
