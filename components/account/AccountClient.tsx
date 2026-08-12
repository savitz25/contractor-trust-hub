"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { AlertPreferences, DurableWorkspace } from "@/lib/passport/types";
import { DEFAULT_ALERT_PREFS } from "@/lib/passport/types";
import { loadLocalWorkspace, saveLocalWorkspace } from "@/lib/passport/local-workspace";

export function AccountClient() {
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<AlertPreferences>({ ...DEFAULT_ALERT_PREFS });
  const [localSummary, setLocalSummary] = useState("");

  const refreshMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const json = (await res.json()) as {
        user?: { email: string } | null;
        workspace?: DurableWorkspace;
      };
      if (json.user?.email) {
        setUserEmail(json.user.email);
        if (json.workspace) {
          setPrefs({ ...DEFAULT_ALERT_PREFS, ...json.workspace.alertPreferences });
          // Pull cloud into local for seamless UI
          saveLocalWorkspace(json.workspace);
        }
      } else {
        setUserEmail(null);
      }
    } catch {
      setUserEmail(null);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
    const local = loadLocalWorkspace();
    setLocalSummary(
      `${local.projectsStore.projects.length} project(s) · ${local.projectsStore.watches.length} watch(es) · ${local.passports.length} passport(s) on this device`
    );
    if (sp.get("signed_in") === "1") setMessage("Signed in. You can import device data or sync.");
    if (sp.get("error") === "invalid_token") setMessage("That sign-in link is invalid or expired.");
    if (sp.get("error") === "missing_token") setMessage("Missing sign-in token.");
  }, [refreshMe, sp]);

  const requestLink = async () => {
    setBusy(true);
    setMessage(null);
    setPreviewUrl(null);
    try {
      const res = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as {
        error?: string;
        message?: string;
        previewUrl?: string;
        sent?: boolean;
      };
      if (!res.ok) throw new Error(json.error || "Request failed");
      setMessage(json.message || "Check your email.");
      if (json.previewUrl) setPreviewUrl(json.previewUrl);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const importLocal = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const workspace = loadLocalWorkspace();
      const res = await fetch("/api/account/import-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace }),
      });
      const json = (await res.json()) as {
        error?: string;
        message?: string;
        workspace?: DurableWorkspace;
      };
      if (!res.ok) throw new Error(json.error || "Import failed");
      if (json.workspace) saveLocalWorkspace(json.workspace);
      setMessage(json.message || "Imported.");
      setLocalSummary(
        `${json.workspace?.projectsStore.projects.length ?? 0} project(s) saved to account`
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const syncPull = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/account/sync");
      const json = (await res.json()) as { error?: string; workspace?: DurableWorkspace };
      if (!res.ok) throw new Error(json.error || "Sync failed");
      if (json.workspace) {
        saveLocalWorkspace(json.workspace);
        setPrefs({ ...DEFAULT_ALERT_PREFS, ...json.workspace.alertPreferences });
      }
      setMessage("Pulled latest from your account onto this device.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  const savePrefs = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/account/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error || "Save failed");
      }
      const ws = loadLocalWorkspace();
      ws.alertPreferences = prefs;
      saveLocalWorkspace(ws);
      setMessage("Alert preferences saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const runAlertCheck = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/alerts/check", { method: "POST" });
      const json = (await res.json()) as {
        error?: string;
        message?: string;
        alertsCreated?: number;
      };
      if (!res.ok) throw new Error(json.error || "Check failed");
      setMessage(json.message || `Created ${json.alertsCreated ?? 0} alert(s).`);
      await refreshMe();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Check failed");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUserEmail(null);
    setMessage("Signed out. Device-local data remains on this browser.");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Account &amp; saved records
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)] sm:text-3xl">
          Save your work beyond one device
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          Optional email sign-in keeps projects, watches, and Home Passport durable. Local-only mode
          still works — clearly labeled as device-only. Minimal personal data: email for sign-in and
          alerts.
        </p>

        {userEmail ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-4">
            <p className="text-sm font-semibold text-emerald-950">Signed in as {userEmail}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void importLocal()}
                className="rounded-xl bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Import device data into account
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void syncPull()}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold"
              >
                Pull account to this device
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runAlertCheck()}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold"
              >
                Check watches now
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--muted)]"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm font-normal normal-case tracking-normal"
                placeholder="you@example.com"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void requestLink()}
              className="self-end rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Email me a sign-in link
            </button>
          </div>
        )}

        {message ? (
          <p className="mt-4 text-sm text-[var(--text)]" role="status">
            {message}
          </p>
        ) : null}
        {previewUrl ? (
          <p className="mt-2 break-all text-xs text-[var(--muted)]">
            Dev/preview link:{" "}
            <a href={previewUrl} className="font-semibold text-[var(--navy)]">
              {previewUrl}
            </a>
          </p>
        ) : null}

        <p className="mt-4 text-xs text-[var(--muted)]">
          <strong className="text-[var(--text)]">On this device:</strong> {localSummary}
        </p>
      </div>

      {userEmail ? (
        <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-[var(--text)]">Alert preferences</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Factual, calm alerts only. Source extracts may lag live boards.
          </p>
          <ul className="mt-4 space-y-2">
            {(
              [
                ["emailEnabled", "Email alerts enabled"],
                ["watchLicense", "License status changes"],
                ["watchDiscipline", "New discipline records"],
                ["watchEntity", "Entity status changes"],
                ["projectPaymentDocs", "Missing payment documentation reminders"],
                ["projectCompletion", "Completion / passport prompts"],
                ["warrantyReminders", "Warranty document reminders"],
              ] as const
            ).map(([key, label]) => (
              <li key={key}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(prefs[key])}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, [key]: e.target.checked }))
                    }
                  />
                  {label}
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={() => void savePrefs()}
            className="mt-4 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold"
          >
            Save preferences
          </button>
        </section>
      ) : null}

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--bg)]/50 p-5">
        <h2 className="text-sm font-semibold text-[var(--text)]">Your data</h2>
        <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
          <li>· Export projects and passport from their pages (print/PDF).</li>
          <li>· Delete a project anytime from the project dashboard.</li>
          <li>· Local-only mode never requires an account.</li>
          <li>· Official records and original documents always control.</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/passport" className="text-sm font-semibold text-[var(--navy)]">
            Home Passport →
          </Link>
          <Link href="/projects" className="text-sm font-semibold text-[var(--navy)]">
            Projects →
          </Link>
        </div>
      </section>
    </div>
  );
}
