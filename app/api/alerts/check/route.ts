import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { sendAlertEmail } from "@/lib/auth/email";
import { getContractorBySlug } from "@/lib/contractors/queries";
import { absoluteUrl } from "@/lib/site";
import {
  insertAlertEvent,
  loadAlertPreferences,
  loadWorkspace,
  saveWorkspace,
} from "@/lib/passport/workspace-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * On-demand extract-diff for watched contractors (also suitable for cron with secret later).
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  try {
    const prefs = await loadAlertPreferences(user.id);
    const ws = await loadWorkspace(user.id);
    const watches = ws.projectsStore.watches || [];
    let created = 0;

    for (const w of watches) {
      let contractor;
      try {
        contractor = await getContractorBySlug(w.slug, "fl");
      } catch {
        continue;
      }
      if (!contractor) continue;

      const lic = contractor.licenses[0];
      const ent = contractor.entities[0];
      const licStatus = lic?.statusNormalized || null;
      const entStatus = ent?.status || null;
      const discCount = contractor.discipline.length;

      const events: { kind: string; title: string; body: string }[] = [];

      if (
        prefs.watchLicense &&
        w.licenseStatus &&
        licStatus &&
        w.licenseStatus !== licStatus
      ) {
        events.push({
          kind: "license_status",
          title: "License status change detected",
          body: `License status change detected in current board extracts (${w.licenseStatus} -> ${licStatus}) for ${w.name}.`,
        });
      }
      if (
        prefs.watchEntity &&
        w.entityStatus &&
        entStatus &&
        w.entityStatus !== entStatus
      ) {
        events.push({
          kind: "entity_status",
          title: "Entity status appears changed",
          body: `Entity status appears changed in current extracts (${w.entityStatus} -> ${entStatus}) for ${w.name}.`,
        });
      }
      if (
        prefs.watchDiscipline &&
        typeof w.disciplineCount === "number" &&
        discCount > w.disciplineCount
      ) {
        events.push({
          kind: "discipline",
          title: "New discipline record identified",
          body: `New discipline record identified in current extracts for ${w.name}.`,
        });
      }

      // Update baseline
      w.licenseStatus = licStatus ?? w.licenseStatus;
      w.entityStatus = entStatus ?? w.entityStatus;
      w.disciplineCount = discCount;
      w.lastCheckedAt = new Date().toISOString();
      w.name = contractor.displayName || w.name;

      for (const ev of events) {
        const href = absoluteUrl(`/contractors/${encodeURIComponent(w.slug)}`);
        let emailed = false;
        if (prefs.emailEnabled) {
          emailed = await sendAlertEmail({
            to: user.email,
            subject: `[Trust Hub] ${ev.title}`,
            body: `${ev.body}\n\nSource extracts may lag live board systems. Educational research only.`,
            href,
          });
        }
        await insertAlertEvent({
          userId: user.id,
          kind: ev.kind,
          title: ev.title,
          body: ev.body,
          href,
          contractorSlug: w.slug,
          emailSent: emailed,
        });
        // Also mirror into workspace alerts for UI
        ws.projectsStore.alerts.unshift({
          id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          contractorSlug: w.slug,
          contractorName: w.name,
          kind: ev.kind as "license_status" | "discipline" | "entity_status",
          message: ev.body,
          detectedAt: new Date().toISOString(),
          read: false,
        });
        created++;
      }
    }

    // Gentle project payment-doc reminders
    if (prefs.projectPaymentDocs) {
      for (const p of ws.projectsStore.projects) {
        if (p.status === "complete") continue;
        const bad = p.payments.filter(
          (pay) => pay.completed && (!pay.hasInvoice || !pay.hasLienWaiver)
        );
        if (bad.length > 0) {
          const body = `Project “${p.title}” has ${bad.length} payment(s) logged without complete invoice/waiver documentation.`;
          await insertAlertEvent({
            userId: user.id,
            kind: "project_payment_docs",
            title: "Payment documentation incomplete",
            body,
            href: absoluteUrl(`/projects/${p.id}?tab=payments`),
            projectId: p.id,
          });
        }
      }
    }

    ws.projectsStore.alerts = ws.projectsStore.alerts.slice(0, 50);
    await saveWorkspace(user.id, ws);

    return NextResponse.json({
      ok: true,
      checked: watches.length,
      alertsCreated: created,
      message:
        "Watch check complete. Alerts use current extracts and may lag official boards.",
    });
  } catch (e) {
    console.error("[alerts/check]", e);
    return NextResponse.json({ error: "Alert check failed." }, { status: 503 });
  }
}
