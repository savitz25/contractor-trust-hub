-- Disposable parent shell for the PostgreSQL 17 engine test.
-- Migrations 018 and 019 are applied unchanged after this file. They foreign-key
-- ingest_batches(id) and contractors(id). This is not the production schema,
-- not a Supabase branch, and not a rewrite of migrations 018 or 019.
-- Synthetic rows only. No production database is contacted.

CREATE TABLE IF NOT EXISTS ingest_batches (
  id UUID PRIMARY KEY,
  source_system TEXT NOT NULL,
  source_dataset TEXT NOT NULL,
  checksum_sha256 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contractors (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL
);
