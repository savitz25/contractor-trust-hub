"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PRE_HIRE_CHECKLIST, RED_FLAG_GUIDE } from "@/lib/decision/checklist";
import { DECISION_ENGINE_DISCLAIMER } from "@/lib/decision/disclaimers";
import { DECISION_KEYS, loadJson, saveJson } from "@/lib/decision/session";
import { generateQuestionGroups } from "@/lib/decision/questions";
import { trackFunnel } from "@/lib/funnel/analytics";
import { saveJourneyContext } from "@/lib/funnel/journey-context";
import { DecisionJourney } from "./DecisionJourney";
import { QuestionsList } from "./QuestionsList";

/** NJ-safe checklist filters Florida-specific workers' comp / Sunbiz wording. */
const NJ_HIDDEN_ITEM_IDS = new Set(["wc", "entity"]);

export function PreHireChecklistClient() {
  const searchParams = useSearchParams();
  const isNj = (searchParams.get("state") || "").toLowerCase() === "nj";
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const saved = loadJson<{ checked?: Record<string, boolean> }>(DECISION_KEYS.checklist);
    if (saved?.checked) setChecked(saved.checked);
    trackFunnel("checklist_started", { state: isNj ? "nj" : "fl" });
    const c = searchParams.get("contractor");
    const n = searchParams.get("name");
    if (c || n) {
      saveJourneyContext({
        contractorSlug: c || undefined,
        contractorName: n || undefined,
        entryPath: "tools",
      });
    }
  }, [isNj, searchParams]);

  const modules = useMemo(() => {
    if (!isNj) return PRE_HIRE_CHECKLIST;
    return PRE_HIRE_CHECKLIST.map((mod) => ({
      ...mod,
      title:
        mod.id === "identity"
          ? "1. Verify identity & registration"
          : mod.id === "discipline"
            ? "2. Review enforcement / caution signals"
            : mod.title,
      items: mod.items
        .filter((i) => !NJ_HIDDEN_ITEM_IDS.has(i.id))
        .map((i) => {
          if (i.id === "active_license") {
            return {
              ...i,
              title: "Confirm active/current registration status on the NJ Trust Report",
              why: "Inactive or expired credentials are a hard stop until resolved on official NJ tools.",
              hrefs: [{ href: "/verify?state=nj", label: "NJ Verify" }],
            };
          }
          if (i.id === "correct_class") {
            return {
              ...i,
              title: "Confirm credential type fits the work (e.g. HIC vs trade-specific)",
              why: "A valid registration of the wrong type may not authorize the work you need.",
            };
          }
          if (i.id === "discipline_rows") {
            return {
              ...i,
              title: "Read any public enforcement entries on the Trust Report",
              why: "Enforcement rows are evidence, not a score — understand what the extract shows and when.",
            };
          }
          return i;
        }),
    }));
  }, [isNj]);

  const allIds = useMemo(
    () => modules.flatMap((m) => m.items.map((i) => i.id)),
    [modules]
  );
  const done = allIds.filter((id) => checked[id]).length;
  const pct = Math.round((done / Math.max(allIds.length, 1)) * 100);

  const toggle = (id: string) => {
    setChecked((c) => {
      const next = { ...c, [id]: !c[id] };
      saveJson(DECISION_KEYS.checklist, { checked: next, updatedAt: new Date().toISOString() });
      const doneCount = allIds.filter((x) => next[x]).length;
      if (doneCount >= allIds.length && allIds.length > 0) {
        trackFunnel("checklist_completed", { state: isNj ? "nj" : "fl" });
      }
      return next;
    });
  };

  const questions = useMemo(
    () =>
      generateQuestionGroups({
        projectType: "general_contracting",
      }),
    []
  );

  return (
    <div className="space-y-6">
      {!isNj ? <DecisionJourney current="/tools/pre-hire-checklist" /> : null}

      <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          {isNj ? "Pre-hire checklist · New Jersey" : "Pre-hire checklist"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)] sm:text-3xl">
          Before you sign
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          {isNj
            ? "NJ-safe educational checklist — registration and evidence first. Florida-specific workers’ comp and Sunbiz items are hidden. Progress is saved on this device."
            : "A practical sequence after you have a shortlist. Progress is saved on this device. Caution patterns are educational — not accusations."}
        </p>
        {isNj ? (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Florida full journey remains at{" "}
            <Link href="/verify" className="font-semibold text-[var(--navy)]">
              /verify
            </Link>
            .{" "}
            <Link href="/verify?state=nj" className="font-semibold text-[var(--navy)]">
              Back to NJ Verify
            </Link>
          </p>
        ) : null}

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--muted)]">
            <span>
              {done} of {allIds.length} complete
            </span>
            <span>{pct}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="h-full rounded-full bg-[var(--navy)] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {modules.map((mod) => (
        <section
          key={mod.id}
          className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6"
        >
          <h2 className="text-base font-semibold text-[var(--text)]">{mod.title}</h2>
          <ul className="mt-3 space-y-3">
            {mod.items.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer gap-3 rounded-2xl border border-[var(--border)]/80 bg-[var(--bg)]/40 px-3 py-3 hover:border-[var(--navy)]/20">
                  <input
                    type="checkbox"
                    checked={Boolean(checked[item.id])}
                    onChange={() => toggle(item.id)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[var(--text)]">
                      {item.title}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">
                      Why this matters: {item.why}
                    </span>
                    {item.hrefs?.length ? (
                      <span className="mt-2 flex flex-wrap gap-2">
                        {item.hrefs.map((h) => (
                          <Link
                            key={h.href}
                            href={h.href}
                            className="text-xs font-semibold text-[var(--navy)] no-underline hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {h.label} →
                          </Link>
                        ))}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="rounded-3xl border border-amber-200/80 bg-amber-50/60 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-amber-950">Red flag guide</h2>
        <p className="mt-1 text-sm text-amber-950/80">
          Patterns to watch for — not proof of wrongdoing by any named party.
        </p>
        <ul className="mt-4 space-y-3">
          {RED_FLAG_GUIDE.map((r) => (
            <li key={r.title} className="rounded-2xl border border-amber-200/90 bg-white/80 px-4 py-3">
              <p className="text-sm font-semibold text-amber-950">{r.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-amber-950/85">{r.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <QuestionsList groups={questions} title="Questions if anything is still unclear" />

      <p className="text-[11px] leading-relaxed text-[var(--muted)]">{DECISION_ENGINE_DISCLAIMER}</p>
    </div>
  );
}
