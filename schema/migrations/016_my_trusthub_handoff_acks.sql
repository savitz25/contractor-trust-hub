-- My TrustHub V2 — Contractor hand-off acknowledgements (NOT APPLIED BY DEPLOY).
-- Target: Contractor Trust Hub production database. Operator applies this before
-- the Florida parent canary is activated. It is independent of every existing
-- table and holds no account, contractor, license or profile data.
--
-- One row per My TrustHub hand-off that the parent acknowledged over the signed
-- source channel: the SHA-256 of the continuation reference, the SHA-256 of the
-- browser binding it was staged for, and the outcome. Rows expire after a day.
--
-- Until this exists the application behaves safely: an acknowledgement cannot
-- be recorded, a status read answers "unknown", and the Save toggle never
-- claims an account Save or Unsave (device Save is unaffected).
--
-- Rollback: DROP TABLE my_trusthub_handoff_acks;

CREATE TABLE IF NOT EXISTS my_trusthub_handoff_acks (
  continuation_hash TEXT PRIMARY KEY CHECK (continuation_hash ~ '^[a-f0-9]{64}$'),
  browser_hash      TEXT NOT NULL CHECK (browser_hash ~ '^[a-f0-9]{64}$'),
  outcome           TEXT NOT NULL CHECK (outcome IN ('saved', 'already_saved', 'local_only')),
  acknowledged_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL,
  CHECK (expires_at > acknowledged_at AND expires_at <= acknowledged_at + interval '1 day')
);

CREATE INDEX IF NOT EXISTS my_trusthub_handoff_acks_expiry_idx ON my_trusthub_handoff_acks (expires_at);

-- Verification marker (read-only). Expected: one row, 5 columns.
-- SELECT count(*) AS columns FROM information_schema.columns WHERE table_name = 'my_trusthub_handoff_acks';

-- Housekeeping (operator, optional, bounded):
-- DELETE FROM my_trusthub_handoff_acks WHERE continuation_hash IN
--   (SELECT continuation_hash FROM my_trusthub_handoff_acks WHERE expires_at < now() ORDER BY expires_at LIMIT 500);

-- No browser role may read or write this table (service connection only).
ALTER TABLE my_trusthub_handoff_acks ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON my_trusthub_handoff_acks FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON my_trusthub_handoff_acks FROM authenticated;
  END IF;
END $$;
