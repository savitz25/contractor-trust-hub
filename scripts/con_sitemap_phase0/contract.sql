-- Disposable PostgreSQL 17 contract. Synthetic rows only; never run on a live branch.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS sitemap_private;
REVOKE ALL ON SCHEMA sitemap_private FROM PUBLIC;
REVOKE ALL ON SCHEMA extensions FROM PUBLIC;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cth_sitemap_reader') THEN CREATE ROLE cth_sitemap_reader NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cth_sitemap_publisher') THEN CREATE ROLE cth_sitemap_publisher NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cth_sitemap_sweeper') THEN CREATE ROLE cth_sitemap_sweeper NOLOGIN; END IF;
END $$;

CREATE TABLE sitemap_private.generation (
  generation_id uuid PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('building','sealed')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  sealed_at timestamptz,
  retired_at timestamptz,
  shard_count integer,
  url_count bigint,
  compressed_bytes bigint,
  manifest_sha256 bytea,
  CHECK ((state='building' AND sealed_at IS NULL AND retired_at IS NULL AND shard_count IS NULL
          AND url_count IS NULL AND compressed_bytes IS NULL AND manifest_sha256 IS NULL)
      OR (state='sealed' AND sealed_at IS NOT NULL AND shard_count>0 AND url_count>0
          AND compressed_bytes>0 AND octet_length(manifest_sha256)=32))
);
CREATE TABLE sitemap_private.shard (
  generation_id uuid NOT NULL REFERENCES sitemap_private.generation(generation_id),
  shard_no integer NOT NULL CHECK (shard_no>=0),
  url_count integer NOT NULL CHECK (url_count BETWEEN 1 AND 40000),
  compressed_payload bytea NOT NULL CHECK (octet_length(compressed_payload)>0),
  compressed_bytes bigint GENERATED ALWAYS AS (octet_length(compressed_payload)) STORED,
  payload_sha256 bytea NOT NULL CHECK (octet_length(payload_sha256)=32),
  PRIMARY KEY(generation_id,shard_no)
);
CREATE TABLE sitemap_private.publication (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  pointer_epoch bigint NOT NULL CHECK(pointer_epoch>=0),
  current_generation_id uuid REFERENCES sitemap_private.generation(generation_id)
    DEFERRABLE INITIALLY DEFERRED
);
INSERT INTO sitemap_private.publication(singleton,pointer_epoch,current_generation_id) VALUES(true,0,NULL);

CREATE OR REPLACE FUNCTION sitemap_private.has_publication_lock()
RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
  SELECT EXISTS (SELECT 1 FROM pg_locks l WHERE l.locktype='advisory' AND l.granted
    AND l.pid=pg_backend_pid() AND l.classid=20261029::oid AND l.objid=1::oid AND l.objsubid=2)
$$;

CREATE OR REPLACE FUNCTION sitemap_private.sitemap_publication_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,sitemap_private AS $$
BEGIN
  IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'publication row cannot be inserted or deleted'; END IF;
  IF NOT sitemap_private.has_publication_lock() THEN RAISE EXCEPTION 'session publication lock required'; END IF;
  IF NEW.singleton IS DISTINCT FROM OLD.singleton OR NEW.pointer_epoch<>OLD.pointer_epoch+1 THEN
    RAISE EXCEPTION 'pointer epoch must advance exactly once';
  END IF;
  IF NEW.current_generation_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM sitemap_private.generation g WHERE g.generation_id=NEW.current_generation_id
      AND g.state='sealed' AND g.retired_at IS NULL
  ) THEN RAISE EXCEPTION 'pointer target must be a complete active generation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER publication_guard BEFORE INSERT OR UPDATE OR DELETE ON sitemap_private.publication
FOR EACH ROW EXECUTE FUNCTION sitemap_private.sitemap_publication_guard();

CREATE OR REPLACE FUNCTION sitemap_private.sitemap_generation_freeze()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,sitemap_private AS $$
DECLARE v_shards bigint; v_urls bigint; v_bytes bigint; v_manifest bytea; v_current uuid;
BEGIN
  IF NOT sitemap_private.has_publication_lock() THEN RAISE EXCEPTION 'session publication lock required'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'building' THEN RAISE EXCEPTION 'new generations must start building'; END IF;
    RETURN NEW;
  ELSIF TG_OP='DELETE' THEN
    SELECT current_generation_id INTO v_current FROM sitemap_private.publication WHERE singleton;
    IF OLD.generation_id IS NOT DISTINCT FROM v_current THEN RAISE EXCEPTION 'cannot delete current generation'; END IF;
    IF EXISTS(SELECT 1 FROM sitemap_private.shard s WHERE s.generation_id=OLD.generation_id) THEN
      RAISE EXCEPTION 'delete generation shards first';
    END IF;
    IF OLD.state='sealed' AND (OLD.retired_at IS NULL OR OLD.retired_at>=clock_timestamp()-interval '8 days') THEN
      RAISE EXCEPTION 'sealed generation is within retention';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.generation_id IS DISTINCT FROM OLD.generation_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'generation identity is immutable';
  END IF;
  IF OLD.state='sealed' THEN
    IF NEW.state IS DISTINCT FROM OLD.state OR NEW.sealed_at IS DISTINCT FROM OLD.sealed_at
       OR NEW.shard_count IS DISTINCT FROM OLD.shard_count OR NEW.url_count IS DISTINCT FROM OLD.url_count
       OR NEW.compressed_bytes IS DISTINCT FROM OLD.compressed_bytes
       OR NEW.manifest_sha256 IS DISTINCT FROM OLD.manifest_sha256 THEN
      RAISE EXCEPTION 'sealed generation content metadata is immutable';
    END IF;
    IF NEW.retired_at IS DISTINCT FROM OLD.retired_at THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'unsupported no-op generation update';
  END IF;
  IF OLD.state<>'building' OR NEW.state<>'sealed' OR NEW.retired_at IS NOT NULL
     OR NEW.sealed_at IS NULL OR NEW.shard_count IS NULL OR NEW.url_count IS NULL
     OR NEW.compressed_bytes IS NULL OR NEW.manifest_sha256 IS NULL THEN
    RAISE EXCEPTION 'only complete building-to-sealed transition is allowed';
  END IF;
  SELECT count(*),coalesce(sum(url_count),0),coalesce(sum(compressed_bytes),0)
    INTO v_shards,v_urls,v_bytes FROM sitemap_private.shard WHERE generation_id=NEW.generation_id;
  IF v_shards<>NEW.shard_count OR v_urls<>NEW.url_count OR v_bytes<>NEW.compressed_bytes
     OR v_shards=0 OR v_urls=0 OR v_bytes>400000000 THEN
    RAISE EXCEPTION 'generation totals do not match shard rows';
  END IF;
  IF EXISTS (SELECT 1 FROM (SELECT shard_no,row_number() OVER(ORDER BY shard_no)-1 expected_no
      FROM sitemap_private.shard WHERE generation_id=NEW.generation_id) q WHERE q.shard_no<>q.expected_no) THEN
    RAISE EXCEPTION 'shard ordinals must be contiguous';
  END IF;
  SELECT extensions.digest(string_agg(encode(payload_sha256,'hex'),'' ORDER BY shard_no),'sha256')
    INTO v_manifest FROM sitemap_private.shard WHERE generation_id=NEW.generation_id;
  IF v_manifest IS DISTINCT FROM NEW.manifest_sha256 THEN RAISE EXCEPTION 'manifest checksum mismatch'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER generation_freeze BEFORE INSERT OR UPDATE OR DELETE ON sitemap_private.generation
FOR EACH ROW EXECUTE FUNCTION sitemap_private.sitemap_generation_freeze();

CREATE OR REPLACE FUNCTION sitemap_private.sitemap_shard_freeze()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,sitemap_private AS $$
DECLARE v_state text; v_retired timestamptz; v_current uuid; v_total bigint;
BEGIN
  IF NOT sitemap_private.has_publication_lock() THEN RAISE EXCEPTION 'session publication lock required'; END IF;
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'shard rows are immutable'; END IF;
  IF TG_OP='INSERT' THEN
    SELECT state INTO v_state FROM sitemap_private.generation WHERE generation_id=NEW.generation_id;
    IF v_state IS DISTINCT FROM 'building' THEN RAISE EXCEPTION 'shards may only be inserted while building'; END IF;
    IF NEW.payload_sha256 IS DISTINCT FROM extensions.digest(NEW.compressed_payload,'sha256') THEN
      RAISE EXCEPTION 'shard checksum mismatch';
    END IF;
    SELECT coalesce(sum(compressed_bytes),0) INTO v_total FROM sitemap_private.shard;
    IF v_total+octet_length(NEW.compressed_payload)>400000000 THEN
      RAISE EXCEPTION '400000000-byte compressed payload cap exceeded';
    END IF;
    RETURN NEW;
  END IF;
  SELECT current_generation_id INTO v_current FROM sitemap_private.publication WHERE singleton;
  IF OLD.generation_id IS NOT DISTINCT FROM v_current THEN RAISE EXCEPTION 'cannot delete current shard'; END IF;
  SELECT state,retired_at INTO v_state,v_retired FROM sitemap_private.generation WHERE generation_id=OLD.generation_id;
  IF v_state='building' THEN RETURN OLD; END IF;
  IF v_state='sealed' AND v_retired<clock_timestamp()-interval '8 days' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'shard is current or within retention';
END $$;
CREATE TRIGGER shard_freeze BEFORE INSERT OR UPDATE OR DELETE ON sitemap_private.shard
FOR EACH ROW EXECUTE FUNCTION sitemap_private.sitemap_shard_freeze();

-- A building row may exist only inside the same uncommitted publication transaction.
CREATE OR REPLACE FUNCTION sitemap_private.reject_committed_building_generation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,sitemap_private AS $$
DECLARE v_id uuid; v_state text;
BEGIN
  v_id:=CASE WHEN TG_TABLE_NAME='generation' THEN COALESCE(NEW.generation_id,OLD.generation_id)
             ELSE COALESCE(NEW.generation_id,OLD.generation_id) END;
  SELECT state INTO v_state FROM sitemap_private.generation WHERE generation_id=v_id;
  IF v_state='building' THEN RAISE EXCEPTION 'building generation cannot commit'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER reject_building_generation
AFTER INSERT OR UPDATE ON sitemap_private.generation DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION sitemap_private.reject_committed_building_generation();

CREATE OR REPLACE FUNCTION sitemap_private.check_publication_invariant()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,sitemap_private AS $$
DECLARE v_id uuid;
BEGIN
  SELECT current_generation_id INTO v_id FROM sitemap_private.publication WHERE singleton;
  IF v_id IS NULL OR NOT EXISTS(SELECT 1 FROM sitemap_private.generation
      WHERE generation_id=v_id AND state='sealed' AND retired_at IS NULL) THEN
    RAISE EXCEPTION 'pointer must name a sealed active generation';
  END IF;
  IF EXISTS(SELECT 1 FROM sitemap_private.generation
      WHERE state='sealed' AND retired_at IS NULL AND generation_id<>v_id) THEN
    RAISE EXCEPTION 'unpointed sealed generation must be retired';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER publication_invariant_gen AFTER INSERT OR UPDATE OR DELETE
ON sitemap_private.generation DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION sitemap_private.check_publication_invariant();
CREATE CONSTRAINT TRIGGER publication_invariant_ptr AFTER INSERT OR UPDATE OR DELETE
ON sitemap_private.publication DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION sitemap_private.check_publication_invariant();

-- Private-schema RLS is defense in depth; grants remain the primary capability boundary.
ALTER TABLE sitemap_private.generation ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitemap_private.generation FORCE ROW LEVEL SECURITY;
ALTER TABLE sitemap_private.shard ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitemap_private.shard FORCE ROW LEVEL SECURITY;
ALTER TABLE sitemap_private.publication ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitemap_private.publication FORCE ROW LEVEL SECURITY;
CREATE POLICY generation_reader_select ON sitemap_private.generation FOR SELECT TO cth_sitemap_reader USING(state='sealed');
CREATE POLICY generation_publisher_all ON sitemap_private.generation FOR ALL TO cth_sitemap_publisher USING(true) WITH CHECK(true);
CREATE POLICY generation_sweeper_all ON sitemap_private.generation FOR ALL TO cth_sitemap_sweeper USING(true) WITH CHECK(true);
CREATE POLICY shard_reader_select ON sitemap_private.shard FOR SELECT TO cth_sitemap_reader
  USING(EXISTS(SELECT 1 FROM sitemap_private.generation g WHERE g.generation_id=shard.generation_id AND g.state='sealed'));
CREATE POLICY shard_publisher_all ON sitemap_private.shard FOR ALL TO cth_sitemap_publisher USING(true) WITH CHECK(true);
CREATE POLICY shard_sweeper_all ON sitemap_private.shard FOR ALL TO cth_sitemap_sweeper USING(true) WITH CHECK(true);
CREATE POLICY publication_reader_select ON sitemap_private.publication FOR SELECT TO cth_sitemap_reader USING(true);
CREATE POLICY publication_publisher_all ON sitemap_private.publication FOR ALL TO cth_sitemap_publisher USING(true) WITH CHECK(true);
CREATE POLICY publication_sweeper_select ON sitemap_private.publication FOR SELECT TO cth_sitemap_sweeper USING(true);

-- Explicit least-privilege matrix. No PUBLIC or application-wide write grant.
REVOKE ALL ON ALL TABLES IN SCHEMA sitemap_private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sitemap_private FROM PUBLIC;
GRANT USAGE ON SCHEMA sitemap_private TO cth_sitemap_reader,cth_sitemap_publisher,cth_sitemap_sweeper;
GRANT SELECT ON sitemap_private.publication,sitemap_private.generation,sitemap_private.shard
  TO cth_sitemap_reader,cth_sitemap_publisher,cth_sitemap_sweeper;
GRANT INSERT ON sitemap_private.generation,sitemap_private.shard TO cth_sitemap_publisher;
GRANT UPDATE ON sitemap_private.generation,sitemap_private.publication TO cth_sitemap_publisher;
GRANT DELETE ON sitemap_private.generation,sitemap_private.shard TO cth_sitemap_sweeper;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sitemap_private TO cth_sitemap_reader,cth_sitemap_publisher,cth_sitemap_sweeper;
GRANT USAGE ON SCHEMA extensions TO cth_sitemap_reader,cth_sitemap_publisher;
GRANT EXECUTE ON FUNCTION extensions.digest(bytea,text) TO cth_sitemap_reader,cth_sitemap_publisher;
