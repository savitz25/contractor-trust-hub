-- FL-DIR-PERF-002 "slow but inside budget" fixture (local only): every statement that reads licenses sleeps 2 s
-- once (uncorrelated InitPlan), well under the app's 8 s statement_timeout, so the read must still succeed.
CREATE FUNCTION fl_dir_perf_slow_ok() RETURNS boolean LANGUAGE sql VOLATILE AS $$ SELECT pg_sleep(2); SELECT true $$;
CREATE OR REPLACE VIEW licenses AS SELECT * FROM licenses_t WHERE (SELECT fl_dir_perf_slow_ok());
