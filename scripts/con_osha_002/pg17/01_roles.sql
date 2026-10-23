-- Roles created inside the disposable PostgreSQL 17 container before migration
-- 020, so that migration's REVOKE path runs. PUBLIC is a reserved pseudo-role
-- and cannot be created with CREATE ROLE; the assertions test it with
-- has_table_privilege('public', ...). anon and authenticated are real roles.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;
