-- Enhanced County migration 011 — paste entire file into Supabase SQL Editor.
-- Additive. No DROP/TRUNCATE/DELETE. No secrets. No activity rows.
BEGIN;

-- Preflight: fail if unexpected collision on non-011 objects is not needed;
-- CREATE IF NOT EXISTS is used. Confirm licenses/contractors exist.
DO $$
BEGIN
  IF to_regclass('public.licenses') IS NULL THEN
    RAISE EXCEPTION 'public.licenses missing — abort 011';
  END IF;
  IF to_regclass('public.contractors') IS NULL THEN
    RAISE EXCEPTION 'public.contractors missing — abort 011';
  END IF;
END
$$;

-- Prompt 7/8: Broward + Palm Beach enhanced-county foundation.
-- Additive. Does not alter licenses / contractors identity or statewide Intelligence semantics.
-- Idempotent CREATE IF NOT EXISTS. Safe to apply before extracts arrive.

-- ---------------------------------------------------------------------------
-- Jurisdiction coverage (denominator for every activity metric)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enhanced_jurisdictions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county_slug             TEXT NOT NULL,
  jurisdiction_slug       TEXT NOT NULL,
  jurisdiction_label      TEXT NOT NULL,
  kind                    TEXT NOT NULL,
  permitting_authority    TEXT NOT NULL,
  public_search_url       TEXT,
  vendor                  TEXT,
  agency                  TEXT,
  coverage_type           TEXT,
  source                  TEXT,
  expected_permit_authority TEXT,
  data_availability       TEXT NOT NULL DEFAULT 'none',
  metadata_status         TEXT NOT NULL DEFAULT 'seeded',
  onestop_participation   BOOLEAN,
  coverage_start          DATE,
  coverage_end            DATE,
  coverage_last_refreshed TIMESTAMPTZ,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (county_slug, jurisdiction_slug),
  CONSTRAINT enhanced_jurisdictions_kind_check
    CHECK (kind IN ('county', 'unincorporated', 'municipal', 'multi_jurisdiction', 'unknown'))
);

-- ---------------------------------------------------------------------------
-- Local credentials (county COC / certification / enrollment / installer registration)
-- Distinct from DBPR licenses. Never collapse into licenses.external_key.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.local_credentials (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system           TEXT NOT NULL,
  county_slug             TEXT NOT NULL,
  jurisdiction_slug       TEXT NOT NULL,
  local_credential_key    TEXT NOT NULL,
  certificate_number_raw  TEXT,
  classification_raw      TEXT,
  person_name_raw         TEXT,
  firm_name_raw           TEXT,
  status_raw              TEXT NOT NULL,
  currentness             TEXT NOT NULL,
  issue_date              DATE,
  renewal_date            DATE,
  expiration_date         DATE,
  qualifier_name_raw      TEXT,
  insurance_status_raw    TEXT,
  insurance_expiration    DATE,
  workers_comp_status_raw TEXT,
  workers_comp_exemption  BOOLEAN,
  bond_status_raw         TEXT,
  bond_amount             NUMERIC,
  bond_expiration         DATE,
  business_tax_receipt_raw TEXT,
  mailing_address         TEXT,
  physical_address        TEXT,
  source_url              TEXT,
  source_record_id        TEXT,
  retrieved_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  record_effective_at     TIMESTAMPTZ,
  parser_version          TEXT,
  source_fingerprint      TEXT,
  raw_payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_system, local_credential_key),
  CONSTRAINT local_credentials_currentness_check
    CHECK (currentness IN (
      'CURRENT_LOCAL_AUTHORIZATION',
      'CURRENT_REGISTRATION',
      'HISTORICAL_LOCAL_LICENSE',
      'PREEMPTED_CLASS',
      'EXPIRED',
      'REVOKED',
      'STATE_ENROLLED',
      'INSTALLER_REGISTRATION',
      'UNKNOWN'
    ))
);

CREATE INDEX IF NOT EXISTS local_credentials_county_idx ON public.local_credentials (county_slug, currentness);
CREATE INDEX IF NOT EXISTS local_credentials_cert_idx ON public.local_credentials (UPPER(REPLACE(COALESCE(certificate_number_raw, ''), ' ', '')));

-- LOCAL_CREDENTIAL → RELATES_TO / REGISTERED_FROM → STATE_CREDENTIAL
CREATE TABLE IF NOT EXISTS public.local_credential_relations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_credential_id     UUID NOT NULL REFERENCES public.local_credentials (id) ON DELETE RESTRICT,
  relation_kind           TEXT NOT NULL,
  state_license_id        UUID REFERENCES public.licenses (id) ON DELETE SET NULL,
  state_external_key      TEXT,
  identity_state          TEXT NOT NULL,
  identity_method         TEXT NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT local_credential_relations_kind_check
    CHECK (relation_kind IN ('RELATES_TO', 'REGISTERED_FROM', 'QUALIFIED_BY')),
  CONSTRAINT local_credential_relations_identity_check
    CHECK (identity_state IN ('CONFIRMED', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'UNRESOLVED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS local_credential_relations_identity_uidx ON public.local_credential_relations (local_credential_id, relation_kind, COALESCE(state_external_key, ''));

-- ---------------------------------------------------------------------------
-- Permit source records — keyed by jurisdiction + permit number OR source record ID
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permit_source_records (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system           TEXT NOT NULL,
  source_jurisdiction     TEXT NOT NULL,
  county_slug             TEXT NOT NULL,
  municipality            TEXT,
  permit_number           TEXT NOT NULL,
  source_record_id        TEXT,
  permit_type_raw         TEXT,
  permit_type_normalized  TEXT,
  work_description        TEXT,
  property_address        TEXT,
  parcel_id               TEXT,
  contractor_name_raw     TEXT,
  contractor_license_raw  TEXT,
  contractor_license_normalized TEXT,
  local_contractor_id     TEXT,
  applicant_name_raw      TEXT,
  qualifier_name_raw      TEXT,
  expeditor_name_raw      TEXT,
  application_date        DATE,
  issue_date              DATE,
  expiration_date         DATE,
  final_date              DATE,
  status_raw              TEXT NOT NULL,
  status_normalized       TEXT NOT NULL DEFAULT 'unknown',
  valuation               NUMERIC,
  job_value               NUMERIC,
  fees                    NUMERIC,
  owner_name_raw          TEXT,
  source_url              TEXT,
  retrieved_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_updated_at       TIMESTAMPTZ,
  parser_version          TEXT,
  source_fingerprint      TEXT,
  raw_payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_system, source_jurisdiction, permit_number),
  CONSTRAINT permit_source_records_status_check
    CHECK (status_normalized IN (
      'applied', 'under_review', 'ready_for_issuance', 'issued', 'active',
      'inactive', 'expired', 'stop_issue', 'cancelled', 'final', 'closed', 'unknown'
    ))
);

CREATE INDEX IF NOT EXISTS permit_source_records_issue_idx ON public.permit_source_records (county_slug, source_jurisdiction, issue_date);
CREATE INDEX IF NOT EXISTS permit_source_records_license_idx ON public.permit_source_records (contractor_license_normalized)
  WHERE contractor_license_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS permit_source_records_status_idx ON public.permit_source_records (status_normalized);

CREATE TABLE IF NOT EXISTS public.permit_lifecycle_events (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_source_record_id UUID NOT NULL REFERENCES public.permit_source_records (id) ON DELETE CASCADE,
  event_type_raw          TEXT NOT NULL,
  event_type_normalized   TEXT,
  event_at                TIMESTAMPTZ,
  result_raw              TEXT,
  inspector_raw           TEXT,
  source_fingerprint      TEXT,
  raw_payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  retrieved_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (permit_source_record_id, event_type_raw, event_at)
);

CREATE TABLE IF NOT EXISTS public.permit_attributions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_source_record_id UUID NOT NULL REFERENCES public.permit_source_records (id) ON DELETE CASCADE,
  identity_state          TEXT NOT NULL,
  identity_method         TEXT NOT NULL,
  matched_license_id      UUID REFERENCES public.licenses (id) ON DELETE SET NULL,
  matched_contractor_id   UUID REFERENCES public.contractors (id) ON DELETE SET NULL,
  matched_local_credential_id UUID REFERENCES public.local_credentials (id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (permit_source_record_id),
  CONSTRAINT permit_attributions_state_check
    CHECK (identity_state IN ('CONFIRMED', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'UNRESOLVED'))
);

CREATE INDEX IF NOT EXISTS permit_attributions_license_idx ON public.permit_attributions (matched_license_id)
  WHERE matched_license_id IS NOT NULL;

-- Public contact observations (Network rule). Never overwrite a different secondary value.
CREATE TABLE IF NOT EXISTS public.public_contact_observations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system           TEXT NOT NULL,
  source_url              TEXT,
  retrieved_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind                    TEXT NOT NULL,
  value                   TEXT NOT NULL,
  value_normalized        TEXT NOT NULL,
  attributed_entity_kind  TEXT NOT NULL,
  attributed_license_id   UUID REFERENCES public.licenses (id) ON DELETE SET NULL,
  attributed_local_credential_id UUID REFERENCES public.local_credentials (id) ON DELETE SET NULL,
  attribution_class       TEXT NOT NULL,
  is_agency_number        BOOLEAN NOT NULL DEFAULT FALSE,
  currentness             TEXT,
  raw_payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT public_contact_observations_kind_check
    CHECK (kind IN (
      'email', 'phone', 'phone_extension', 'website', 'contact_name',
      'contact_title', 'mailing_address', 'physical_address', 'additional_location'
    )),
  CONSTRAINT public_contact_observations_attr_check
    CHECK (attribution_class IN ('CONFIRMED', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'UNRESOLVED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS public_contact_observations_uidx ON public.public_contact_observations (
    source_system,
    kind,
    value_normalized,
    COALESCE(attributed_license_id::text, ''),
    COALESCE(attributed_local_credential_id::text, '')
  );

COMMENT ON TABLE public.permit_source_records IS
  'Jurisdiction-scoped permits. Permit numbers are unique only within source_jurisdiction.';
COMMENT ON TABLE public.local_credentials IS
  'County/local certificates, enrollments, and installer registrations. Not DBPR credentials.';
COMMENT ON TABLE public.permit_attributions IS
  'Fail-closed permit→credential links. Name-only matches stay REVIEW_REQUIRED/UNRESOLVED and are not public volume.';
COMMENT ON COLUMN public.permit_source_records.valuation IS
  'Recorded permit valuation. Null when missing. Never store missing as 0. Not revenue.';

CREATE TABLE IF NOT EXISTS public.enhanced_source_files (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sha256                  TEXT NOT NULL UNIQUE,
  original_filename       TEXT NOT NULL,
  received_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  county_slug             TEXT NOT NULL,
  agency                  TEXT NOT NULL,
  source_name             TEXT NOT NULL,
  requested_date_range    TEXT,
  file_format             TEXT NOT NULL,
  row_count               BIGINT,
  parser_version          TEXT,
  request_id              TEXT,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT enhanced_source_files_sha_check
    CHECK (sha256 ~ '^[0-9a-f]{64}$')
);

COMMENT ON TABLE public.enhanced_source_files IS
  'Provenance for received county exports. Never load a mystery spreadsheet.';
COMMENT ON TABLE public.enhanced_jurisdictions IS
  'AHJ coverage metadata. Not permit activity. Seeding this table does not make a county Enhanced.';

REVOKE ALL ON TABLE
  public.enhanced_jurisdictions,
  public.local_credentials,
  public.local_credential_relations,
  public.permit_source_records,
  public.permit_lifecycle_events,
  public.permit_attributions,
  public.public_contact_observations,
  public.enhanced_source_files
FROM PUBLIC, anon, authenticated;

-- Postflight
SELECT c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'enhanced_jurisdictions','local_credentials','local_credential_relations',
    'permit_source_records','permit_lifecycle_events','permit_attributions',
    'public_contact_observations','enhanced_source_files'
  )
ORDER BY 1;

SELECT
  (SELECT count(*) FROM public.enhanced_jurisdictions) AS enhanced_jurisdictions,
  (SELECT count(*) FROM public.local_credentials) AS local_credentials,
  (SELECT count(*) FROM public.permit_source_records) AS permit_source_records,
  (SELECT count(*) FROM public.permit_attributions) AS permit_attributions,
  (SELECT count(*) FROM public.enhanced_source_files) AS enhanced_source_files;

COMMIT;
