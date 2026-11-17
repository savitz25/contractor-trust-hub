-- Apply only to a disposable copy of fixture.sql.
-- The caller turns enable_nestloop and enable_mergejoin off on THIS database
-- only. That makes the legacy join hash-join a sequential read of contractors.
-- The function is COST 1 so the planner applies it as a sequential-scan filter
-- instead of deferring it until after the hash match. Each scanned row sleeps
-- 1 ms, which is past the 8 s statement timeout. The occupation prefetch keeps
-- the primary-key lookup, so the function runs only for matched ids.
-- This is a shape test. An unconstrained plan does not need these two switches
-- off, and this file does not prove a Production timeout.
-- Never run against a shared or Production database.
ALTER TABLE contractors RENAME TO contractors_t;

CREATE FUNCTION fl_dir_perf_005_row_cost(id uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE COST 1 AS $$
BEGIN
  PERFORM pg_sleep(0.001);
  RETURN true;
END;
$$;

CREATE VIEW contractors AS
SELECT * FROM contractors_t t WHERE fl_dir_perf_005_row_cost(t.id);
