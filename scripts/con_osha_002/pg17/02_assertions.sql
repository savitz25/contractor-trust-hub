-- CON-OSHA-002 disposable PostgreSQL 17 assertions.
-- Synthetic rows only. This harness does not call the production writer, does
-- not open a Supabase or production connection, and does not change migrations
-- 018, 019, or 020. Counts are the tiny fixture below, not certified totals.
--
-- CA fixture: 2 profiles, 2 inspections, 3 citations, 1 hold, 2 bridges.
-- Citation initial penalties: NULL, 0.00, 15.00.
-- Unrelated FL/NJ fixture: 1 match, 1 inspection, and 1 citation each.

CREATE TABLE pg17_assertion_receipts (
  name TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('PASS', 'FAIL')),
  detail TEXT NOT NULL
);

CREATE FUNCTION pg17_compact(def text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(def, '\s+', '', 'g')
$$;

DO $migration$
DECLARE
  pilot text;
BEGIN
  IF current_database() IS DISTINCT FROM 'cth_osha_pg17_synthetic' THEN
    RAISE EXCEPTION 'unexpected database %', current_database();
  END IF;
  IF current_setting('server_version_num')::int / 10000 <> 17 THEN
    RAISE EXCEPTION 'expected PostgreSQL 17, got %', current_setting('server_version');
  END IF;
  -- A unix socket reports no server address. Loopback is a local process.
  -- GitHub's postgres:17 service container reports its bridge address, which
  -- is private; the workflow still connects only through localhost.
  IF inet_server_addr() IS NOT NULL
     AND inet_server_addr() <> '127.0.0.1'::inet
     AND inet_server_addr() <> '::1'::inet
     AND NOT (inet_server_addr() << '10.0.0.0/8'::inet)
     AND NOT (inet_server_addr() << '172.16.0.0/12'::inet)
     AND NOT (inet_server_addr() << '192.168.0.0/16'::inet) THEN
    RAISE EXCEPTION 'refusing non-local server address %', inet_server_addr();
  END IF;
  IF EXISTS (SELECT 1 FROM pg_foreign_server) OR EXISTS (SELECT 1 FROM pg_subscription) THEN
    RAISE EXCEPTION 'foreign server or subscription is present';
  END IF;
  IF to_regclass('public.osha_expansion_load_receipts') IS NULL
     OR to_regclass('public.contractor_osha_expansion_holds') IS NULL THEN
    RAISE EXCEPTION 'migration 020 tables are missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.contractor_osha_license_matches'::regclass
      AND attname = 'expansion_receipt_id' AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.contractor_osha_license_matches'::regclass
      AND attname = 'osha_matched_activity_nrs' AND NOT attisdropped
  ) OR EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.contractor_osha_license_matches'::regclass
      AND attname = 'receipt_id' AND NOT attisdropped AND attnotnull
  ) THEN
    RAISE EXCEPTION 'migration 020 match columns are missing';
  END IF;
  IF obj_description('public.osha_expansion_load_receipts'::regclass)
       IS DISTINCT FROM 'Per-state CON-OSHA-002 batch owner. One row per expansion state and ingest batch. Not the FL/NJ osha_load_receipts pilot receipt.' THEN
    RAISE EXCEPTION 'migration 020 table comment does not match the migration file';
  END IF;
  SELECT pg17_compact(pg_get_constraintdef(oid)) INTO pilot
  FROM pg_constraint
  WHERE conname = 'osha_load_receipts_pilot_states_check'
    AND conrelid = 'public.osha_load_receipts'::regclass;
  IF pilot IS DISTINCT FROM 'CHECK((pilot_states=''FL,NJ''::text))' THEN
    RAISE EXCEPTION 'pilot_states check changed: %', pilot;
  END IF;
  INSERT INTO pg17_assertion_receipts (name, status, detail)
  VALUES ('migration_020_applies', 'PASS', current_setting('server_version'));
  RAISE NOTICE 'ASSERTION migration_020_applies PASS';
END $migration$;

DO $constraints$
DECLARE
  widened text := 'CHECK((state=ANY(ARRAY[''FL''::bpchar,''NJ''::bpchar,''CA''::bpchar,''VA''::bpchar,''LA''::bpchar,''NV''::bpchar,''AZ''::bpchar,''TN''::bpchar])))';
  expansion text := 'CHECK((state=ANY(ARRAY[''CA''::bpchar,''VA''::bpchar,''LA''::bpchar,''NV''::bpchar,''AZ''::bpchar,''TN''::bpchar])))';
  owner text := 'CHECK((((state=ANY(ARRAY[''FL''::bpchar,''NJ''::bpchar]))AND(receipt_idISNOTNULL)AND(expansion_receipt_idISNULL))OR((state=ANY(ARRAY[''CA''::bpchar,''VA''::bpchar,''LA''::bpchar,''NV''::bpchar,''AZ''::bpchar,''TN''::bpchar]))AND(receipt_idISNULL)AND(expansion_receipt_idISNOTNULL))))';
  name text;
  got text;
  rejected text;
  st text;
  receipt uuid;
  contractor uuid;
  probe_batch uuid := '44444444-4444-4444-8444-444444444444';
  pkg text := 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
BEGIN
  FOREACH name IN ARRAY ARRAY[
    'contractor_osha_license_matches_state_check',
    'contractor_osha_identity_review_state_check',
    'contractor_osha_inspections_state_check',
    'contractor_osha_match_inspections_state_check'
  ] LOOP
    SELECT pg17_compact(pg_get_constraintdef(oid)) INTO got
    FROM pg_constraint
    WHERE conname = name AND contype = 'c';
    IF got IS DISTINCT FROM widened THEN
      RAISE EXCEPTION '% is not the exact widened state check: %', name, got;
    END IF;
  END LOOP;

  FOREACH name IN ARRAY ARRAY[
    'osha_expansion_load_receipts_state_check',
    'contractor_osha_expansion_holds_state_check'
  ] LOOP
    SELECT pg17_compact(pg_get_constraintdef(oid)) INTO got
    FROM pg_constraint
    WHERE conname = name AND contype = 'c';
    IF got IS DISTINCT FROM expansion THEN
      RAISE EXCEPTION '% is not the exact expansion state check: %', name, got;
    END IF;
  END LOOP;

  FOREACH name IN ARRAY ARRAY[
    'contractor_osha_license_matches_receipt_owner',
    'contractor_osha_identity_review_receipt_owner'
  ] LOOP
    SELECT pg17_compact(pg_get_constraintdef(oid)) INTO got
    FROM pg_constraint
    WHERE conname = name AND contype = 'c';
    IF got IS DISTINCT FROM owner THEN
      RAISE EXCEPTION '% changed: %', name, got;
    END IF;
  END LOOP;

  IF (
    SELECT count(*) FROM pg_constraint
    WHERE contype = 'f'
      AND pg_get_constraintdef(oid) LIKE '%osha_expansion_load_receipts%'
      AND pg_get_constraintdef(oid) LIKE '%ON DELETE RESTRICT%'
  ) <> 3 THEN
    RAISE EXCEPTION 'expected three RESTRICT foreign keys to expansion receipts';
  END IF;

  FOREACH rejected IN ARRAY ARRAY['MA', 'GA', 'OH', 'NC'] LOOP
    BEGIN
      INSERT INTO ingest_batches (id, source_system, source_dataset, checksum_sha256)
      VALUES (gen_random_uuid(), 'us_dol_osha_expansion', 'synthetic:reject', pkg);
      INSERT INTO osha_expansion_load_receipts (
        state, ingest_batch_id, b2_source_system, b2_package_sha256,
        public_profile_count, inspection_count, citation_count,
        ambiguous_activity_count, missing_citation_context_count, held_row_count
      )
      SELECT rejected, id, 'synthetic_probe', pkg, 0, 0, 0, 0, 0, 0
      FROM ingest_batches WHERE source_dataset = 'synthetic:reject';
      RAISE EXCEPTION '% was accepted as an expansion state', rejected;
    EXCEPTION
      WHEN check_violation THEN
        NULL;
    END;
  END LOOP;

  BEGIN
    INSERT INTO contractors (id, display_name)
    VALUES (gen_random_uuid(), 'Synthetic FK child');
    INSERT INTO ingest_batches (id, source_system, source_dataset, checksum_sha256)
    VALUES ('44444444-4444-4444-8444-444444444445', 'us_dol_osha_expansion', 'synthetic:fk', pkg);
    INSERT INTO contractor_osha_license_matches (
      contractor_id, license_key, state, match_tier, source_system, source_dataset,
      ingest_batch_id, receipt_id, expansion_receipt_id,
      n_inspections, n_citation_items, n_serious, n_willful_repeat,
      initial_penalty_amount, current_penalty_amount, n_with_final_order, n_contested,
      source_observed_on
    )
    SELECT id, 'SYN-FK', 'CA', 'exact', 'us_dol_osha', 'synthetic:fk',
      '44444444-4444-4444-8444-444444444445', NULL, '44444444-4444-4444-8444-444444444446',
      0, 0, 0, 0, 0, 0, 0, 0, DATE '2026-01-15'
    FROM contractors WHERE display_name = 'Synthetic FK child';
    RAISE EXCEPTION 'missing expansion receipt was accepted';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  BEGIN
    INSERT INTO contractors (id, display_name)
    VALUES (gen_random_uuid(), 'Synthetic restrict child');
    INSERT INTO ingest_batches (id, source_system, source_dataset, checksum_sha256)
    VALUES ('44444444-4444-4444-8444-444444444447', 'us_dol_osha_expansion', 'synthetic:restrict', pkg);
    INSERT INTO osha_expansion_load_receipts (
      id, state, ingest_batch_id, b2_source_system, b2_package_sha256,
      public_profile_count, inspection_count, citation_count,
      ambiguous_activity_count, missing_citation_context_count, held_row_count
    ) VALUES (
      '44444444-4444-4444-8444-444444444448', 'VA', '44444444-4444-4444-8444-444444444447',
      'synthetic_probe', pkg, 0, 0, 0, 0, 0, 0
    );
    INSERT INTO contractor_osha_license_matches (
      contractor_id, license_key, state, match_tier, source_system, source_dataset,
      ingest_batch_id, receipt_id, expansion_receipt_id,
      n_inspections, n_citation_items, n_serious, n_willful_repeat,
      initial_penalty_amount, current_penalty_amount, n_with_final_order, n_contested,
      source_observed_on
    )
    SELECT id, 'SYN-RESTRICT', 'VA', 'strong', 'us_dol_osha', 'synthetic:restrict',
      '44444444-4444-4444-8444-444444444447', NULL, '44444444-4444-4444-8444-444444444448',
      0, 0, 0, 0, 0, 0, 0, 0, DATE '2026-01-15'
    FROM contractors WHERE display_name = 'Synthetic restrict child';
    DELETE FROM osha_expansion_load_receipts WHERE id = '44444444-4444-4444-8444-444444444448';
    RAISE EXCEPTION 'ON DELETE RESTRICT was not enforced';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  BEGIN
    INSERT INTO ingest_batches (id, source_system, source_dataset, checksum_sha256)
    VALUES ('44444444-4444-4444-8444-444444444449', 'us_dol_osha_expansion', 'synthetic:citation-fk', pkg);
    INSERT INTO osha_detail_load_receipts (
      id, source_batch_id, source_dataset, source_hash, inspection_rows, citation_rows
    ) VALUES (
      '44444444-4444-4444-8444-44444444444a', '44444444-4444-4444-8444-444444444449',
      'synthetic:citation-fk', pkg, 0, 0
    );
    INSERT INTO contractor_osha_citations (
      inspection_id, activity_nr, citation_id, standard, viol_type,
      source_batch_id, receipt_id, source_hash
    ) VALUES (
      '44444444-4444-4444-8444-44444444444b', 'SYN-MISSING', 'SYN-C-FK', 'SYN-STANDARD', 'O',
      '44444444-4444-4444-8444-444444444449', '44444444-4444-4444-8444-44444444444a', pkg
    );
    RAISE EXCEPTION 'citation inspection foreign key was not enforced';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  BEGIN
    INSERT INTO ingest_batches (id, source_system, source_dataset, checksum_sha256)
    VALUES ('44444444-4444-4444-8444-44444444444c', 'us_dol_osha_expansion', 'synthetic:hold-fk', pkg);
    INSERT INTO contractor_osha_expansion_holds (
      state, license_key, hold_reason, expansion_receipt_id, ingest_batch_id
    ) VALUES (
      'CA', 'SYN-HOLD-FK', 'weak', '44444444-4444-4444-8444-44444444444d',
      '44444444-4444-4444-8444-44444444444c'
    );
    RAISE EXCEPTION 'hold foreign key was not enforced';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  BEGIN
    INSERT INTO ingest_batches (id, source_system, source_dataset, checksum_sha256)
    VALUES (probe_batch, 'us_dol_osha_expansion', 'synthetic:probe', pkg);
    FOREACH st IN ARRAY ARRAY['CA', 'VA', 'LA', 'NV', 'AZ', 'TN'] LOOP
      INSERT INTO contractors (id, display_name)
      VALUES (gen_random_uuid(), 'Synthetic probe ' || st)
      RETURNING id INTO contractor;
      INSERT INTO osha_expansion_load_receipts (
        state, ingest_batch_id, b2_source_system, b2_package_sha256, ca_name_source,
        public_profile_count, inspection_count, citation_count,
        ambiguous_activity_count, missing_citation_context_count, held_row_count,
        source_zip_sha256
      ) VALUES (
        st, probe_batch, 'synthetic_probe', pkg,
        CASE WHEN st = 'CA' THEN 'licensee_name_raw' ELSE NULL END,
        0, 0, 0, 0, 0, 0, ARRAY[]::text[]
      ) RETURNING id INTO receipt;
      INSERT INTO contractor_osha_license_matches (
        contractor_id, license_key, state, match_tier, source_system, source_dataset,
        ingest_batch_id, receipt_id, expansion_receipt_id,
        n_inspections, n_citation_items, n_serious, n_willful_repeat,
        initial_penalty_amount, current_penalty_amount, n_with_final_order, n_contested,
        source_observed_on
      ) VALUES (
        contractor, 'SYN-PROBE-' || st, st, 'exact', 'us_dol_osha', 'synthetic:probe',
        probe_batch, NULL, receipt,
        0, 0, 0, 0, 0, 0, 0, 0, DATE '2026-01-15'
      );
    END LOOP;
    IF (SELECT count(*) FROM contractor_osha_license_matches WHERE ingest_batch_id = probe_batch) <> 6 THEN
      RAISE EXCEPTION 'six expansion states were not all accepted';
    END IF;
    IF (
      SELECT count(DISTINCT state) FROM contractor_osha_license_matches
      WHERE ingest_batch_id = probe_batch
        AND state IN ('CA', 'VA', 'LA', 'NV', 'AZ', 'TN')
    ) <> 6 THEN
      RAISE EXCEPTION 'accepted states were not exactly CA,VA,LA,NV,AZ,TN';
    END IF;
    RAISE EXCEPTION 'roll back six-state probe';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'roll back six-state probe' THEN
        RAISE;
      END IF;
  END;

  IF EXISTS (SELECT 1 FROM ingest_batches WHERE source_dataset LIKE 'synthetic:%') THEN
    RAISE EXCEPTION 'constraint probe leaked rows';
  END IF;
  IF EXISTS (SELECT 1 FROM contractors WHERE display_name LIKE 'Synthetic %') THEN
    RAISE EXCEPTION 'constraint probe leaked contractors';
  END IF;

  INSERT INTO pg17_assertion_receipts (name, status, detail)
  VALUES ('state_constraints_and_foreign_keys', 'PASS', 'CA,VA,LA,NV,AZ,TN checks and RESTRICT foreign keys');
  RAISE NOTICE 'ASSERTION state_constraints_and_foreign_keys PASS';
END $constraints$;

INSERT INTO contractors (id, display_name) VALUES
  ('11111111-1111-4111-8111-1111111111f1', 'Synthetic FL Profile'),
  ('11111111-1111-4111-8111-1111111111e1', 'Synthetic NJ Profile'),
  ('22222222-2222-4222-8222-2222222222a1', 'Synthetic CA Profile A'),
  ('22222222-2222-4222-8222-2222222222a2', 'Synthetic CA Profile B');

INSERT INTO ingest_batches (id, source_system, source_dataset, checksum_sha256) VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'us_dol_osha',
    'synthetic:fl-nj',
    'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
  );

INSERT INTO osha_load_receipts (
  id, ingest_batch_id, source_system, source_dataset, source_domain, package_sha256,
  pilot_states, fl_source_rows, nj_source_rows, fl_exact, fl_strong, fl_weak,
  nj_exact, nj_strong, nj_weak, public_rows_inserted, review_rows_inserted,
  skipped_no_profile, status
) VALUES (
  '11111111-1111-4111-8111-111111111112',
  '11111111-1111-4111-8111-111111111111',
  'us_dol_osha', 'synthetic:fl-nj', 'data.dol.gov',
  'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
  'FL,NJ', 1, 1, 1, 0, 0, 0, 1, 0, 2, 0, 0, 'loaded'
);

INSERT INTO contractor_osha_license_matches (
  id, contractor_id, license_key, state, match_tier, source_system, source_dataset,
  ingest_batch_id, receipt_id, expansion_receipt_id, n_inspections,
  n_citation_items, n_serious, n_willful_repeat, initial_penalty_amount,
  current_penalty_amount, n_with_final_order, n_contested, osha_activity_nrs,
  source_observed_on
) VALUES
  (
    '11111111-1111-4111-8111-1111111111f2',
    '11111111-1111-4111-8111-1111111111f1',
    'SYN-FL-001', 'FL', 'exact', 'us_dol_osha', 'synthetic:fl-nj',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111112', NULL,
    1, 1, 0, 0, 7, 7, 0, 0, 'SYN-FL-ACT-1', DATE '2026-01-15'
  ),
  (
    '11111111-1111-4111-8111-1111111111e2',
    '11111111-1111-4111-8111-1111111111e1',
    'SYN-NJ-001', 'NJ', 'strong', 'us_dol_osha', 'synthetic:fl-nj',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111112', NULL,
    1, 1, 0, 0, 0, 0, 0, 0, 'SYN-NJ-ACT-1', DATE '2026-01-15'
  );

INSERT INTO osha_detail_load_receipts (
  id, source_batch_id, source_dataset, source_hash, inspection_rows, loadable_citation_rows, citation_rows, status
) VALUES
  (
    '11111111-1111-4111-8111-1111111111f3',
    '11111111-1111-4111-8111-111111111111',
    'synthetic:fl:inspections',
    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    1, 1, 1, 'loaded'
  ),
  (
    '11111111-1111-4111-8111-1111111111e3',
    '11111111-1111-4111-8111-111111111111',
    'synthetic:nj:inspections',
    'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    1, 1, 1, 'loaded'
  );

INSERT INTO contractor_osha_inspections (
  id, activity_nr, state, open_date, site_city, site_state, source_batch_id, receipt_id, source_hash
) VALUES
  (
    '11111111-1111-4111-8111-1111111111f4', 'SYN-FL-ACT-1', 'FL', DATE '2026-01-03',
    'Synthetic City', 'FL', '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-1111111111f3',
    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  ),
  (
    '11111111-1111-4111-8111-1111111111e4', 'SYN-NJ-ACT-1', 'NJ', DATE '2026-01-04',
    'Synthetic City', 'NJ', '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-1111111111e3',
    'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
  );

INSERT INTO contractor_osha_citations (
  id, inspection_id, activity_nr, citation_id, standard, viol_type,
  current_penalty, initial_penalty, source_batch_id, receipt_id, source_hash
) VALUES
  (
    '11111111-1111-4111-8111-1111111111f5',
    '11111111-1111-4111-8111-1111111111f4',
    'SYN-FL-ACT-1', 'SYN-FL-C-1', 'SYN-STANDARD', 'S',
    7.00, 7.00, '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-1111111111f3',
    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  ),
  (
    '11111111-1111-4111-8111-1111111111e5',
    '11111111-1111-4111-8111-1111111111e4',
    'SYN-NJ-ACT-1', 'SYN-NJ-C-1', 'SYN-STANDARD', 'O',
    NULL, NULL, '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-1111111111e3',
    'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
  );

INSERT INTO contractor_osha_match_inspections (
  public_match_id, contractor_id, state, license_key, inspection_id, activity_nr,
  source_batch_id, receipt_id, source_hash
) VALUES
  (
    '11111111-1111-4111-8111-1111111111f2',
    '11111111-1111-4111-8111-1111111111f1',
    'FL', 'SYN-FL-001',
    '11111111-1111-4111-8111-1111111111f4', 'SYN-FL-ACT-1',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-1111111111f3',
    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  ),
  (
    '11111111-1111-4111-8111-1111111111e2',
    '11111111-1111-4111-8111-1111111111e1',
    'NJ', 'SYN-NJ-001',
    '11111111-1111-4111-8111-1111111111e4', 'SYN-NJ-ACT-1',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-1111111111e3',
    'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
  );

CREATE FUNCTION pg17_apply_ca_fixture() RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  inserted integer := 0;
  ca_batch uuid := '22222222-2222-4222-8222-222222222222';
  ca_a uuid := '22222222-2222-4222-8222-2222222222a1';
  ca_b uuid := '22222222-2222-4222-8222-2222222222a2';
  pkg text := 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  insp_hash text := 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  cit_hash text := 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
  zip1 text := 'a9f2f405ae4b9bc62d0f8c6538c5aaea54c54ff8d9c151398c9d310f56e32aeb';
  zip2 text := 'dbaaeeb6986908645567dca8f3cd26ea5a71f838296f3e2dd20385ef3ed1ba45';
  expansion_receipt uuid;
  inspection_receipt uuid;
  citation_receipt uuid;
  match_a uuid;
  match_b uuid;
  inspection_a uuid;
  inspection_b uuid;
  row_id uuid;
BEGIN
  IF pkg = '6c914c00d643f368c72de339bd4bb34b4cd5e9eaa3010b4a4c5fecef9e573539' THEN
    RAISE EXCEPTION 'synthetic package hash collided with the certified CA package';
  END IF;

  expansion_receipt := NULL;
  INSERT INTO ingest_batches (id, source_system, source_dataset, checksum_sha256)
  VALUES (ca_batch, 'us_dol_osha_expansion', 'con-osha-002:CA', pkg)
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO row_id;
  IF row_id IS NOT NULL THEN
    inserted := inserted + 1;
  END IF;

  INSERT INTO osha_expansion_load_receipts (
    state, ingest_batch_id, b2_source_system, b2_package_sha256, ca_name_source,
    public_profile_count, inspection_count, citation_count, ambiguous_activity_count,
    missing_citation_context_count, held_row_count, source_zip_sha256, status
  ) VALUES (
    'CA', ca_batch, 'ca_cslb', pkg, 'licensee_name_raw',
    2, 2, 3, 0, 0, 1, ARRAY[zip1, zip2]::text[], 'loaded'
  )
  ON CONFLICT (state, ingest_batch_id) DO NOTHING
  RETURNING id INTO expansion_receipt;
  IF expansion_receipt IS NULL THEN
    SELECT id INTO expansion_receipt
    FROM osha_expansion_load_receipts
    WHERE state = 'CA' AND ingest_batch_id = ca_batch;
  ELSE
    inserted := inserted + 1;
  END IF;

  match_a := NULL;
  INSERT INTO contractor_osha_license_matches (
    contractor_id, license_key, state, match_tier, source_system, source_dataset,
    ingest_batch_id, receipt_id, expansion_receipt_id, n_inspections, first_open, last_open,
    n_citation_items, n_serious, n_willful_repeat, initial_penalty_amount, current_penalty_amount,
    n_with_final_order, n_contested, osha_activity_nrs, osha_matched_activity_nrs, source_observed_on
  ) VALUES (
    ca_a, 'SYN-CA-001', 'CA', 'exact', 'us_dol_osha', 'con-osha-002:CA',
    ca_batch, NULL, expansion_receipt, 1, DATE '2026-01-02', DATE '2026-01-02',
    2, 0, 0, 0, 0, 0, 0, 'SYN-ACT-1001', 'SYN-ACT-1001', DATE '2026-01-15'
  )
  ON CONFLICT ON CONSTRAINT contractor_osha_license_matches_idem DO NOTHING
  RETURNING id INTO match_a;
  IF match_a IS NULL THEN
    SELECT id INTO match_a FROM contractor_osha_license_matches
    WHERE state = 'CA' AND license_key = 'SYN-CA-001' AND ingest_batch_id = ca_batch;
  ELSE
    inserted := inserted + 1;
  END IF;

  match_b := NULL;
  INSERT INTO contractor_osha_license_matches (
    contractor_id, license_key, state, match_tier, source_system, source_dataset,
    ingest_batch_id, receipt_id, expansion_receipt_id, n_inspections, first_open, last_open,
    n_citation_items, n_serious, n_willful_repeat, initial_penalty_amount, current_penalty_amount,
    n_with_final_order, n_contested, osha_activity_nrs, osha_matched_activity_nrs, source_observed_on
  ) VALUES (
    ca_b, 'SYN-CA-002', 'CA', 'strong', 'us_dol_osha', 'con-osha-002:CA',
    ca_batch, NULL, expansion_receipt, 1, DATE '2026-01-05', DATE '2026-01-05',
    1, 1, 0, 15, 15, 0, 0, 'SYN-ACT-1002', 'SYN-ACT-1002', DATE '2026-01-15'
  )
  ON CONFLICT ON CONSTRAINT contractor_osha_license_matches_idem DO NOTHING
  RETURNING id INTO match_b;
  IF match_b IS NULL THEN
    SELECT id INTO match_b FROM contractor_osha_license_matches
    WHERE state = 'CA' AND license_key = 'SYN-CA-002' AND ingest_batch_id = ca_batch;
  ELSE
    inserted := inserted + 1;
  END IF;

  row_id := NULL;
  INSERT INTO contractor_osha_expansion_holds (
    state, license_key, contractor_id, activity_nr, citation_id, hold_reason,
    expansion_receipt_id, ingest_batch_id
  ) VALUES (
    'CA', 'SYN-CA-HELD', NULL, NULL, NULL, 'weak', expansion_receipt, ca_batch
  )
  ON CONFLICT (
    state, license_key, COALESCE(activity_nr, ''), COALESCE(citation_id, ''), hold_reason, ingest_batch_id
  ) DO NOTHING
  RETURNING id INTO row_id;
  IF row_id IS NOT NULL THEN
    inserted := inserted + 1;
  END IF;

  inspection_receipt := NULL;
  INSERT INTO osha_detail_load_receipts (
    source_batch_id, source_dataset, source_hash, inspection_rows, loadable_citation_rows, citation_rows, status
  ) VALUES (
    ca_batch, 'con-osha-002:CA:inspections', insp_hash, 2, 0, 0, 'loaded'
  )
  ON CONFLICT (source_batch_id, source_dataset, source_hash) DO NOTHING
  RETURNING id INTO inspection_receipt;
  IF inspection_receipt IS NULL THEN
    SELECT id INTO inspection_receipt FROM osha_detail_load_receipts
    WHERE source_batch_id = ca_batch AND source_dataset = 'con-osha-002:CA:inspections';
  ELSE
    inserted := inserted + 1;
  END IF;

  citation_receipt := NULL;
  INSERT INTO osha_detail_load_receipts (
    source_batch_id, source_dataset, source_hash, inspection_rows, loadable_citation_rows, citation_rows, status
  ) VALUES (
    ca_batch, 'con-osha-002:CA:citations', cit_hash, 0, 3, 3, 'loaded'
  )
  ON CONFLICT (source_batch_id, source_dataset, source_hash) DO NOTHING
  RETURNING id INTO citation_receipt;
  IF citation_receipt IS NULL THEN
    SELECT id INTO citation_receipt FROM osha_detail_load_receipts
    WHERE source_batch_id = ca_batch AND source_dataset = 'con-osha-002:CA:citations';
  ELSE
    inserted := inserted + 1;
  END IF;
  IF inspection_receipt IS NULL OR citation_receipt IS NULL OR inspection_receipt = citation_receipt THEN
    RAISE EXCEPTION 'citation receipt must be distinct from the inspection receipt';
  END IF;

  inspection_a := NULL;
  INSERT INTO contractor_osha_inspections (
    activity_nr, state, open_date, site_city, site_state, inspection_type,
    close_date, closing_conference_date, citations_verified,
    source_batch_id, receipt_id, source_hash
  ) VALUES (
    'SYN-ACT-1001', 'CA', DATE '2026-01-02', 'Synthetic City', 'CA', NULL,
    NULL, NULL, TRUE, ca_batch, inspection_receipt, insp_hash
  )
  ON CONFLICT (activity_nr) DO NOTHING
  RETURNING id INTO inspection_a;
  IF inspection_a IS NULL THEN
    SELECT id INTO inspection_a FROM contractor_osha_inspections WHERE activity_nr = 'SYN-ACT-1001';
  ELSE
    inserted := inserted + 1;
  END IF;

  inspection_b := NULL;
  INSERT INTO contractor_osha_inspections (
    activity_nr, state, open_date, site_city, site_state, inspection_type,
    close_date, closing_conference_date, citations_verified,
    source_batch_id, receipt_id, source_hash
  ) VALUES (
    'SYN-ACT-1002', 'CA', DATE '2026-01-05', 'Synthetic City', 'CA', NULL,
    NULL, NULL, FALSE, ca_batch, inspection_receipt, insp_hash
  )
  ON CONFLICT (activity_nr) DO NOTHING
  RETURNING id INTO inspection_b;
  IF inspection_b IS NULL THEN
    SELECT id INTO inspection_b FROM contractor_osha_inspections WHERE activity_nr = 'SYN-ACT-1002';
  ELSE
    inserted := inserted + 1;
  END IF;

  row_id := NULL;
  INSERT INTO contractor_osha_citations (
    inspection_id, activity_nr, citation_id, standard, viol_type,
    current_penalty, initial_penalty, contest_date, final_order_date, delete_flag,
    source_batch_id, receipt_id, source_hash
  ) VALUES (
    inspection_a, 'SYN-ACT-1001', 'SYN-C-NULL', 'SYN-STANDARD', 'O',
    NULL, NULL, NULL, NULL, NULL, ca_batch, citation_receipt, cit_hash
  )
  ON CONFLICT (inspection_id, citation_id) DO NOTHING
  RETURNING id INTO row_id;
  IF row_id IS NOT NULL THEN inserted := inserted + 1; END IF;

  row_id := NULL;
  INSERT INTO contractor_osha_citations (
    inspection_id, activity_nr, citation_id, standard, viol_type,
    current_penalty, initial_penalty, contest_date, final_order_date, delete_flag,
    source_batch_id, receipt_id, source_hash
  ) VALUES (
    inspection_a, 'SYN-ACT-1001', 'SYN-C-ZERO', 'SYN-STANDARD', 'O',
    0.00, 0.00, NULL, NULL, NULL, ca_batch, citation_receipt, cit_hash
  )
  ON CONFLICT (inspection_id, citation_id) DO NOTHING
  RETURNING id INTO row_id;
  IF row_id IS NOT NULL THEN inserted := inserted + 1; END IF;

  row_id := NULL;
  INSERT INTO contractor_osha_citations (
    inspection_id, activity_nr, citation_id, standard, viol_type,
    current_penalty, initial_penalty, contest_date, final_order_date, delete_flag,
    source_batch_id, receipt_id, source_hash
  ) VALUES (
    inspection_b, 'SYN-ACT-1002', 'SYN-C-POS', 'SYN-STANDARD', 'S',
    15.00, 15.00, NULL, NULL, NULL, ca_batch, citation_receipt, cit_hash
  )
  ON CONFLICT (inspection_id, citation_id) DO NOTHING
  RETURNING id INTO row_id;
  IF row_id IS NOT NULL THEN inserted := inserted + 1; END IF;

  row_id := NULL;
  INSERT INTO contractor_osha_match_inspections (
    public_match_id, contractor_id, state, license_key, inspection_id, activity_nr,
    source_batch_id, receipt_id, source_hash
  ) VALUES (
    match_a, ca_a, 'CA', 'SYN-CA-001', inspection_a, 'SYN-ACT-1001',
    ca_batch, inspection_receipt, insp_hash
  )
  ON CONFLICT (public_match_id, inspection_id) DO NOTHING
  RETURNING public_match_id INTO row_id;
  IF row_id IS NOT NULL THEN inserted := inserted + 1; END IF;

  row_id := NULL;
  INSERT INTO contractor_osha_match_inspections (
    public_match_id, contractor_id, state, license_key, inspection_id, activity_nr,
    source_batch_id, receipt_id, source_hash
  ) VALUES (
    match_b, ca_b, 'CA', 'SYN-CA-002', inspection_b, 'SYN-ACT-1002',
    ca_batch, inspection_receipt, insp_hash
  )
  ON CONFLICT (public_match_id, inspection_id) DO NOTHING
  RETURNING public_match_id INTO row_id;
  IF row_id IS NOT NULL THEN inserted := inserted + 1; END IF;

  RETURN inserted;
END $fn$;

DO $load$
DECLARE
  inserted integer;
BEGIN
  inserted := pg17_apply_ca_fixture();
  IF inserted <> 14 THEN
    RAISE EXCEPTION 'first synthetic execution inserted % rows, expected 14', inserted;
  END IF;
END $load$;

DO $receipts$
DECLARE
  inspection_receipt uuid;
  citation_receipt uuid;
  inspection_dataset text;
  citation_dataset text;
BEGIN
  SELECT id, source_dataset INTO inspection_receipt, inspection_dataset
  FROM osha_detail_load_receipts
  WHERE source_batch_id = '22222222-2222-4222-8222-222222222222'
    AND source_dataset = 'con-osha-002:CA:inspections';
  SELECT id, source_dataset INTO citation_receipt, citation_dataset
  FROM osha_detail_load_receipts
  WHERE source_batch_id = '22222222-2222-4222-8222-222222222222'
    AND source_dataset = 'con-osha-002:CA:citations';
  IF inspection_receipt IS NULL OR citation_receipt IS NULL OR inspection_receipt = citation_receipt THEN
    RAISE EXCEPTION 'inspection and citation receipts are not separate';
  END IF;
  IF inspection_dataset = citation_dataset THEN
    RAISE EXCEPTION 'inspection and citation receipts share a source dataset';
  END IF;
  IF (
    SELECT count(DISTINCT receipt_id) FROM contractor_osha_inspections
    WHERE activity_nr IN ('SYN-ACT-1001', 'SYN-ACT-1002')
  ) <> 1
  OR EXISTS (
    SELECT 1 FROM contractor_osha_inspections
    WHERE activity_nr IN ('SYN-ACT-1001', 'SYN-ACT-1002')
      AND receipt_id IS DISTINCT FROM inspection_receipt
  ) THEN
    RAISE EXCEPTION 'inspection rows do not use only the inspection receipt';
  END IF;
  IF (
    SELECT count(*) FROM contractor_osha_citations
    WHERE citation_id IN ('SYN-C-NULL', 'SYN-C-ZERO', 'SYN-C-POS')
      AND receipt_id = citation_receipt
  ) <> 3
  OR EXISTS (
    SELECT 1 FROM contractor_osha_citations
    WHERE citation_id IN ('SYN-C-NULL', 'SYN-C-ZERO', 'SYN-C-POS')
      AND receipt_id = inspection_receipt
  ) THEN
    RAISE EXCEPTION 'a citation row uses the inspection receipt';
  END IF;
  IF EXISTS (
    SELECT 1 FROM contractor_osha_match_inspections
    WHERE source_batch_id = '22222222-2222-4222-8222-222222222222'
      AND receipt_id IS DISTINCT FROM inspection_receipt
  ) THEN
    RAISE EXCEPTION 'a bridge uses the citation receipt';
  END IF;
  INSERT INTO pg17_assertion_receipts (name, status, detail)
  VALUES (
    'inspection_citation_receipts_separate',
    'PASS',
    inspection_receipt::text || ' inspections; ' || citation_receipt::text || ' citations'
  );
  RAISE NOTICE 'ASSERTION inspection_citation_receipts_separate PASS';
END $receipts$;

DO $penalties$
DECLARE
  null_count integer;
  zero_count integer;
  positive_count integer;
  zero_value numeric;
  positive_value numeric;
BEGIN
  SELECT
    count(*) FILTER (WHERE initial_penalty IS NULL),
    count(*) FILTER (WHERE initial_penalty IS NOT NULL AND initial_penalty = 0),
    count(*) FILTER (WHERE initial_penalty > 0),
    min(initial_penalty) FILTER (WHERE citation_id = 'SYN-C-ZERO'),
    min(initial_penalty) FILTER (WHERE citation_id = 'SYN-C-POS')
  INTO null_count, zero_count, positive_count, zero_value, positive_value
  FROM contractor_osha_citations
  WHERE citation_id IN ('SYN-C-NULL', 'SYN-C-ZERO', 'SYN-C-POS');
  IF null_count <> 1 OR zero_count <> 1 OR positive_count <> 1 THEN
    RAISE EXCEPTION 'initial penalties were not preserved as NULL, zero, and positive (% / % / %)',
      null_count, zero_count, positive_count;
  END IF;
  IF zero_value IS NULL OR zero_value <> 0.00 OR positive_value <> 15.00 THEN
    RAISE EXCEPTION 'stored initial penalties were % and %', zero_value, positive_value;
  END IF;
  INSERT INTO pg17_assertion_receipts (name, status, detail)
  VALUES ('initial_penalties_null_zero_positive', 'PASS', 'NULL, 0.00, 15.00');
  RAISE NOTICE 'ASSERTION initial_penalties_null_zero_positive PASS';
END $penalties$;

DO $hashes$
DECLARE
  stored text[];
  zip1 text := 'a9f2f405ae4b9bc62d0f8c6538c5aaea54c54ff8d9c151398c9d310f56e32aeb';
  zip2 text := 'dbaaeeb6986908645567dca8f3cd26ea5a71f838296f3e2dd20385ef3ed1ba45';
BEGIN
  SELECT source_zip_sha256 INTO stored
  FROM osha_expansion_load_receipts
  WHERE state = 'CA' AND ingest_batch_id = '22222222-2222-4222-8222-222222222222';
  IF stored IS DISTINCT FROM ARRAY[zip1, zip2]::text[] THEN
    RAISE EXCEPTION 'source ZIP hashes were not persisted in order: %', stored;
  END IF;
  IF cardinality(stored) <> 2
     OR stored[1] !~ '^[0-9a-f]{64}$'
     OR stored[2] !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'persisted ZIP hashes are not two sha256 digests';
  END IF;
  INSERT INTO pg17_assertion_receipts (name, status, detail)
  VALUES ('source_zip_hashes_persisted', 'PASS', array_to_string(stored, ','));
  RAISE NOTICE 'ASSERTION source_zip_hashes_persisted PASS';
END $hashes$;

DO $counts$
DECLARE
  profiles integer;
  inspections integer;
  citations integer;
  holds integer;
  bridges integer;
  receipt_profiles integer;
  receipt_inspections integer;
  receipt_citations integer;
  receipt_holds integer;
BEGIN
  SELECT count(*) INTO profiles FROM contractor_osha_license_matches
  WHERE state = 'CA' AND ingest_batch_id = '22222222-2222-4222-8222-222222222222';
  SELECT count(*) INTO inspections FROM contractor_osha_inspections
  WHERE state = 'CA' AND source_batch_id = '22222222-2222-4222-8222-222222222222';
  SELECT count(*) INTO citations FROM contractor_osha_citations
  WHERE source_batch_id = '22222222-2222-4222-8222-222222222222';
  SELECT count(*) INTO holds FROM contractor_osha_expansion_holds
  WHERE state = 'CA' AND ingest_batch_id = '22222222-2222-4222-8222-222222222222';
  SELECT count(*) INTO bridges FROM contractor_osha_match_inspections
  WHERE state = 'CA' AND source_batch_id = '22222222-2222-4222-8222-222222222222';
  SELECT public_profile_count, inspection_count, citation_count, held_row_count
  INTO receipt_profiles, receipt_inspections, receipt_citations, receipt_holds
  FROM osha_expansion_load_receipts
  WHERE state = 'CA' AND ingest_batch_id = '22222222-2222-4222-8222-222222222222';
  IF (profiles, inspections, citations, holds, bridges) IS DISTINCT FROM (2, 2, 3, 1, 2) THEN
    RAISE EXCEPTION 'table counts % % % % % did not match the synthetic fixture',
      profiles, inspections, citations, holds, bridges;
  END IF;
  IF (receipt_profiles, receipt_inspections, receipt_citations, receipt_holds)
       IS DISTINCT FROM (profiles, inspections, citations, holds) THEN
    RAISE EXCEPTION 'receipt counts do not reconcile to inserted rows';
  END IF;
  IF profiles = 1706 OR inspections = 2615 OR citations = 6903 THEN
    RAISE EXCEPTION 'synthetic fixture collided with certified CA totals';
  END IF;
  INSERT INTO pg17_assertion_receipts (name, status, detail)
  VALUES (
    'synthetic_fixture_counts',
    'PASS',
    'profiles=2 inspections=2 citations=3 holds=1 bridges=2'
  );
  RAISE NOTICE 'ASSERTION synthetic_fixture_counts PASS profiles=2 inspections=2 citations=3 holds=1 bridges=2';
END $counts$;

CREATE FUNCTION pg17_assert_role_cannot_read(role_name text) RETURNS void
LANGUAGE plpgsql AS $fn$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['contractor_osha_expansion_holds', 'osha_expansion_load_receipts'] LOOP
    IF has_table_privilege(role_name, format('public.%I', tbl), 'SELECT')
       OR has_table_privilege(role_name, format('public.%I', tbl), 'INSERT')
       OR has_table_privilege(role_name, format('public.%I', tbl), 'UPDATE')
       OR has_table_privilege(role_name, format('public.%I', tbl), 'DELETE') THEN
      RAISE EXCEPTION '% can access %', role_name, tbl;
    END IF;
    IF role_name = 'public' THEN
      CONTINUE;
    END IF;
    BEGIN
      EXECUTE format('SET ROLE %I', role_name);
      EXECUTE format('SELECT count(*) FROM public.%I', tbl);
      RAISE EXCEPTION '% read %', role_name, tbl;
    EXCEPTION
      WHEN insufficient_privilege THEN
        EXECUTE 'RESET ROLE';
      WHEN OTHERS THEN
        EXECUTE 'RESET ROLE';
        RAISE;
    END;
  END LOOP;
  EXECUTE 'RESET ROLE';
END $fn$;

DO $priv$
BEGIN
  IF NOT (
    SELECT relrowsecurity FROM pg_class WHERE oid = 'public.contractor_osha_expansion_holds'::regclass
  ) OR NOT (
    SELECT relrowsecurity FROM pg_class WHERE oid = 'public.osha_expansion_load_receipts'::regclass
  ) THEN
    RAISE EXCEPTION 'private expansion tables do not have row level security enabled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('contractor_osha_expansion_holds', 'osha_expansion_load_receipts')
  ) THEN
    RAISE EXCEPTION 'a policy is present on a private expansion table';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'anon and authenticated were not created in this database';
  END IF;
  PERFORM pg17_assert_role_cannot_read('public');
  PERFORM pg17_assert_role_cannot_read('anon');
  PERFORM pg17_assert_role_cannot_read('authenticated');
  IF current_user IS DISTINCT FROM session_user THEN
    RAISE EXCEPTION 'role was not reset after the privilege check';
  END IF;
  INSERT INTO pg17_assertion_receipts (name, status, detail)
  VALUES (
    'private_hold_tables_unreadable',
    'PASS',
    'public, anon, and authenticated cannot read holds or expansion receipts'
  );
  RAISE NOTICE 'ASSERTION private_hold_tables_unreadable PASS';
END $priv$;

DO $second$
DECLARE
  inserted integer;
  profiles integer;
  citations integer;
BEGIN
  inserted := pg17_apply_ca_fixture();
  SELECT count(*) INTO profiles FROM contractor_osha_license_matches
  WHERE state = 'CA' AND ingest_batch_id = '22222222-2222-4222-8222-222222222222';
  SELECT count(*) INTO citations FROM contractor_osha_citations
  WHERE source_batch_id = '22222222-2222-4222-8222-222222222222';
  IF inserted <> 0 OR profiles <> 2 OR citations <> 3 THEN
    RAISE EXCEPTION 'second execution inserted % rows; profiles=% citations=%',
      inserted, profiles, citations;
  END IF;
  IF (
    SELECT count(*) FROM contractor_osha_inspections
    WHERE source_batch_id = '22222222-2222-4222-8222-222222222222'
  ) <> 2
  OR (
    SELECT count(*) FROM contractor_osha_expansion_holds
    WHERE ingest_batch_id = '22222222-2222-4222-8222-222222222222'
  ) <> 1
  OR (
    SELECT count(*) FROM contractor_osha_match_inspections
    WHERE source_batch_id = '22222222-2222-4222-8222-222222222222'
  ) <> 2
  OR (
    SELECT count(*) FROM osha_detail_load_receipts
    WHERE source_batch_id = '22222222-2222-4222-8222-222222222222'
  ) <> 2 THEN
    RAISE EXCEPTION 'second execution duplicated a child row';
  END IF;
  INSERT INTO pg17_assertion_receipts (name, status, detail)
  VALUES ('second_execution_zero_duplicates', 'PASS', 'inserted=0');
  RAISE NOTICE 'ASSERTION second_execution_zero_duplicates PASS';
END $second$;

DO $doomed$
DECLARE
  doomed uuid := '33333333-3333-4333-8333-333333333333';
  profiles_before integer;
  profiles_after integer;
  contractor_before integer;
  contractor_after integer;
BEGIN
  SELECT count(*) INTO profiles_before FROM contractor_osha_license_matches WHERE state = 'CA';
  SELECT count(*) INTO contractor_before FROM contractors;
  BEGIN
    INSERT INTO contractors (id, display_name)
    VALUES ('33333333-3333-4333-8333-3333333333a1', 'Synthetic doomed profile');
    INSERT INTO ingest_batches (id, source_system, source_dataset, checksum_sha256)
    VALUES (
      doomed, 'us_dol_osha_expansion', 'synthetic:doomed',
      '1111111111111111111111111111111111111111111111111111111111111111'
    );
    INSERT INTO osha_expansion_load_receipts (
      id, state, ingest_batch_id, b2_source_system, b2_package_sha256,
      public_profile_count, inspection_count, citation_count,
      ambiguous_activity_count, missing_citation_context_count, held_row_count
    ) VALUES (
      '33333333-3333-4333-8333-3333333333b1', 'TN', doomed, 'tn_blc',
      '1111111111111111111111111111111111111111111111111111111111111111',
      1, 1, 1, 0, 0, 1
    );
    INSERT INTO contractor_osha_license_matches (
      contractor_id, license_key, state, match_tier, source_system, source_dataset,
      ingest_batch_id, receipt_id, expansion_receipt_id,
      n_inspections, n_citation_items, n_serious, n_willful_repeat,
      initial_penalty_amount, current_penalty_amount, n_with_final_order, n_contested,
      source_observed_on
    ) VALUES (
      '33333333-3333-4333-8333-3333333333a1', 'SYN-DOOMED', 'TN', 'exact', 'us_dol_osha',
      'synthetic:doomed', doomed, NULL, '33333333-3333-4333-8333-3333333333b1',
      1, 1, 0, 0, 1, 1, 0, 0, DATE '2026-01-15'
    );
    INSERT INTO contractor_osha_expansion_holds (
      state, license_key, hold_reason, expansion_receipt_id, ingest_batch_id
    ) VALUES (
      'TN', 'SYN-DOOMED-HOLD', 'weak', '33333333-3333-4333-8333-3333333333b1', doomed
    );
    INSERT INTO osha_detail_load_receipts (
      id, source_batch_id, source_dataset, source_hash, inspection_rows, citation_rows
    ) VALUES (
      '33333333-3333-4333-8333-3333333333c1', doomed, 'synthetic:doomed:inspections',
      '2222222222222222222222222222222222222222222222222222222222222222', 1, 0
    );
    INSERT INTO contractor_osha_inspections (
      id, activity_nr, state, source_batch_id, receipt_id, source_hash
    ) VALUES (
      '33333333-3333-4333-8333-3333333333d1', 'SYN-DOOMED-ACT', 'TN', doomed,
      '33333333-3333-4333-8333-3333333333c1',
      '2222222222222222222222222222222222222222222222222222222222222222'
    );
    INSERT INTO contractor_osha_citations (
      inspection_id, activity_nr, citation_id, standard, viol_type,
      initial_penalty, source_batch_id, receipt_id, source_hash
    ) VALUES (
      '33333333-3333-4333-8333-3333333333d1', 'SYN-DOOMED-ACT', 'SYN-DOOMED-C',
      'SYN-STANDARD', 'O', 4.00, doomed, '33333333-3333-4333-8333-3333333333c1',
      '2222222222222222222222222222222222222222222222222222222222222222'
    );
    RAISE EXCEPTION 'deliberate mid-transaction failure';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'deliberate mid-transaction failure' THEN
        RAISE;
      END IF;
  END;
  IF EXISTS (SELECT 1 FROM ingest_batches WHERE id = doomed)
     OR EXISTS (SELECT 1 FROM contractors WHERE id = '33333333-3333-4333-8333-3333333333a1')
     OR EXISTS (SELECT 1 FROM osha_expansion_load_receipts WHERE ingest_batch_id = doomed)
     OR EXISTS (SELECT 1 FROM contractor_osha_license_matches WHERE ingest_batch_id = doomed)
     OR EXISTS (SELECT 1 FROM contractor_osha_expansion_holds WHERE ingest_batch_id = doomed)
     OR EXISTS (SELECT 1 FROM osha_detail_load_receipts WHERE source_batch_id = doomed)
     OR EXISTS (SELECT 1 FROM contractor_osha_inspections WHERE source_batch_id = doomed)
     OR EXISTS (SELECT 1 FROM contractor_osha_citations WHERE source_batch_id = doomed) THEN
    RAISE EXCEPTION 'mid-transaction failure left rows behind';
  END IF;
  SELECT count(*) INTO profiles_after FROM contractor_osha_license_matches WHERE state = 'CA';
  SELECT count(*) INTO contractor_after FROM contractors;
  IF profiles_before <> profiles_after OR contractor_before <> contractor_after THEN
    RAISE EXCEPTION 'failed transaction changed committed synthetic rows';
  END IF;
  INSERT INTO pg17_assertion_receipts (name, status, detail)
  VALUES ('mid_transaction_rollback', 'PASS', 'doomed batch row count=0');
  RAISE NOTICE 'ASSERTION mid_transaction_rollback PASS';
END $doomed$;

CREATE TEMP TABLE pg17_flnj_fingerprint AS
SELECT md5(string_agg(line, E'\n' ORDER BY line)) AS fingerprint
FROM (
  SELECT 'batch|' || id::text || '|' || source_system || '|' || source_dataset AS line
  FROM ingest_batches
  WHERE id = '11111111-1111-4111-8111-111111111111'
  UNION ALL
  SELECT 'pilot|' || id::text || '|' || pilot_states || '|' || public_rows_inserted::text
  FROM osha_load_receipts
  UNION ALL
  SELECT 'match|' || id::text || '|' || state || '|' || license_key || '|' || receipt_id::text
    || '|' || coalesce(expansion_receipt_id::text, '')
  FROM contractor_osha_license_matches
  WHERE state IN ('FL', 'NJ')
  UNION ALL
  SELECT 'insp|' || id::text || '|' || state || '|' || activity_nr || '|' || receipt_id::text
  FROM contractor_osha_inspections
  WHERE state IN ('FL', 'NJ')
  UNION ALL
  SELECT 'cit|' || c.id::text || '|' || c.citation_id || '|' || coalesce(c.initial_penalty::text, 'NULL')
    || '|' || c.receipt_id::text
  FROM contractor_osha_citations c
  JOIN contractor_osha_inspections i ON i.id = c.inspection_id
  WHERE i.state IN ('FL', 'NJ')
  UNION ALL
  SELECT 'bridge|' || public_match_id::text || '|' || state || '|' || activity_nr
  FROM contractor_osha_match_inspections
  WHERE state IN ('FL', 'NJ')
  UNION ALL
  SELECT 'contractor|' || id::text || '|' || display_name
  FROM contractors
  WHERE id IN (
    '11111111-1111-4111-8111-1111111111f1',
    '11111111-1111-4111-8111-1111111111e1'
  )
) rows;

DO $before_rollback$
BEGIN
  IF (SELECT count(*) FROM contractor_osha_license_matches WHERE state = 'CA') <> 2 THEN
    RAISE EXCEPTION 'CA fixture is not loaded before the batch rollback';
  END IF;
  IF (SELECT count(*) FROM pg17_flnj_fingerprint) <> 1
     OR (SELECT fingerprint FROM pg17_flnj_fingerprint) IS NULL THEN
    RAISE EXCEPTION 'FL/NJ fingerprint was not captured';
  END IF;
END $before_rollback$;

BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ingest_batches
    WHERE id = '22222222-2222-4222-8222-222222222222'
      AND source_system = 'us_dol_osha_expansion'
  ) THEN
    RAISE EXCEPTION 'expansion batch guard failed';
  END IF;
END $$;
DELETE FROM contractor_osha_citations c
 USING contractor_osha_inspections i
 WHERE c.inspection_id = i.id
   AND c.source_batch_id = '22222222-2222-4222-8222-222222222222'
   AND i.source_batch_id = '22222222-2222-4222-8222-222222222222'
   AND i.state = 'CA';
DELETE FROM contractor_osha_match_inspections
 WHERE source_batch_id = '22222222-2222-4222-8222-222222222222'
   AND state = 'CA';
DELETE FROM contractor_osha_inspections i
 WHERE i.source_batch_id = '22222222-2222-4222-8222-222222222222'
   AND i.state = 'CA'
   AND NOT EXISTS (
     SELECT 1 FROM contractor_osha_match_inspections b WHERE b.inspection_id = i.id
   );
DELETE FROM contractor_osha_license_matches
 WHERE ingest_batch_id = '22222222-2222-4222-8222-222222222222'
   AND state = 'CA'
   AND expansion_receipt_id IS NOT NULL;
DELETE FROM contractor_osha_identity_review
 WHERE ingest_batch_id = '22222222-2222-4222-8222-222222222222'
   AND state = 'CA'
   AND expansion_receipt_id IS NOT NULL;
DELETE FROM contractor_osha_expansion_holds
 WHERE ingest_batch_id = '22222222-2222-4222-8222-222222222222'
   AND state = 'CA';
DELETE FROM osha_expansion_load_receipts
 WHERE ingest_batch_id = '22222222-2222-4222-8222-222222222222'
   AND state = 'CA';
DELETE FROM osha_detail_load_receipts r
 WHERE r.source_batch_id = '22222222-2222-4222-8222-222222222222'
   AND NOT EXISTS (
     SELECT 1 FROM contractor_osha_inspections i
     WHERE i.receipt_id = r.id OR i.source_batch_id = r.source_batch_id
   )
   AND NOT EXISTS (
     SELECT 1 FROM contractor_osha_citations c
     WHERE c.receipt_id = r.id OR c.source_batch_id = r.source_batch_id
   )
   AND NOT EXISTS (
     SELECT 1 FROM contractor_osha_match_inspections b
     WHERE b.receipt_id = r.id OR b.source_batch_id = r.source_batch_id
   );
DELETE FROM ingest_batches b
 WHERE b.id = '22222222-2222-4222-8222-222222222222'
   AND b.source_system = 'us_dol_osha_expansion'
   AND NOT EXISTS (SELECT 1 FROM contractor_osha_license_matches m WHERE m.ingest_batch_id = b.id)
   AND NOT EXISTS (SELECT 1 FROM contractor_osha_identity_review r WHERE r.ingest_batch_id = b.id)
   AND NOT EXISTS (SELECT 1 FROM osha_load_receipts o WHERE o.ingest_batch_id = b.id)
   AND NOT EXISTS (SELECT 1 FROM contractor_osha_inspections i WHERE i.source_batch_id = b.id)
   AND NOT EXISTS (SELECT 1 FROM contractor_osha_citations c WHERE c.source_batch_id = b.id)
   AND NOT EXISTS (SELECT 1 FROM contractor_osha_match_inspections br WHERE br.source_batch_id = b.id)
   AND NOT EXISTS (SELECT 1 FROM osha_expansion_load_receipts e WHERE e.ingest_batch_id = b.id)
   AND NOT EXISTS (SELECT 1 FROM osha_detail_load_receipts d WHERE d.source_batch_id = b.id)
   AND NOT EXISTS (SELECT 1 FROM contractor_osha_expansion_holds h WHERE h.ingest_batch_id = b.id);
COMMIT;

DO $unchanged$
DECLARE
  after_fingerprint text;
  before_fingerprint text;
BEGIN
  SELECT fingerprint INTO before_fingerprint FROM pg17_flnj_fingerprint;
  SELECT md5(string_agg(line, E'\n' ORDER BY line)) INTO after_fingerprint
  FROM (
    SELECT 'batch|' || id::text || '|' || source_system || '|' || source_dataset AS line
    FROM ingest_batches
    WHERE id = '11111111-1111-4111-8111-111111111111'
    UNION ALL
    SELECT 'pilot|' || id::text || '|' || pilot_states || '|' || public_rows_inserted::text
    FROM osha_load_receipts
    UNION ALL
    SELECT 'match|' || id::text || '|' || state || '|' || license_key || '|' || receipt_id::text
      || '|' || coalesce(expansion_receipt_id::text, '')
    FROM contractor_osha_license_matches
    WHERE state IN ('FL', 'NJ')
    UNION ALL
    SELECT 'insp|' || id::text || '|' || state || '|' || activity_nr || '|' || receipt_id::text
    FROM contractor_osha_inspections
    WHERE state IN ('FL', 'NJ')
    UNION ALL
    SELECT 'cit|' || c.id::text || '|' || c.citation_id || '|' || coalesce(c.initial_penalty::text, 'NULL')
      || '|' || c.receipt_id::text
    FROM contractor_osha_citations c
    JOIN contractor_osha_inspections i ON i.id = c.inspection_id
    WHERE i.state IN ('FL', 'NJ')
    UNION ALL
    SELECT 'bridge|' || public_match_id::text || '|' || state || '|' || activity_nr
    FROM contractor_osha_match_inspections
    WHERE state IN ('FL', 'NJ')
    UNION ALL
    SELECT 'contractor|' || id::text || '|' || display_name
    FROM contractors
    WHERE id IN (
      '11111111-1111-4111-8111-1111111111f1',
      '11111111-1111-4111-8111-1111111111e1'
    )
  ) rows;
  IF before_fingerprint IS DISTINCT FROM after_fingerprint THEN
    RAISE EXCEPTION 'FL/NJ fixture changed during the CA batch rollback';
  END IF;
  IF (SELECT count(*) FROM contractor_osha_license_matches WHERE state = 'FL') <> 1
     OR (SELECT count(*) FROM contractor_osha_license_matches WHERE state = 'NJ') <> 1
     OR (SELECT count(*) FROM osha_load_receipts) <> 1
     OR (SELECT pilot_states FROM osha_load_receipts) <> 'FL,NJ'
     OR (SELECT initial_penalty FROM contractor_osha_citations WHERE citation_id = 'SYN-FL-C-1') <> 7.00
     OR (SELECT initial_penalty FROM contractor_osha_citations WHERE citation_id = 'SYN-NJ-C-1') IS NOT NULL
     OR EXISTS (SELECT 1 FROM contractor_osha_license_matches WHERE state = 'CA')
     OR EXISTS (SELECT 1 FROM contractor_osha_inspections WHERE state = 'CA')
     OR EXISTS (SELECT 1 FROM osha_expansion_load_receipts WHERE state = 'CA')
     OR EXISTS (SELECT 1 FROM contractor_osha_expansion_holds WHERE state = 'CA')
     OR EXISTS (SELECT 1 FROM ingest_batches WHERE id = '22222222-2222-4222-8222-222222222222')
     OR EXISTS (
       SELECT 1 FROM contractors
       WHERE id IN (
         '11111111-1111-4111-8111-1111111111f1',
         '11111111-1111-4111-8111-1111111111e1',
         '22222222-2222-4222-8222-2222222222a1',
         '22222222-2222-4222-8222-2222222222a2'
       )
       HAVING count(*) <> 4
     ) THEN
    RAISE EXCEPTION 'batch rollback did not preserve FL/NJ or remove only the CA batch';
  END IF;
  INSERT INTO pg17_assertion_receipts (name, status, detail)
  VALUES ('batch_rollback_preserves_fl_nj', 'PASS', 'fl=1 nj=1 ca_batch=0 pilot_states=FL,NJ');
  RAISE NOTICE 'ASSERTION batch_rollback_preserves_fl_nj PASS';
END $unchanged$;

DO $gates$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM pg17_assertion_receipts WHERE status = 'PASS';
  IF n <> 10 THEN
    RAISE EXCEPTION 'expected 10 passing assertions, found %', n;
  END IF;
  IF current_setting('server_version_num')::int / 10000 <> 17 THEN
    RAISE EXCEPTION 'PostgreSQL 17 engine check failed';
  END IF;
  RAISE NOTICE 'POSTGRES_17_ENGINE=PASS';
  RAISE NOTICE 'MIGRATION_020=PASS';
  RAISE NOTICE 'FOREIGN_KEYS=PASS';
  RAISE NOTICE 'CITATION_PROVENANCE=PASS';
  RAISE NOTICE 'INITIAL_PENALTIES=PASS';
  RAISE NOTICE 'SOURCE_HASHES=PASS';
  RAISE NOTICE 'TRANSACTION_ROLLBACK=PASS';
  RAISE NOTICE 'SECOND_RUN_IDEMPOTENCY=PASS';
  RAISE NOTICE 'FL_NJ_UNCHANGED=PASS';
  RAISE NOTICE 'CI=PASS';
  RAISE NOTICE 'PRODUCTION_MUTATIONS = 0';
END $gates$;
