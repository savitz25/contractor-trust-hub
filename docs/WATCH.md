# Watch contractors (device-first retention)

**Public route:** `/watch`  
**Control:** Trust Report primary actions (`WatchButton`)

## What watching means

- Saves a **snapshot** (slug, name, license id/status, entity status, discipline count) on the device.
- Lets the homeowner **re-open** the Trust Report or evidence summary later.
- When they reopen a watched report, the app may **compare** the current extract snapshot to the saved one and show a local note — **not** continuous live board monitoring.

## Storage model

| Key | Location | Contents |
|-----|----------|----------|
| `cth-projects-store-v1` | `localStorage` | `watches[]`, `alerts[]`, projects, analyses |

Watch API (client): `lib/projects/store.ts`

- `watchContractor` / `unwatchContractor` / `isWatching` / `listWatches`
- `checkWatchAgainstSnapshot` → local `alerts` (deduped ~24h)
- Event: `cth-projects-change` after writes

No account required for v1. Clearing site data clears watches.

## Email alerts

| Path | Behavior |
|------|----------|
| **Device watch (default)** | No email. Local list + on-open extract compare only. |
| **Signed-in account** | Optional: `POST /api/alerts/check` + account alert preferences can email when `emailEnabled` and watch prefs are on. Documented on Account; not promised for device-only users. |

Do not market device Watch as “we email you when status changes.”

## Entry points

- Trust Report: Watch / Watching + “View watched list”
- `/watch` list page
- Header **My Project** → Watched (mobile groups)
- Footer Protect & records
- Home continuity strip when watches exist

## Honesty copy

Use: “Saved on this device”, “re-check evidence later”, “not continuous live board monitoring.”  
Avoid: “we monitor the board 24/7”, ranking language, lead forms.
