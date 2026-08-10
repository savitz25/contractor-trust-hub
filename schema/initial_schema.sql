-- Contractor Trust Hub — Phase 0/1 schema
-- Target: PostgreSQL 15+
-- Refined against real FL DBPR CONSTRUCTIONLICENSE_1.csv + staged adapter outputs

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Provenance (ingest batches / runs)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ingest_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system   TEXT NOT NULL,          -- e.g. fl_dbpr
  source_dataset  TEXT NOT NULL,          -- e.g. construction_licensees
  source_url      TEXT,
  source_file     TEXT,
  extracted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_count       INTEGER,
  checksum_sha256 TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ingest_batches_source_idx
  ON ingest_batches (source_system, source_dataset, extracted_at DESC);

-- ---------------------------------------------------------------------------
-- Contractors (canonical shell)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contractors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE,
  display_name    TEXT NOT NULL,
  legal_name      TEXT,
  dba_name        TEXT,
  home_state      CHAR(2),
  primary_city    TEXT,
  primary_county  TEXT,
  phone           TEXT,
  website         TEXT,
  is_thin_profile BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contractors_home_state_idx ON contractors (home_state);
CREATE INDEX IF NOT EXISTS contractors_display_name_idx ON contractors (display_name);
CREATE INDEX IF NOT EXISTS contractors_legal_name_idx ON contractors (legal_name);

-- ---------------------------------------------------------------------------
-- Licenses
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS licenses (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id           UUID REFERENCES contractors (id) ON DELETE SET NULL,
  source_system           TEXT NOT NULL,           -- fl_dbpr
  source_board            TEXT,                    -- e.g. board 06
  external_key            TEXT NOT NULL,           -- full license id CBC015082
  occupation_code         TEXT NOT NULL,           -- CBC, CGC, ...
  occupation_description  TEXT,
  license_number          TEXT,                    -- numeric core 0015082
  class_code              TEXT,
  licensee_name_raw       TEXT NOT NULL,
  dba_name_raw            TEXT,
  primary_status          TEXT,                    -- board primary (C, S, P, ...)
  secondary_status        TEXT,                    -- A active, I inactive, ...
  status_normalized       TEXT,                    -- active | inactive | current | other | unknown
  original_licensure_date DATE,
  effective_date          DATE,
  expiration_date         DATE,
  address_line_1          TEXT,
  address_line_2          TEXT,
  address_line_3          TEXT,
  city                    TEXT,
  state                   CHAR(2),
  postal_code             TEXT,
  county_code             TEXT,
  county_name             TEXT,
  board_number            TEXT,
  raw_payload             JSONB,                   -- full source row
  ingest_batch_id         UUID REFERENCES ingest_batches (id),
  first_seen_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_verified_at        TIMESTAMPTZ,             -- last successful load / board refresh
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_system, external_key)
);

CREATE INDEX IF NOT EXISTS licenses_occupation_idx ON licenses (occupation_code);
CREATE INDEX IF NOT EXISTS licenses_state_city_idx ON licenses (state, city);
CREATE INDEX IF NOT EXISTS licenses_status_idx ON licenses (status_normalized);
CREATE INDEX IF NOT EXISTS licenses_expiration_idx ON licenses (expiration_date);
CREATE INDEX IF NOT EXISTS licenses_contractor_idx ON licenses (contractor_id);
CREATE INDEX IF NOT EXISTS licenses_license_number_idx ON licenses (license_number);
CREATE INDEX IF NOT EXISTS licenses_state_status_idx ON licenses (state, status_normalized);
CREATE INDEX IF NOT EXISTS licenses_county_code_idx ON licenses (county_code);

-- ---------------------------------------------------------------------------
-- Corporate / qualifying entities (Sunbiz + DBPR QB shells)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS entities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system     TEXT NOT NULL,          -- fl_dbpr | fl_sunbiz | ...
  external_key      TEXT NOT NULL,
  legal_name        TEXT NOT NULL,
  entity_type       TEXT,                   -- qualifying_business | corporation | ...
  status            TEXT,
  formation_date    DATE,
  principal_address TEXT,
  city              TEXT,
  state             CHAR(2),
  postal_code       TEXT,
  county_name       TEXT,
  raw_payload       JSONB,
  ingest_batch_id   UUID REFERENCES ingest_batches (id),
  last_verified_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_system, external_key)
);

CREATE INDEX IF NOT EXISTS entities_type_idx ON entities (entity_type);
CREATE INDEX IF NOT EXISTS entities_state_idx ON entities (state);
CREATE INDEX IF NOT EXISTS entities_legal_name_idx ON entities (legal_name);

CREATE TABLE IF NOT EXISTS contractor_entities (
  contractor_id   UUID NOT NULL REFERENCES contractors (id) ON DELETE CASCADE,
  entity_id       UUID NOT NULL REFERENCES entities (id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'linked',  -- qualifier | officer | dba | qualifying_business | linked
  confidence      NUMERIC(4,3) CHECK (confidence >= 0 AND confidence <= 1),
  evidence        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contractor_id, entity_id, role)
);

-- ---------------------------------------------------------------------------
-- Discipline (board actions)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS discipline_actions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id          UUID REFERENCES contractors (id) ON DELETE SET NULL,
  license_id             UUID REFERENCES licenses (id) ON DELETE SET NULL,
  source_system          TEXT NOT NULL,       -- fl_dbpr
  source_dataset         TEXT NOT NULL,       -- contractor_disc_lic | ula | rf
  external_key           TEXT NOT NULL,       -- deterministic row key for upserts
  complaint_number       TEXT,
  license_type           TEXT,
  license_number_raw     TEXT,
  respondent_name        TEXT NOT NULL,
  classification         TEXT,
  entered_date           DATE,
  disposition            TEXT,
  disposition_date       DATE,
  discipline_description TEXT,
  violation_code         TEXT,
  address_line_1         TEXT,
  city                   TEXT,
  state                  CHAR(2),
  postal_code            TEXT,
  county_name            TEXT,
  raw_payload            JSONB,
  ingest_batch_id        UUID REFERENCES ingest_batches (id),
  last_verified_at       TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_system, external_key)
);

CREATE INDEX IF NOT EXISTS discipline_complaint_idx
  ON discipline_actions (source_system, complaint_number);
CREATE INDEX IF NOT EXISTS discipline_respondent_idx
  ON discipline_actions (respondent_name);
CREATE INDEX IF NOT EXISTS discipline_license_raw_idx
  ON discipline_actions (license_number_raw);

-- ---------------------------------------------------------------------------
-- Permits (placeholder for local open data)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS permit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id   UUID REFERENCES contractors (id) ON DELETE SET NULL,
  source_system   TEXT NOT NULL,
  external_key    TEXT NOT NULL,
  permit_number   TEXT,
  issued_date     DATE,
  permit_type     TEXT,
  status          TEXT,
  valuation       NUMERIC(14,2),
  address         TEXT,
  city            TEXT,
  county          TEXT,
  state           CHAR(2),
  raw_payload     JSONB,
  ingest_batch_id UUID REFERENCES ingest_batches (id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_system, external_key)
);

-- ---------------------------------------------------------------------------
-- Trust scores (transparent components only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trust_scores (
  contractor_id        UUID PRIMARY KEY REFERENCES contractors (id) ON DELETE CASCADE,
  score_version        TEXT NOT NULL DEFAULT '0.1-stub',
  overall_score        NUMERIC(5,2),
  license_component    NUMERIC(5,2),
  discipline_component NUMERIC(5,2),
  entity_component     NUMERIC(5,2),
  activity_component   NUMERIC(5,2),
  explanation          JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Compatibility views (prompt / product aliases)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW discipline_events AS
  SELECT * FROM discipline_actions;

CREATE OR REPLACE VIEW ingest_runs AS
  SELECT * FROM ingest_batches;

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

COMMENT ON TABLE licenses IS 'Board credentials; FL DBPR construction extract is source of truth for wave 1';
COMMENT ON COLUMN licenses.external_key IS 'Prefer alternate full license id (e.g. CBC015082)';
COMMENT ON COLUMN licenses.status_normalized IS 'Derived: active | inactive | current | other | unknown';
COMMENT ON COLUMN licenses.last_verified_at IS 'Timestamp of last successful ingest refresh for this row';
COMMENT ON TABLE entities IS 'Corporate shells (Sunbiz) and DBPR Qualifying Business rows (no invented license numbers)';
COMMENT ON TABLE trust_scores IS 'Never store black-box scores; explanation must list source rows';
