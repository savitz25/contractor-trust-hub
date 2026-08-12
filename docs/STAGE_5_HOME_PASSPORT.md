# Stage 5 — Home Passport + Durable Records

**Accounts · Alerts · Project completion · Property passport · Export**

Educational long-term homeowner record system. Not a government registry, title report, insurance system, or legal certificate.

## Routes

| Path | Purpose |
|------|---------|
| `/account` | Magic-link sign-in, import local, alert prefs, watch check |
| `/account/verify` | Fallback copy (actual verify is `/api/auth/verify`) |
| `/passport` | List Home Passports |
| `/passport/[id]` | Property passport detail |
| `/api/auth/*` | request-link, verify, logout, me |
| `/api/account/sync` | Pull/push durable workspace |
| `/api/account/import-local` | Merge device data into account |
| `/api/account/preferences` | Alert preferences |
| `/api/alerts/check` | Extract-diff for watches + payment-doc reminders |

## Database

Migration: `schema/migrations/005_stage5_accounts_passport.sql`

Tables: `app_users`, `auth_magic_links`, `auth_sessions`, `user_workspace`, `alert_preferences`, `alert_events`, `passport_properties` (optional denormalized; v1 stores passport in workspace JSON primarily).

## Auth model

- Email magic link (30 minutes)
- HttpOnly session cookie `cth_session` (30 days)
- Optional `RESEND_API_KEY` + `AUTH_FROM_EMAIL` for delivery
- Without Resend: API returns `previewUrl` for local/dev

## Local vs durable

| Mode | Storage |
|------|---------|
| Device-only | `cth-projects-store-v1`, `cth-durable-workspace-v2`, `cth-passports-v1` |
| Signed in | `user_workspace.payload` JSONB + prefs tables |

Import merges local + cloud by project id / passport key (newer `updatedAt` wins).

## Workspace payload

```
DurableWorkspace {
  version: 2
  projectsStore: ProjectsStore  // Stage 4 shape
  passports: HomePassport[]
  alertPreferences
  savedPropertyIds?
}
```

## Home Passport sections

A Property overview · B Improvement timeline · C Contractor history · D Warranties · E Materials · F Documents vault

Created mainly via **Mark project complete → Save to Home Passport**.

## Alerts

**Watch:** license status, discipline count increase, entity status  
**Project:** incomplete payment documentation (on check)

Copy is factual and calm. Disclose extract lag. Preference center on `/account`.

## Export

Browser print/PDF:
- Project packet (milestones, payments, docs, contract findings)
- Passport summary (timeline, warranties, vault)

Disclaimers included on every export.

## Env

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | For durable accounts | Apply migration 005 |
| `RESEND_API_KEY` | Optional | Magic link + alert email |
| `AUTH_FROM_EMAIL` | Optional | From address for Resend |
| `NEXT_PUBLIC_SITE_URL` | Production | Absolute magic-link URLs |

## Privacy

- Minimal data: email for auth/alerts
- User can delete projects, sign out (local data remains until cleared)
- Export available; official sources control
