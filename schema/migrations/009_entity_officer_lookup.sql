-- ASK-SEARCH-010.3: additive, indexed officer lookup for FL entity lineage.
-- entities.officers remains authoritative. This table contains only officers on
-- entities already eligible for the existing public lineage query.

SET lock_timeout = '2s';
SET statement_timeout = '60s';

CREATE OR REPLACE FUNCTION normalize_entity_officer_name(raw_name TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT btrim(regexp_replace(
    regexp_replace(upper(raw_name), '[.,''"/\\-]+', ' ', 'g'),
    '\s+', ' ', 'g'
  ));
$$;

CREATE TABLE IF NOT EXISTS entity_officer_lookup (
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  source_ordinal INTEGER NOT NULL CHECK (source_ordinal >= 0),
  officer_name_raw TEXT NOT NULL,
  officer_name_normalized TEXT NOT NULL,
  officer_title TEXT,
  officer_type TEXT,
  PRIMARY KEY (entity_id, source_ordinal),
  CHECK (officer_name_normalized = normalize_entity_officer_name(officer_name_raw))
);

CREATE INDEX IF NOT EXISTS entity_officer_lookup_name_entity_idx
  ON entity_officer_lookup (officer_name_normalized, entity_id);

CREATE OR REPLACE FUNCTION sync_entity_officer_lookup(target_entity_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM entity_officer_lookup WHERE entity_id = target_entity_id;

  INSERT INTO entity_officer_lookup (
    entity_id,
    source_ordinal,
    officer_name_raw,
    officer_name_normalized,
    officer_title,
    officer_type
  )
  SELECT
    e.id,
    officer.ordinality::INTEGER - 1,
    officer.item->>'name',
    normalize_entity_officer_name(officer.item->>'name'),
    NULLIF(btrim(officer.item->>'title'), ''),
    NULLIF(btrim(officer.item->>'type'), '')
  FROM entities e
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(e.officers) = 'array' THEN e.officers ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS officer(item, ordinality)
  WHERE e.id = target_entity_id
    AND e.source_system = 'fl_sunbiz'
    AND jsonb_typeof(officer.item) = 'object'
    AND jsonb_typeof(officer.item->'name') = 'string'
    AND normalize_entity_officer_name(officer.item->>'name') <> ''
    AND EXISTS (
      SELECT 1
      FROM contractor_entities ce
      WHERE ce.entity_id = e.id
        AND ce.role IN ('sunbiz_entity', 'linked', 'entity')
        AND ce.confidence IS NOT NULL
        AND ce.confidence >= 0.90
    );
END;
$$;

CREATE OR REPLACE FUNCTION sync_entity_officer_lookup_from_entity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM sync_entity_officer_lookup(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_entity_officer_lookup_from_link()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM sync_entity_officer_lookup(OLD.entity_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP <> 'UPDATE' OR NEW.entity_id <> OLD.entity_id) THEN
    PERFORM sync_entity_officer_lookup(NEW.entity_id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM sync_entity_officer_lookup(NEW.entity_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS entity_officer_lookup_entity_insert ON entities;
CREATE TRIGGER entity_officer_lookup_entity_insert
AFTER INSERT ON entities
FOR EACH ROW EXECUTE FUNCTION sync_entity_officer_lookup_from_entity();

DROP TRIGGER IF EXISTS entity_officer_lookup_entity_update ON entities;
CREATE TRIGGER entity_officer_lookup_entity_update
AFTER UPDATE OF officers, source_system ON entities
FOR EACH ROW
WHEN (OLD.officers IS DISTINCT FROM NEW.officers OR OLD.source_system IS DISTINCT FROM NEW.source_system)
EXECUTE FUNCTION sync_entity_officer_lookup_from_entity();

DROP TRIGGER IF EXISTS entity_officer_lookup_link_change ON contractor_entities;
CREATE TRIGGER entity_officer_lookup_link_change
AFTER INSERT OR UPDATE OR DELETE ON contractor_entities
FOR EACH ROW EXECUTE FUNCTION sync_entity_officer_lookup_from_link();

COMMENT ON TABLE entity_officer_lookup IS
  'Derived exact-name lookup for linked FL Sunbiz officers; entities.officers remains authoritative';
COMMENT ON COLUMN entity_officer_lookup.source_ordinal IS
  'Zero-based source position in entities.officers; preserves deterministic source identity';

-- Backfill is intentionally performed in bounded committed batches by
-- scripts/backfill-entity-officer-lookup.mts after this additive schema is applied.
-- Containment: roll back application query use and leave this derived table/index in place.
