"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PRE_HIRE_CHECKLIST, RED_FLAG_GUIDE } from "@/lib/decision/checklist";
import { DECISION_ENGINE_DISCLAIMER } from "@/lib/decision/disclaimers";
import { DECISION_KEYS, loadJson, saveJson } from "@/lib/decision/session";
import { generateQuestionGroups } from "@/lib/decision/questions";
import { DecisionJourney } from "./DecisionJourney";
import { QuestionsList } from "./QuestionsList";

export function PreHireChecklistClient() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const saved = loadJson<{ checked?: Record<string, boolean> }>(DECISION_KEYS.checklist);
    if (saved?.checked) setChecked(saved.checked);
  }, []);

  const allIds = useMemo(
    () => PRE_HIRE_CHECKLIST.flatMap((m) => m.items.map((i) => i.id)),
    []
  );
  const done = allIds.filter((id) => checked[id]).length;
  const pct = Math.round((done / allIds.length) * 100);

  const toggle = (id: string) => {
    setChecked((c) => {
      const next = { ...c, [id]: !c[id] };
      saveJson(DECISION_KEYS.checklist, { checked: next, updatedAt: new Date().toISOString() });
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
      <DecisionJourney current="/tools/pre-hire-checklist" />

      <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Pre-hire checklist
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)] sm:text-3xl">
          Before you sign
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          A practical sequence after you have a shortlist. Progress is saved on this device.
          Caution patterns are educational — not accusations.
        </p>

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

      {PRE_HIRE_CHECKLIST.map((mod) => (
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
