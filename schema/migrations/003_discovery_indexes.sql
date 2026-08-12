-- Discovery layer: county + occupation filters for Florida Verify browse pages

CREATE INDEX IF NOT EXISTS licenses_county_name_lower_idx
  ON licenses (LOWER(TRIM(county_name)))
  WHERE county_name IS NOT NULL AND TRIM(county_name) <> '';

CREATE INDEX IF NOT EXISTS licenses_occupation_source_idx
  ON licenses (source_system, occupation_code);

CREATE INDEX IF NOT EXISTS contractors_primary_county_lower_idx
  ON contractors (LOWER(TRIM(primary_county)))
  WHERE primary_county IS NOT NULL AND TRIM(primary_county) <> '' AND is_thin_profile = FALSE;

CREATE INDEX IF NOT EXISTS licenses_source_status_occ_idx
  ON licenses (source_system, occupation_code, status_normalized);
