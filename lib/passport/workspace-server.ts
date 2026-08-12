import { query, queryOne } from "@/lib/db";
import type { AlertPreferences, DurableWorkspace, HomePassport } from "./types";
import { DEFAULT_ALERT_PREFS, emptyWorkspace } from "./types";

export async function loadWorkspace(userId: string): Promise<DurableWorkspace> {
  const row = await queryOne<{ payload: DurableWorkspace }>(
    `SELECT payload FROM user_workspace WHERE user_id = $1`,
    [userId]
  );
  if (!row?.payload || typeof row.payload !== "object") return emptyWorkspace();
  const p = row.payload as DurableWorkspace;
  return {
    ...emptyWorkspace(),
    ...p,
    version: 2,
    projectsStore: p.projectsStore || emptyWorkspace().projectsStore,
    passports: p.passports || [],
    alertPreferences: { ...DEFAULT_ALERT_PREFS, ...(p.alertPreferences || {}) },
  };
}

export async function saveWorkspace(
  userId: string,
  workspace: DurableWorkspace
): Promise<void> {
  const payload = {
    ...workspace,
    version: 2 as const,
    updatedAt: new Date().toISOString(),
  };
  await query(
    `INSERT INTO user_workspace (user_id, payload, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (user_id) DO UPDATE SET payload = $2::jsonb, updated_at = now()`,
    [userId, JSON.stringify(payload)]
  );
}

/** Merge local session workspace into cloud (local wins on same project id timestamps). */
export function mergeWorkspaces(
  cloud: DurableWorkspace,
  local: DurableWorkspace
): DurableWorkspace {
  const projectsById = new Map(
    [...cloud.projectsStore.projects, ...local.projectsStore.projects].map((p) => [p.id, p])
  );
  // Prefer newer updatedAt
  for (const p of local.projectsStore.projects) {
    const c = projectsById.get(p.id);
    if (!c || new Date(p.updatedAt) >= new Date(c.updatedAt)) projectsById.set(p.id, p);
  }

  const watchesBySlug = new Map(
    [...cloud.projectsStore.watches, ...local.projectsStore.watches].map((w) => [w.slug, w])
  );
  for (const w of local.projectsStore.watches) watchesBySlug.set(w.slug, w);

  const alerts = [...local.projectsStore.alerts, ...cloud.projectsStore.alerts]
    .filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i)
    .slice(0, 80);

  const analyses = [...local.projectsStore.analyses, ...cloud.projectsStore.analyses]
    .filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i)
    .slice(0, 30);

  const passportsByKey = new Map<string, HomePassport>();
  for (const p of [...cloud.passports, ...local.passports]) {
    const prev = passportsByKey.get(p.propertyKey);
    if (!prev || new Date(p.updatedAt) >= new Date(prev.updatedAt)) {
      passportsByKey.set(p.propertyKey, p);
    }
  }

  return {
    version: 2,
    projectsStore: {
      version: 1,
      projects: [...projectsById.values()],
      watches: [...watchesBySlug.values()],
      alerts,
      analyses,
    },
    passports: [...passportsByKey.values()],
    alertPreferences: local.alertPreferences || cloud.alertPreferences || DEFAULT_ALERT_PREFS,
    savedPropertyIds: [
      ...new Set([...(cloud.savedPropertyIds || []), ...(local.savedPropertyIds || [])]),
    ],
    updatedAt: new Date().toISOString(),
  };
}

export async function loadAlertPreferences(userId: string): Promise<AlertPreferences> {
  const row = await queryOne<{
    watch_license: boolean;
    watch_discipline: boolean;
    watch_entity: boolean;
    project_payment_docs: boolean;
    project_completion: boolean;
    warranty_reminders: boolean;
    email_enabled: boolean;
  }>(`SELECT * FROM alert_preferences WHERE user_id = $1`, [userId]);
  if (!row) return { ...DEFAULT_ALERT_PREFS };
  return {
    watchLicense: row.watch_license,
    watchDiscipline: row.watch_discipline,
    watchEntity: row.watch_entity,
    projectPaymentDocs: row.project_payment_docs,
    projectCompletion: row.project_completion,
    warrantyReminders: row.warranty_reminders,
    emailEnabled: row.email_enabled,
  };
}

export async function saveAlertPreferences(
  userId: string,
  prefs: AlertPreferences
): Promise<void> {
  await query(
    `INSERT INTO alert_preferences (
       user_id, watch_license, watch_discipline, watch_entity,
       project_payment_docs, project_completion, warranty_reminders, email_enabled, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
     ON CONFLICT (user_id) DO UPDATE SET
       watch_license = $2, watch_discipline = $3, watch_entity = $4,
       project_payment_docs = $5, project_completion = $6, warranty_reminders = $7,
       email_enabled = $8, updated_at = now()`,
    [
      userId,
      prefs.watchLicense,
      prefs.watchDiscipline,
      prefs.watchEntity,
      prefs.projectPaymentDocs,
      prefs.projectCompletion,
      prefs.warrantyReminders,
      prefs.emailEnabled,
    ]
  );
}

export async function insertAlertEvent(opts: {
  userId: string;
  kind: string;
  title: string;
  body: string;
  href?: string;
  contractorSlug?: string;
  projectId?: string;
  emailSent?: boolean;
}): Promise<void> {
  await query(
    `INSERT INTO alert_events (
       user_id, kind, title, body, href, contractor_slug, project_id, email_sent_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      opts.userId,
      opts.kind,
      opts.title,
      opts.body,
      opts.href || null,
      opts.contractorSlug || null,
      opts.projectId || null,
      opts.emailSent ? new Date().toISOString() : null,
    ]
  );
}

export async function listAlertEvents(userId: string, limit = 40) {
  return query<{
    id: string;
    kind: string;
    title: string;
    body: string;
    href: string | null;
    contractor_slug: string | null;
    project_id: string | null;
    email_sent_at: string | null;
    read_at: string | null;
    created_at: string;
  }>(
    `SELECT * FROM alert_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
}
