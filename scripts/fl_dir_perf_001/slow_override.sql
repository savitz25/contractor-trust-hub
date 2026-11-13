-- Timeout fixture: every statement that reads licenses sleeps 9 s once (uncorrelated InitPlan, evaluated
-- before any row filter), past the app's 8 s SET LOCAL statement_timeout, so Postgres raises
-- "canceling statement due to statement timeout" exactly as on Production, even for zero-row filters.
CREATE FUNCTION fl_dir_perf_slow() RETURNS boolean LANGUAGE sql VOLATILE AS $$ SELECT pg_sleep(9); SELECT true $$;
CREATE OR REPLACE VIEW licenses AS SELECT * FROM licenses_t WHERE (SELECT fl_dir_perf_slow());
