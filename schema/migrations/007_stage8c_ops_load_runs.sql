-- Stage 8C: ops load run history + coverage freshness tracking
-- Supports production verify/audit without claiming complete AHJ coverage.

CREATE TABLE IF NOT EXISTS ops_load_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system     TEXT NOT NULL,          -- fl_permits_wave | nj_dca | fl_dbpr | fl_sunbiz
  source_dataset    TEXT NOT NULL,          -- sample-permits | wave-a | nj_hic | ...
  status            TEXT NOT NULL DEFAULT 'success',  -- success | failed | partial
  row_count         BIGINT NOT NULL DEFAULT 0,
  row_count_prev    BIGINT,
  delta_rows        BIGINT,
  jurisdictions     JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes             TEXT,
  error_message     TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_load_runs_source_idx
  ON ops_load_runs (source_system, source_dataset, started_at DESC);

CREATE INDEX IF NOT EXISTS ops_load_runs_status_idx
  ON ops_load_runs (status, started_at DESC);

COMMENT ON TABLE ops_load_runs IS
  'Stage 8C batch load history for freshness, delta, and failure visibility';

-- Loads remain idempotent by deleting source_label ILIKE 'CTH Wave%' then re-inserting.
