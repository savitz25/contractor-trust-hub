-- Additive migration for live DBs already on Phase-1 schema.
-- Safe to re-run (IF NOT EXISTS / guarded ADD COLUMN).

ALTER TABLE entities ADD COLUMN IF NOT EXISTS name_normalized TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS fei_number TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS registered_agent_name TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS officers JSONB;

ALTER TABLE contractor_entities ADD COLUMN IF NOT EXISTS match_method TEXT;
ALTER TABLE contractor_entities ADD COLUMN IF NOT EXISTS linked_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS entities_name_normalized_idx ON entities (name_normalized);
CREATE INDEX IF NOT EXISTS entities_fei_idx ON entities (fei_number);
CREATE INDEX IF NOT EXISTS entities_postal_idx ON entities (postal_code);
CREATE INDEX IF NOT EXISTS entities_source_name_idx ON entities (source_system, name_normalized);
CREATE INDEX IF NOT EXISTS contractor_entities_method_idx ON contractor_entities (match_method);
CREATE INDEX IF NOT EXISTS contractor_entities_entity_idx ON contractor_entities (entity_id);
