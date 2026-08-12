-- Stage 5: durable accounts, projects, watches, alerts, Home Passport
-- Apply with your usual migration path (psql / Supabase SQL editor).

CREATE TABLE IF NOT EXISTS app_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_magic_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL,
  token_hash      TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_magic_links_email_idx ON auth_magic_links (email);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id);

-- Full workspace blob for durability without over-normalizing Stage 4 shapes
CREATE TABLE IF NOT EXISTS user_workspace (
  user_id         UUID PRIMARY KEY REFERENCES app_users (id) ON DELETE CASCADE,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alert_preferences (
  user_id         UUID PRIMARY KEY REFERENCES app_users (id) ON DELETE CASCADE,
  watch_license   BOOLEAN NOT NULL DEFAULT true,
  watch_discipline BOOLEAN NOT NULL DEFAULT true,
  watch_entity    BOOLEAN NOT NULL DEFAULT true,
  project_payment_docs BOOLEAN NOT NULL DEFAULT true,
  project_completion BOOLEAN NOT NULL DEFAULT true,
  warranty_reminders BOOLEAN NOT NULL DEFAULT true,
  email_enabled   BOOLEAN NOT NULL DEFAULT true,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alert_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  href            TEXT,
  contractor_slug TEXT,
  project_id      TEXT,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_sent_at   TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alert_events_user_created_idx
  ON alert_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS passport_properties (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  property_key    TEXT NOT NULL,
  address_label   TEXT NOT NULL,
  zip             TEXT,
  city            TEXT,
  county          TEXT,
  notes           TEXT,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, property_key)
);

CREATE INDEX IF NOT EXISTS passport_properties_user_idx ON passport_properties (user_id);
