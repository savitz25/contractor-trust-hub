"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { discoveryPath, getDiscoveryState } from "@/lib/discovery/config";

const PUBLIC = "florida";

/** Trades shown as primary chips (most common consumer intents). */
const PRIMARY_TRADE_SLUGS = [
  "roofers",
  "general-contractors",
  "building-contractors",
  "air-conditioning",
  "plumbing",
  "residential-contractors",
  "pool-spa",
] as const;

const TRADE_NOTES: Record<string, string> = {
  "general-contractors":
    "CGC — broad construction and remodeling authority under Florida’s general contractor class.",
  "building-contractors":
    "CBC — building construction (commercial and residential) within the building contractor class; not the same as CGC.",
  "residential-contractors":
    "CRC — typically limited to residential (one- and two-family) work, not unrestricted commercial GC work.",
  roofers: "CCC / RR — roof installation and repair. Confirm wind-mitigation and permit needs locally.",
  "air-conditioning": "CAC — HVAC / air-conditioning installation and service.",
  plumbing: "CFC — plumbing installation and repair.",
  mechanical: "CMC — mechanical systems work.",
  "pool-spa": "CPC — pool and spa construction and remodeling.",
  "underground-utility": "CUC — underground utility and related infrastructure work.",
  "specialty-structures": "SCC — specialty structures (e.g. certain enclosures). Confirm scope for your project.",
};

type Props = {
  /** Highlight this section on first paint when linked with #research */
  defaultExpanded?: boolean;
};

export function ResearchBrowse({ defaultExpanded = true }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const state = getDiscoveryState(PUBLIC)!;

  const [countySlug, setCountySlug] = useState<string>(""); // "" = all Florida
  const [tradeSlug, setTradeSlug] = useState<string>(""); // "" = any / county only

  const primaryTrades = useMemo(
    () =>
      PRIMARY_TRADE_SLUGS.map((slug) => state.trades.find((t) => t.slug === slug)).filter(
        Boolean
      ) as typeof state.trades,
    [state.trades]
  );

  const moreTrades = useMemo(
    () => state.trades.filter((t) => !PRIMARY_TRADE_SLUGS.includes(t.slug as (typeof PRIMARY_TRADE_SLUGS)[number])),
    [state.trades]
  );

  const destination = useMemo(() => {
    return discoveryPath(state, {
      countySlug: countySlug || undefined,
      tradeSlug: tradeSlug || undefined,
    });
  }, [state, countySlug, tradeSlug]);

  const destinationLabel = useMemo(() => {
    const county = countySlug
      ? state.counties.find((c) => c.slug === countySlug)?.name
      : null;
    const trade = tradeSlug ? state.trades.find((t) => t.slug === tradeSlug)?.label : null;
    if (county && trade) return `${trade} in ${county} County`;
    if (county) return `All trades in ${county} County`;
    if (trade) return `Florida ${trade} (statewide)`;
    return "All Florida counties & trades";
  }, [state, countySlug, tradeSlug]);

  const tradeNote = tradeSlug ? TRADE_NOTES[tradeSlug] : null;

  function go() {
    startTransition(() => {
      router.push(destination);
    });
  }

  function selectTrade(slug: string) {
    setTradeSlug((prev) => (prev === slug ? "" : slug));
  }

  if (!defaultExpanded) return null;

  return (
    <section
      id="research"
      className="scroll-mt-28 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-6 md:p-8"
      aria-labelledby="research-heading"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Research path
      </p>
      <h2
        id="research-heading"
        className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl"
      >
        Browse by location and trade
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Don&apos;t have a specific company yet? Choose a county and/or contractor type to open
        Florida license evidence lists. Same Trust Report data as search — not a marketplace or
        lead board.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* County */}
        <div>
          <label
            htmlFor="research-county"
            className="block text-sm font-medium text-[var(--text)]"
          >
            1. Where is the work?
          </label>
          <select
            id="research-county"
            value={countySlug}
            onChange={(e) => setCountySlug(e.target.value)}
            className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--text)] shadow-[var(--shadow-sm)] outline-none ring-[var(--accent)] focus:ring-2"
          >
            <option value="">All Florida</option>
            {state.counties.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name} County
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-[var(--muted)]">
            County comes from the address on the board license extract.
          </p>
        </div>

        {/* Trade */}
        <div>
          <p className="text-sm font-medium text-[var(--text)]">2. What type of contractor?</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Optional — leave open to browse every trade in that area.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {primaryTrades.map((t) => {
              const active = tradeSlug === t.slug;
              return (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => selectTrade(t.slug)}
                  aria-pressed={active}
                  className={
                    active
                      ? "rounded-full border border-[var(--navy)]/20 bg-[var(--accent-soft)] px-3 py-1.5 text-sm font-medium text-[var(--navy)]"
                      : "rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm text-[var(--muted)] transition hover:border-[var(--navy)]/20 hover:text-[var(--text)]"
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          {moreTrades.length > 0 && (
            <div className="mt-3">
              <label htmlFor="research-trade-more" className="sr-only">
                More trades
              </label>
              <select
                id="research-trade-more"
                value={
                  moreTrades.some((t) => t.slug === tradeSlug) ? tradeSlug : ""
                }
                onChange={(e) => setTradeSlug(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 text-sm text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2"
              >
                <option value="">More trades...</option>
                {moreTrades.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {tradeNote && (
        <p className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--panel)]/80 px-4 py-3 text-sm leading-relaxed text-[var(--muted)]">
          <span className="font-medium text-[var(--text)]">License note: </span>
          {tradeNote}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 order-2 sm:order-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            You&apos;ll open
          </p>
          <p className="mt-1 text-sm text-[var(--text)]">{destinationLabel}</p>
          <p className="mt-0.5 truncate font-mono text-xs text-[var(--muted)]">{destination}</p>
        </div>
        <button
          type="button"
          onClick={go}
          disabled={pending}
          className="order-1 min-h-12 w-full shrink-0 rounded-xl bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--navy)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70 sm:order-2 sm:w-auto"
        >
          {pending ? "Opening..." : "Browse license records"}
        </button>
      </div>

      <div className="mt-6 border-t border-[var(--border)] pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Popular starting points
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { href: "/florida/miami-dade/roofers", label: "Miami-Dade roofers" },
            { href: "/florida/broward/air-conditioning", label: "Broward A/C" },
            { href: "/florida/orange/general-contractors", label: "Orange general contractors" },
            { href: "/florida/duval/plumbing", label: "Duval plumbing" },
            { href: "/florida/roofers", label: "Roofers statewide" },
            { href: "/florida", label: "Full Florida map" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-xs text-[var(--text)] no-underline hover:border-[var(--accent)]/40"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
