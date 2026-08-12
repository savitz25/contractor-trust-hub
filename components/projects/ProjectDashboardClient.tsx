"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CompleteProjectModal } from "@/components/passport/CompleteProjectModal";
import {
  projectPacketHtml,
  printHtmlDocument,
} from "@/lib/passport/export";
import { PaymentsPanel } from "./PaymentsPanel";
import { WatchButton } from "./WatchButton";
import { PROTECTION_DISCLAIMER } from "@/lib/projects/disclaimers";
import {
  addDocument,
  deleteProject,
  getAnalysis,
  getProject,
  listAlerts,
  markAlertRead,
  toggleMilestone,
  updateProject,
} from "@/lib/projects/store";
import type {
  Project,
  ProjectDocumentKind,
  ProjectStatus,
  WatchAlert,
} from "@/lib/projects/types";
import { formatUsd } from "@/lib/plan/cost-model";

const STATUS_OPTS: ProjectStatus[] = [
  "planning",
  "under_contract",
  "in_progress",
  "complete",
];

const DOC_KINDS: { id: ProjectDocumentKind; label: string }[] = [
  { id: "scope", label: "Scope summary" },
  { id: "quote", label: "Quote" },
  { id: "contract", label: "Signed contract" },
  { id: "coi", label: "COI" },
  { id: "permit", label: "Permit" },
  { id: "change_order", label: "Change order" },
  { id: "lien_waiver", label: "Lien waiver" },
  { id: "photo", label: "Photo / inspection" },
  { id: "other", label: "Other" },
];

export function ProjectDashboardClient({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<"overview" | "payments" | "docs" | "alerts">(
    "overview"
  );
  const [docKind, setDocKind] = useState<ProjectDocumentKind>("contract");
  const [docLabel, setDocLabel] = useState("");
  const [alerts, setAlerts] = useState<WatchAlert[]>([]);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [doneFlash, setDoneFlash] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setProject(getProject(projectId));
    setAlerts(
      listAlerts().filter(
        (a) =>
          a.projectId === projectId ||
          (getProject(projectId)?.contractorSlug &&
            a.contractorSlug === getProject(projectId)?.contractorSlug)
      )
    );
  }, [projectId]);

  useEffect(() => {
    refresh();
    const t = searchParams.get("tab");
    if (t === "payments" || t === "docs" || t === "alerts" || t === "overview") {
      setTab(t);
    }
    const onCh = () => refresh();
    window.addEventListener("cth-projects-change", onCh);
    return () => window.removeEventListener("cth-projects-change", onCh);
  }, [refresh, searchParams]);

  if (!project) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="font-semibold text-amber-950">Project not found on this device</p>
        <Link href="/projects" className="mt-3 inline-block text-sm font-semibold">
          ← All projects
        </Link>
      </div>
    );
  }

  const analysis = project.contractAnalysisId
    ? getAnalysis(project.contractAnalysisId)
    : null;
  const done = project.milestones.filter((m) => m.done).length;

  const toolsQs = new URLSearchParams();
  if (project.projectType) toolsQs.set("type", project.projectType);
  if (project.zip) toolsQs.set("zip", project.zip);
  if (project.city) toolsQs.set("city", project.city);
  if (project.contractorSlug) toolsQs.set("contractor", project.contractorSlug);
  if (project.contractorName) toolsQs.set("name", project.contractorName);
  const qs = toolsQs.toString() ? `?${toolsQs.toString()}` : "";

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/projects" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
          ← Projects
        </Link>
      </div>

      <header className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Project protection dashboard
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)] sm:text-3xl">
          {project.title}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {project.projectType.replace(/_/g, " ")}
          {project.address ? ` · ${project.address}` : ""}
          {project.contractAmount != null
            ? ` · Contract ${formatUsd(project.contractAmount)}`
            : ""}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="text-xs text-[var(--muted)]">
            Status{" "}
            <select
              value={project.status}
              onChange={(e) => {
                const u = updateProject(project.id, {
                  status: e.target.value as ProjectStatus,
                });
                if (u) setProject(u);
              }}
              className="ml-1 rounded-lg border border-[var(--border)] px-2 py-1 text-sm text-[var(--text)]"
            >
              {STATUS_OPTS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <span className="text-xs text-[var(--muted)]">
            Milestones {done}/{project.milestones.length}
          </span>
          {project.status !== "complete" ? (
            <button
              type="button"
              onClick={() => setCompleteOpen(true)}
              className="rounded-lg bg-[var(--navy)] px-3 py-1.5 text-xs font-semibold text-white"
            >
              Mark project complete
            </button>
          ) : (
            <Link
              href="/passport"
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold no-underline"
            >
              View Home Passport
            </Link>
          )}
          <button
            type="button"
            onClick={() =>
              printHtmlDocument(
                `Project packet — ${project.title}`,
                projectPacketHtml(project, analysis)
              )
            }
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold"
          >
            Export project packet
          </button>
        </div>
        {doneFlash ? (
          <p className="mt-2 text-xs font-medium text-emerald-800">{doneFlash}</p>
        ) : null}

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--border)]">
          <div
            className="h-full rounded-full bg-[var(--navy)]"
            style={{
              width: `${Math.round((done / project.milestones.length) * 100)}%`,
            }}
          />
        </div>
      </header>

      <nav className="flex flex-wrap gap-1 rounded-2xl border border-[var(--border)] bg-white p-1">
        {(
          [
            ["overview", "Overview"],
            ["payments", "Payments"],
            ["docs", "Documents"],
            ["alerts", "Alerts"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold ${
              tab === id
                ? "bg-[var(--navy)] text-white"
                : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {label}
            {id === "alerts" && alerts.filter((a) => !a.read).length
              ? ` (${alerts.filter((a) => !a.read).length})`
              : ""}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <div className="space-y-5">
          {/* Contractor */}
          <section className="rounded-3xl border border-[var(--border)] bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
              Verified contractor
            </h2>
            {project.contractorName || project.contractorSlug ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--text)]">
                    {project.contractorName || project.contractorSlug}
                  </p>
                  {project.contractorLicenseKey ? (
                    <p className="font-mono text-xs text-[var(--accent)]">
                      {project.contractorLicenseKey}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {project.contractorSlug ? (
                    <>
                      <Link
                        href={`/contractors/${encodeURIComponent(project.contractorSlug)}`}
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold no-underline"
                      >
                        Trust Report
                      </Link>
                      <WatchButton
                        slug={project.contractorSlug}
                        name={project.contractorName || project.contractorSlug}
                        licenseKey={project.contractorLicenseKey}
                        projectId={project.id}
                        compact
                      />
                    </>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">
                No contractor linked.{" "}
                <Link href="/verify" className="font-semibold text-[var(--navy)]">
                  Verify someone
                </Link>
              </p>
            )}
          </section>

          {/* Milestones */}
          <section className="rounded-3xl border border-[var(--border)] bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
              Milestones
            </h2>
            <ul className="mt-3 space-y-2">
              {project.milestones.map((m) => (
                <li key={m.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)]/80 px-3 py-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={m.done}
                      onChange={() => {
                        const u = toggleMilestone(project.id, m.id);
                        if (u) setProject(u);
                      }}
                    />
                    <span className={m.done ? "text-[var(--muted)] line-through" : ""}>
                      {m.label}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          {analysis ? (
            <section className="rounded-3xl border border-[var(--border)] bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
                Linked contract analysis
              </h2>
              <p className="mt-2 text-sm text-[var(--text)]">
                Present {analysis.counts.present} · Missing {analysis.counts.missing} · Unclear{" "}
                {analysis.counts.unclear}
              </p>
              <Link
                href="/tools/contract-analyzer"
                className="mt-2 inline-block text-xs font-semibold text-[var(--navy)]"
              >
                Re-open analyzer →
              </Link>
            </section>
          ) : null}

          {/* Tools */}
          <section className="rounded-3xl border border-[var(--accent)]/35 bg-[var(--accent-soft)] p-5">
            <h2 className="text-sm font-semibold text-[var(--text)]">Tools shortcuts</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                [`/tools/contract-analyzer${qs}`, "Contract Analyzer"],
                [`/tools/quote-analyzer${qs}`, "Quote Analyzer"],
                [`/tools/pre-hire-checklist${qs}`, "Checklist"],
                [`/tools/permit-planner${qs}`, "Permit Planner"],
                [project.propertyId ? `/property/${project.propertyId}` : "/property", "Property"],
                [`/tools/scope-builder${qs}`, "Scope Builder"],
              ].map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline"
                >
                  {label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "payments" ? (
        <PaymentsPanel project={project} onChange={setProject} />
      ) : null}

      {tab === "docs" ? (
        <section className="space-y-4 rounded-3xl border border-[var(--border)] bg-white p-5">
          <h2 className="text-lg font-semibold text-[var(--text)]">Documents</h2>
          <p className="text-xs text-[var(--muted)]">
            v1 stores labels/notes on this device only — not file binaries. Keep originals in your
            own files too.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              Type
              <select
                value={docKind}
                onChange={(e) => setDocKind(e.target.value as ProjectDocumentKind)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
              >
                {DOC_KINDS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Label / note
              <input
                value={docLabel}
                onChange={(e) => setDocLabel(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                placeholder="e.g. Signed contract 2026-03-01"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!docLabel.trim()) return;
              const u = addDocument(project.id, {
                kind: docKind,
                label: docLabel.trim(),
              });
              if (u) {
                setProject(u);
                setDocLabel("");
              }
            }}
            className="rounded-xl bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white"
          >
            Add document note
          </button>
          <ul className="space-y-2">
            {project.documents.length === 0 ? (
              <li className="text-sm text-[var(--muted)]">No documents logged.</li>
            ) : (
              project.documents.map((d) => (
                <li
                  key={d.id}
                  className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <span className="text-xs font-semibold uppercase text-[var(--muted)]">
                    {d.kind}
                  </span>
                  <p className="font-medium text-[var(--text)]">{d.label}</p>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      {tab === "alerts" ? (
        <section className="rounded-3xl border border-[var(--border)] bg-white p-5">
          <h2 className="text-lg font-semibold text-[var(--text)]">Watch alerts</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Detected when you open this app / Trust Report — not real-time board push.
          </p>
          {alerts.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">No alerts yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className={`rounded-xl border px-3 py-3 text-sm ${
                    a.read
                      ? "border-[var(--border)] bg-[var(--bg)]/40"
                      : "border-amber-200 bg-amber-50/80"
                  }`}
                >
                  <p className="font-medium text-[var(--text)]">{a.message}</p>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    {a.contractorName} · {new Date(a.detectedAt).toLocaleString()}
                  </p>
                  {!a.read ? (
                    <button
                      type="button"
                      className="mt-2 text-xs font-semibold text-[var(--navy)]"
                      onClick={() => {
                        markAlertRead(a.id);
                        refresh();
                      }}
                    >
                      Mark read
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            if (confirm("Delete this project from this device?")) {
              deleteProject(project.id);
              window.location.href = "/projects";
            }
          }}
          className="text-xs font-medium text-rose-800"
        >
          Delete project
        </button>
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--muted)]">{PROTECTION_DISCLAIMER}</p>

      {completeOpen ? (
        <CompleteProjectModal
          project={project}
          onClose={() => setCompleteOpen(false)}
          onDone={(next, passportId) => {
            setProject(next);
            setCompleteOpen(false);
            setDoneFlash(
              passportId
                ? "Project completed and saved to Home Passport."
                : "Project marked complete."
            );
          }}
        />
      ) : null}
    </div>
  );
}
