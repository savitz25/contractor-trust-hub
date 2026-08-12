-- Phase 2 — project plan quote requests (controlled introductions, not auto-spam)

CREATE TABLE IF NOT EXISTS plan_quote_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  name              TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT NOT NULL,
  project_type      TEXT NOT NULL,
  project_label     TEXT,
  location_label    TEXT,
  state             CHAR(2) DEFAULT 'FL',
  zip               TEXT,
  city              TEXT,
  county            TEXT,
  scale_band        TEXT,
  scale_label       TEXT,
  budget_band       TEXT,
  details           TEXT,
  notes             TEXT,
  cost_low          INTEGER,
  cost_mid          INTEGER,
  cost_high         INTEGER,
  contractor_slugs  TEXT[],
  project_context   JSONB,
  status            TEXT NOT NULL DEFAULT 'new',
  source            TEXT DEFAULT 'plan_flow'
);

CREATE INDEX IF NOT EXISTS plan_quote_requests_created_idx
  ON plan_quote_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS plan_quote_requests_email_idx
  ON plan_quote_requests (email);
