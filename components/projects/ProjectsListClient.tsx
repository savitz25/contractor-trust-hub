"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PROJECT_TYPES } from "@/lib/plan/project-types";
import { loadPropertyContext } from "@/lib/property/session";
import { PROTECTION_DISCLAIMER } from "@/lib/projects/disclaimers";
import { createProject, listProjects } from "@/lib/projects/store";
import type { Project, ProjectStatus } from "@/lib/projects/types";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  under_contract: "Under contract",
  in_progress: "In progress",
  complete: "Complete",
};

export function ProjectsListClient() {
  const sp = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [projectType, setProjectType] = useState(sp.get("type") || "kitchen_remodel");
  const [flash, setFlash] = useState<string | null>(null);

  const refresh = () => setProjects(listProjects());

  useEffect(() => {
    refresh();
    // Prefill create from query (studio/property handoff)
    if (sp.get("name") && !title) {
      setTitle(`${sp.get("name")} project`);
    }
  }, [sp, title]);

  const create = () => {
    const prop = loadPropertyContext();
    const p = createProject({
      title: title || undefined,
      projectType,
      zip: sp.get("zip") || prop?.zip,
      city: sp.get("city") || prop?.city || undefined,
      county: prop?.county || undefined,
      address: prop?.normalizedAddress,
      propertyId: prop?.propertyId,
      contractorSlug: sp.get("contractor") || undefined,
      contractorName: sp.get("name") || undefined,
      watchContractor: sp.get("watch") === "1",
    });
    setFlash(`Created “${p.title}”`);
    setTitle("");
    refresh();
    window.location.href = `/projects/${p.id}`;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Project protection
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)] sm:text-3xl">
          Your projects
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          Session-first workspace for contracts, payments, milestones, and contractor watches.
          Stored on this device only in v1.
        </p>

        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--bg)]/40 p-4">
          <h2 className="text-sm font-semibold text-[var(--text)]">Create project</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs sm:col-span-2">
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                placeholder="Kitchen remodel — Ocean Dr"
              />
            </label>
            <label className="block text-xs sm:col-span-2">
              Project type
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              >
                {PROJECT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={create}
            className="mt-3 rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Create protected project
          </button>
          {flash ? <p className="mt-2 text-xs text-emerald-800">{flash}</p> : null}
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border)] px-5 py-10 text-center">
          <p className="font-medium text-[var(--text)]">No projects yet</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Create one after verifying a contractor, analyzing a contract, or attaching a property.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link
              href="/tools/contract-analyzer"
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold no-underline"
            >
              Analyze a contract
            </Link>
            <Link
              href="/verify"
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold no-underline"
            >
              Verify contractor
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => {
            const done = p.milestones.filter((m) => m.done).length;
            const total = p.milestones.length;
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="block rounded-2xl border border-[var(--border)] bg-white px-4 py-4 no-underline shadow-[var(--shadow-sm)] transition hover:border-[var(--navy)]/25"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[var(--text)]">{p.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        {p.projectType.replace(/_/g, " ")}
                        {p.contractorName ? ` · ${p.contractorName}` : ""}
                        {p.address ? ` · ${p.address}` : p.zip ? ` · ${p.zip}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--muted)]">
                      {STATUS_LABEL[p.status]}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                    <div
                      className="h-full rounded-full bg-[var(--navy)]"
                      style={{ width: `${Math.round((done / total) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    {done}/{total} milestones · {p.payments.length} payment(s)
                    {p.watchContractor ? " · watching contractor" : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[11px] leading-relaxed text-[var(--muted)]">{PROTECTION_DISCLAIMER}</p>
    </div>
  );
}
