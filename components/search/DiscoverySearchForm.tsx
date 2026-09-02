export function DiscoverySearchForm({ initialQuery = "", compact = false }: { initialQuery?: string; compact?: boolean }) {
  return (
    <form action="/search" method="get" role="search" aria-label="Contractor research search" className="flex flex-col gap-3 sm:flex-row">
      <label className="sr-only" htmlFor={compact ? "discovery-query-compact" : "discovery-query"}>Describe the contractor research you need</label>
      <input id={compact ? "discovery-query-compact" : "discovery-query"} name="q" defaultValue={initialQuery} placeholder="Try roofers in Broward County" autoComplete="off" className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-base text-[var(--text)] shadow-sm outline-none focus:border-[var(--navy)] focus:ring-2 focus:ring-[var(--navy)]/20" />
      <button type="submit" className="rounded-xl bg-[var(--navy)] px-5 py-3 font-semibold text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--navy)] focus:ring-offset-2">Research contractors</button>
    </form>
  );
}
