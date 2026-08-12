"use client";

import { useState } from "react";
import type { QuestionGroup } from "@/lib/decision/types";
import { flattenQuestions } from "@/lib/decision/questions";
import { copyText } from "@/lib/decision/print";

export function QuestionsList({
  groups,
  title = "Questions to ask",
}: {
  groups: QuestionGroup[];
  title?: string;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [flash, setFlash] = useState<string | null>(null);

  const all = flattenQuestions(groups);
  const selectedList = all.filter((_, i) => selected[`q${i}`]);

  const toggle = (key: string) => {
    setSelected((s) => ({ ...s, [key]: !s[key] }));
  };

  const doCopy = async (text: string, label: string) => {
    try {
      await copyText(text);
      setFlash(label);
      setTimeout(() => setFlash(null), 2000);
    } catch {
      setFlash("Copy failed");
    }
  };

  let idx = 0;

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-sm)] sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Context-aware questions — copy all or select a few. Not legal advice.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)]"
            onClick={() => doCopy(all.map((q, i) => `${i + 1}. ${q}`).join("\n"), "Copied all")}
          >
            Copy all
          </button>
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)]"
            disabled={selectedList.length === 0}
            onClick={() =>
              doCopy(
                selectedList.map((q, i) => `${i + 1}. ${q}`).join("\n"),
                "Copied selected"
              )
            }
          >
            Copy selected
          </button>
        </div>
      </div>
      {flash ? (
        <p className="mt-2 text-xs font-medium text-emerald-800">{flash}</p>
      ) : null}
      <div className="mt-4 space-y-5">
        {groups.map((g) => (
          <div key={g.id}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              {g.title}
            </h3>
            <ul className="mt-2 space-y-2">
              {g.questions.map((q) => {
                const key = `q${idx++}`;
                return (
                  <li key={key}>
                    <label className="flex cursor-pointer gap-2.5 rounded-xl border border-[var(--border)]/80 bg-[var(--bg)]/50 px-3 py-2.5 text-sm leading-relaxed text-[var(--text)] hover:border-[var(--navy)]/20">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[key])}
                        onChange={() => toggle(key)}
                        className="mt-1"
                      />
                      <span>{q}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
