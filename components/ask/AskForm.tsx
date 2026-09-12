"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ASK_CHIPS, ASK_EXAMPLES } from "@/lib/ask/interpret";
import { askHref, type AskUrlOverrides } from "@/lib/ask/url";
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
  overrides={},
}: {
  initialQuery?: string;
  compact?: boolean;
  overrides?:AskUrlOverrides;
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
    window.dispatchEvent(new CustomEvent("specialist-search", { detail: { event: "specialist_search_submit", hub: "contractor", hasIdentifier: /[A-Z]{2,4}\d{5,10}/i.test(query) } }));
    router.push(askHref(query, Object.fromEntries(Object.entries(overrides).filter(([key])=>key!=="page"&&(q===initialQuery||!["geoAction","geoChoice","geo"].includes(key))))));
  }

  return (
    <form
      data-compact={compact || undefined}
      className="space-y-3"
      action="/ask"
      method="get"
      onSubmit={(e) => {
        const query = q.trim();
        if (!query) { e.preventDefault(); return; }
        saveRecent(query);
        window.dispatchEvent(new CustomEvent("specialist-search", { detail: { event: "specialist_search_submit", hub: "contractor", hasIdentifier: /[A-Z]{2,4}\d{5,10}/i.test(query) } }));
      }}
    >
      {Object.entries(overrides).filter(([key])=>!["page","geo","trade","status","evidence"].includes(key)&&(q===initialQuery||!["geoAction","geoChoice"].includes(key))).map(([key,value])=>value?<input key={key} type="hidden" name={key} value={value}/>:null)}
      <label htmlFor="ask-q" className="sr-only">
        Ask ContractorTrustHub
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
      <input
        id="ask-q"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        maxLength={180}
        className="th-field-hero min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-[16px] text-[var(--text)]"
        placeholder="Ask a question, enter a company, license, trade, city, county or state…"
      />
      <button type="submit" className="th-btn-hero shrink-0 px-6">Research</button>
      </div>
      {typos.length > 0 && !(overrides.geoAction==="correct"&&q===initialQuery) ? (
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
      <details className="rounded-xl border border-[var(--border)] bg-white p-4">
        <summary className="cursor-pointer font-semibold text-[var(--navy)]">Advanced filters</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">State<select name="geo" defaultValue={overrides.geo??""} className="mt-1 w-full rounded-lg border p-2"><option value="">From question</option><option value="fl">Florida</option>{overrides.geo&&overrides.geo!=="fl"?<option value={overrides.geo}>{overrides.geo.replaceAll("-"," ")}</option>:null}</select></label>
          <label className="text-sm">Trade<select name="trade" defaultValue={overrides.trade??""} className="mt-1 w-full rounded-lg border p-2"><option value="">From question</option><option value="roofing">Roofing</option><option value="plumbing">Plumbing</option><option value="hvac">HVAC</option><option value="general">General</option>{["building","residential","pool_spa","mechanical","home_improvement","solar","alarm","telecom","locksmith","hearth","-"].map(value=><option key={value} value={value}>{value==="-"?"Any trade":value.replaceAll("_"," ")}</option>)}</select></label>
          <label className="text-sm">Credential status<select name="status" defaultValue={overrides.status??""} className="mt-1 w-full rounded-lg border p-2"><option value="">From question</option><option value="active_current">Active/current</option><option value="all">All published</option><option value="expired">Expired/inactive</option><option value="-">Any status</option></select></label>
          <label className="text-sm">Evidence<select name="evidence" defaultValue={overrides.evidence??""} className="mt-1 w-full rounded-lg border p-2"><option value="">From question</option><option value="dbpr_discipline">DBPR discipline</option><option value="stop_work">Stop-work</option><option value="unlicensed_activity">Unlicensed activity</option><option value="recovery_fund">Recovery fund</option><option value="-">No evidence filter</option></select></label>
        </div>
      </details>
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
