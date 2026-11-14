-- FL-DIR-PERF-003 disposable LOCAL fixture (apply on top of scripts/fl_dir_perf_001/synthetic_schema.sql).
-- Synthetic rows only; never run against a shared database.
-- Side-list fault: the directory statements for /florida/{trade}, /florida/{county} and
-- /florida/{county}/{trade} keep working, but the city list (REGEXP_REPLACE) and the statewide
-- county facet (text ~ operator) raise an error, exactly like a facet read that times out after a
-- successful directory read. A public-schema shadow ahead of pg_catalog is used only on this database.
CREATE FUNCTION public.regexp_replace(text, text, text, text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'synthetic side-list failure'; END $$;
CREATE FUNCTION public.fl_dir_perf_003_fault_regex(text, text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'synthetic side-list failure'; END $$;
CREATE OPERATOR public.~ (LEFTARG = text, RIGHTARG = text, FUNCTION = public.fl_dir_perf_003_fault_regex);
DO $$ BEGIN
  EXECUTE format('ALTER DATABASE %I SET search_path = public, pg_catalog', current_database());
END $$;
