"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ASK_CHIPS, ASK_EXAMPLES } from "@/lib/ask/interpret";
import { askHref } from "@/lib/ask/url";
import { suggestAskCompletions } from "@/lib/ask/suggest";
import { applyTypoSuggestion, suggestTypos } from "@/lib/ask/typos";

const RECENT_KEY = "cth-ask-recent-v1";

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

function saveRecent(q: string) {
  const next = [q, ...loadRecent().filter((x) => x !== q)].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function AskForm({
  initialQuery = ASK_EXAMPLES[0],
  compact = false,
}: {
  initialQuery?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [recent, setRecent] = useState<string[]>([]);
  const suggestions = useMemo(() => suggestAskCompletions(q), [q]);
  const typos = useMemo(() => suggestTypos(q), [q]);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  function go(next: string) {
    const query = next.trim();
    if (!query) return;
    saveRecent(query);
    setRecent(loadRecent());
    router.push(askHref(query));
  }

  return (
    <form
      className="space-y-3"
      action="/ask"
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        go(q);
      }}
    >
      <label htmlFor="ask-q" className="sr-only">
        Ask ContractorTrustHub
      </label>
      <textarea
        id="ask-q"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        rows={compact ? 2 : 3}
        className="th-field-hero w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-[16px] text-[var(--text)]"
        placeholder="Show me active roofing contractors in Broward County."
      />
      {typos.length > 0 ? (
        <p className="text-sm text-[var(--muted)]">
          Did you mean{" "}
          {typos.map((t) => (
            <button
              key={t.from}
              type="button"
              className="font-semibold text-[var(--navy)] underline-offset-2 hover:underline"
              onClick={() => setQ(applyTypoSuggestion(q, t.from, t.to))}
            >
              {t.label}
            </button>
          ))}
          ? We will not silently change the query.
        </p>
      ) : null}
      {suggestions.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Ask suggestions">
          {suggestions.map((s) => (
            <li key={`${s.kind}-${s.label}`}>
              <button
                type="button"
                className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)]"
                onClick={() => setQ(s.prompt)}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="submit" className="th-btn-hero px-6">
        Research this question
      </button>
      <div className="flex flex-wrap gap-2" aria-label="Example research questions">
        {ASK_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)]"
            onClick={() => go(chip.prompt)}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {recent.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Recent research</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {recent.map((item) => (
              <li key={item}>
                <button type="button" className="text-xs text-[var(--navy)] hover:underline" onClick={() => go(item)}>
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
