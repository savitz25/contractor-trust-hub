-- INTEL P0: qualifier / business graph. Additive. Does not merge people by name.
-- Holder node is the regulator-backed holder of ONE credential. Person resolution is later.

CREATE TABLE IF NOT EXISTS fl_license_holders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_key        TEXT NOT NULL UNIQUE,          -- fl_dbpr:credential:{external_key}
  display_name      TEXT NOT NULL,                 -- licensee_name_raw as published
  source_system     TEXT NOT NULL DEFAULT 'fl_dbpr',
  credential_external_key TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fl_dbpr_business_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_key      TEXT NOT NULL UNIQUE,          -- fl_dbpr:qb:{entity_key} | fl_dbpr:listed:{sha}
  record_kind       TEXT NOT NULL,                 -- qb_entity | listed_name | portal_business
  legal_name        TEXT NOT NULL,
  name_normalized   TEXT,
  dbpr_licid        TEXT,                          -- portal licid when known
  source_system     TEXT NOT NULL DEFAULT 'fl_dbpr',
  entity_id         UUID REFERENCES entities (id) ON DELETE SET NULL,
  attribution_class TEXT,
  raw_payload       JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fl_qualifier_relationships (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_key                 TEXT NOT NULL,
  credential_external_key    TEXT NOT NULL,
  business_key               TEXT NOT NULL,
  relationship_type_raw      TEXT NOT NULL,
  relationship_type_canonical TEXT NOT NULL,
  status_raw                 TEXT,
  effective_on               DATE,
  ended_on                   DATE,
  current_or_historical      TEXT NOT NULL DEFAULT 'unknown',  -- current | historical | unknown
  source                     TEXT NOT NULL,                    -- fl_dbpr_licensee_extract | fl_dbpr_license_relation | fl_dbpr_portal_search
  source_url                 TEXT,
  source_identifier          TEXT,
  retrieved_at               TIMESTAMPTZ,
  attribution_class          TEXT NOT NULL,
  confidence                 NUMERIC(4,3),
  evidence                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (credential_external_key, business_key, relationship_type_canonical, source, source_identifier)
);

CREATE INDEX IF NOT EXISTS fl_qual_rel_cred_idx ON fl_qualifier_relationships (credential_external_key);
CREATE INDEX IF NOT EXISTS fl_qual_rel_biz_idx ON fl_qualifier_relationships (business_key);
CREATE INDEX IF NOT EXISTS fl_qual_rel_type_idx ON fl_qualifier_relationships (relationship_type_canonical);
CREATE INDEX IF NOT EXISTS fl_qual_rel_attr_idx ON fl_qualifier_relationships (attribution_class);
CREATE INDEX IF NOT EXISTS fl_qual_rel_current_idx ON fl_qualifier_relationships (current_or_historical);
CREATE INDEX IF NOT EXISTS fl_dbpr_business_name_idx ON fl_dbpr_business_records (name_normalized);
CREATE UNIQUE INDEX IF NOT EXISTS fl_dbpr_business_licid_uidx
  ON fl_dbpr_business_records (dbpr_licid)
  WHERE dbpr_licid IS NOT NULL AND btrim(dbpr_licid) <> '';

COMMENT ON TABLE fl_license_holders IS
  'One holder node per credential. Do not fuzzy-merge people by name.';
COMMENT ON TABLE fl_dbpr_business_records IS
  'Regulator-backed business representation. listed_name is not automatically a distinct business.';
COMMENT ON TABLE fl_qualifier_relationships IS
  'Credential qualifies business. Adverse history does not inherit across edges.';
COMMENT ON COLUMN fl_qualifier_relationships.relationship_type_canonical IS
  'primary_qualifying_agent | secondary_qualifying_agent | financially_responsible_officer | listed_business_name | other_regulator_defined | unmapped';
COMMENT ON COLUMN fl_qualifier_relationships.ended_on IS
  'Relationship end date only when DBPR publishes one. Never inferred from missing expiration or from related-credential expiration.';
COMMENT ON COLUMN fl_qualifier_relationships.current_or_historical IS
  'current | historical | unknown. Derived from regulator status text, never from a missing end date.';
COMMENT ON COLUMN fl_dbpr_business_records.dbpr_licid IS
  'Numeric portal licid from LicenseDetail hidden ID. One node per licid. Not a trade-license numeric core.';
