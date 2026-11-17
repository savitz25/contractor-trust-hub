-- Apply only to a disposable copy of fixture.sql.
-- This reader runs once per statement, not once per contractor. Both the legacy
-- join and the occupation prefetch stay inside the 8 s budget on this fixture.
-- It does not reproduce the per-row Sunbiz probe. Never run against a shared
-- or Production database.
ALTER TABLE contractor_entities RENAME TO contractor_entities_t;

CREATE FUNCTION fl_dir_perf_005_ce() RETURNS SETOF contractor_entities_t
LANGUAGE plpgsql VOLATILE AS $$
BEGIN
  PERFORM pg_sleep(0.3);
  RETURN QUERY SELECT * FROM contractor_entities_t;
END;
$$;

CREATE VIEW contractor_entities AS
SELECT * FROM fl_dir_perf_005_ce();
