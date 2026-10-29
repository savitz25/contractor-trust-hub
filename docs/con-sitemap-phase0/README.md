# CON Sitemap Phase 0 — PostgreSQL 17 contract tests

This is a **test-only, synthetic-data package**. It provisions a fresh PostgreSQL 17 GitHub Actions service container, enables `pgcrypto` non-destructively in the `extensions` schema, installs a proposed private-schema contract, and exercises it with multiple independent PostgreSQL sessions. It never loads repository `.env` files or Production records. The CI password is a literal test-only credential scoped to an ephemeral service container.

The workflow `.github/workflows/con-sitemap-phase0-pg17.yml` is independent of `.github/workflows/con-osha-002-postgres-17.yml`. It does not edit or alter the OSHA workflow or its branch condition. The test package is not release approval and does not validate Supabase, TLS, CDN, Production routes, or public sitemap eligibility.

Run in a fresh disposable PG17 database only:

```sh
python -m pip install 'psycopg[binary]==3.2.3'
python scripts/con_sitemap_phase0/run_engine.py
```

The harness refuses to start unless the connection identifies the expected local synthetic database and user. Logs contain synthetic IDs and measurements only. The 400,000,000-byte case tests the stored `bytea` payload-length guard and separately records heap, total relation, index and TOAST bytes; the logical payload limit is not presented as a cap on physical PostgreSQL storage.

`pg17-results.json` and `pg17-results.log` are uploaded as a GitHub Actions artifact for each run. An engine test marked `UNRUN` is not treated as a pass.
