# Supabase setup (Contractor Trust Hub)

## 1. Get `DATABASE_URL`

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your Contractor Trust Hub project.
2. Go to **Project Settings** (gear) → **Database**.
3. Under **Connection string**, choose **URI**.
4. Pick the right mode for bulk loads:

| Mode | When to use |
|------|-------------|
| **Direct connection** (`db.<ref>.supabase.co:5432`) | Best for schema init + full FL load |
| **Session pooler** (`…pooler.supabase.com:5432`) | Good alternative if direct is blocked |
| **Transaction pooler** (`…:6543`) | App queries only — **avoid** for `load_fl_dbpr_to_postgres.py` |

5. Click **Copy**. Replace `[YOUR-PASSWORD]` with the **database password** set at project creation  
   (reset under Database settings if needed).
6. URL-encode special password characters (`@` → `%40`, `#` → `%23`, etc.).

Example shapes:

```text
# Direct
postgresql://postgres:YOUR_PASSWORD@db.abcdefghijklmnop.supabase.co:5432/postgres

# Session pooler (user often looks like postgres.abcdefghijklmnop)
postgresql://postgres.abcdefghijklmnop:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

The loader auto-appends `sslmode=require` and a connect timeout when missing.

## 2. Store as a sensitive env var (local)

```bash
# From repo root
copy .env.example .env.local   # Windows
# or: cp .env.example .env.local
```

Edit `.env.local`:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres
```

`.env.local` is gitignored (`.env*.local`). Do **not** commit it.

### Vercel / production (required for the Verify web app)

The Next.js app **requires** `DATABASE_URL` at runtime (search + detail pages query Postgres).

| Setting | Value |
|---------|--------|
| Variable | `DATABASE_URL` |
| Value | **Session pooler** URI (port **5432**, user `postgres.<project-ref>`) |
| Scope | Production (and Preview if you exercise PR deploys) |
| Sensitivity | Sensitive / encrypted — never commit |

Also recommended:

```env
NEXT_PUBLIC_SITE_URL=https://your-production-host.vercel.app
```

**Do not** use the direct `db.<ref>.supabase.co` host on Vercel if your Supabase project is IPv6-only on the direct path — Session pooler is the supported path.

Transaction pooler (`:6543`) is for short serverless queries with different prepared-statement semantics; this app is written for Session pooler / standard Postgres sessions.

Not required for local offline load scripts if you run those against Direct/Session separately.

## 3. Load path

```bash
pip install -r ingest/requirements.txt

# Sample first (~2k licenses from data/staging/fl_dbpr)
python scripts/load_fl_dbpr_to_postgres.py --init-schema --staging-dir data/staging/fl_dbpr

# Full extract (~143k licenses + QB)
python scripts/load_fl_dbpr_to_postgres.py --staging-dir data/staging/fl_dbpr_full

# Verify
python scripts/verify_fl_dbpr_load.py
```

## 4. Confirm in Supabase UI

1. **Table Editor** → tables: `contractors`, `licenses`, `entities`, `discipline_actions`, `ingest_batches`
2. Or **SQL Editor**:

```sql
SELECT 'contractors' AS t, COUNT(*) FROM contractors
UNION ALL SELECT 'licenses', COUNT(*) FROM licenses
UNION ALL SELECT 'entities', COUNT(*) FROM entities
UNION ALL SELECT 'discipline_actions', COUNT(*) FROM discipline_actions;
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| `password authentication failed` | Reset DB password; re-copy URI |
| `Tenant or user not found` | Use `postgres.<project-ref>` for pooler user |
| SSL error | Ensure `sslmode=require` (auto-added by loader) |
| Hang / timeout | Try direct host; raise `PGCONNECT_TIMEOUT=60` |
| Empty public schema after load | Wrong project URI, or connected to a different database |
