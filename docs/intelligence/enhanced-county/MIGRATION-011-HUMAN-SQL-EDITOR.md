# Migration 011 — Human SQL Editor action package

**Not applied.** Paste the companion file into the production Supabase SQL Editor and run once.

Exact SQL (copy entire file, no edits):  
`docs/intelligence/enhanced-county/MIGRATION-011-HUMAN-SQL-EDITOR.sql`

Do **not** retry `DATABASE_URL` / `psycopg` password login. Do **not** load TEST_ONLY fixtures.

---

## A. Purpose

Creates **empty** Enhanced County tables for Broward/Palm Beach ingest:

- `public.enhanced_jurisdictions` — AHJ metadata (not activity)
- `public.local_credentials` + `public.local_credential_relations`
- `public.permit_source_records` + `public.permit_lifecycle_events` + `public.permit_attributions`
- `public.public_contact_observations`
- `public.enhanced_source_files` — export provenance

Does **not** change `licenses` / `contractors` identity, `/florida` metrics, or `coverageLevel`.

---

## B. Preflight queries

Included at the top of the SQL file (`BEGIN` + `DO` block requiring `public.licenses` and `public.contractors`). Optional extra checks (run separately if you want a dry look first):

```sql
SELECT to_regclass('public.enhanced_jurisdictions') AS enhanced_jurisdictions;
SELECT to_regclass('public.permit_source_records') AS permit_source_records;
SELECT to_regclass('public.local_credentials') AS local_credentials;
```

Expected before first apply: all `NULL`.

---

## C. Exact migration SQL

Use **`MIGRATION-011-HUMAN-SQL-EDITOR.sql` in full**. Schema-qualified `public.*`. `CREATE IF NOT EXISTS`. No secrets. No synthetic permit/cert rows.

---

## D. Postflight verification

The SQL file ends with table-list and count queries. Success:

- eight table names returned
- activity tables count **0**
- `enhanced_jurisdictions` count **0** until the separate seed script runs

Index check (optional after COMMIT):

```sql
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'enhanced_jurisdictions','local_credentials','local_credential_relations',
    'permit_source_records','permit_lifecycle_events','permit_attributions',
    'public_contact_observations','enhanced_source_files'
  )
ORDER BY 1;
```

---

## E. Rollback

011 is additive and starts empty. If the editor reports an error, **do not DROP** production objects unless this transaction actually committed a broken object. The file runs in **one `BEGIN`/`COMMIT`**. A failed run should abort with no commit.

If you must undo a **successful** empty apply (rare):

```sql
-- Only if 011 was committed AND tables are empty AND you must reverse it.
-- DROP TABLE public.permit_attributions;
-- DROP TABLE public.permit_lifecycle_events;
-- DROP TABLE public.public_contact_observations;
-- DROP TABLE public.permit_source_records;
-- DROP TABLE public.local_credential_relations;
-- DROP TABLE public.local_credentials;
-- DROP TABLE public.enhanced_source_files;
-- DROP TABLE public.enhanced_jurisdictions;
```

Leave those commented unless rollback is genuinely required.

---

## F. Expected result

SQL Editor shows success; eight tables exist; permit/credential/contact/file counts are 0; `/florida` unchanged; coverage remains Statewide Research.

**Next (after DDL succeeds):** `python scripts/seed_enhanced_jurisdictions.py` — metadata only. See `SEED-JURISDICTIONS-HUMAN.md`.
