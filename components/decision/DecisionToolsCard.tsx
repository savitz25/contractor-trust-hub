import Link from "next/link";

export function DecisionToolsLinks({
  projectType,
  scale,
  zip,
  city,
  studioSlug,
  contractorSlug,
  contractorName,
  compact,
}: {
  projectType?: string;
  scale?: string;
  zip?: string;
  city?: string;
  studioSlug?: string;
  contractorSlug?: string;
  contractorName?: string;
  compact?: boolean;
}) {
  const q = new URLSearchParams();
  if (projectType) q.set("type", projectType);
  if (scale) q.set("scale", scale);
  if (zip) q.set("zip", zip);
  if (city) q.set("city", city);
  if (studioSlug) q.set("studio", studioSlug);
  if (contractorSlug) q.set("contractor", contractorSlug);
  if (contractorName) q.set("name", contractorName);
  const qs = q.toString() ? `?${q.toString()}` : "";

  const propertyQs = new URLSearchParams();
  if (zip) propertyQs.set("zip", zip);
  if (city) propertyQs.set("city", city);
  const pqs = propertyQs.toString() ? `?${propertyQs.toString()}` : "";

  const links = [
    {
      href: `/projects${qs}`,
      label: "Protect project",
      hint: "Dashboard, payments, watches",
    },
    {
      href: `/tools/contract-analyzer${qs}`,
      label: "Analyze contract",
      hint: "Missing / unclear terms",
    },
    {
      href: `/property${pqs}`,
      label: "Add property context",
      hint: "Check address / permit signals",
    },
    {
      href: `/tools/permit-planner${qs}`,
      label: "Permit planner",
      hint: "Likely permits & inspections",
    },
    {
      href: `/tools/scope-builder${qs}`,
      label: "Build scope",
      hint: "Contractor-ready scope summary",
    },
    {
      href: `/tools/quote-analyzer${qs}`,
      label: "Analyze a quote",
      hint: "Gaps, flags, and questions",
    },
    {
      href: `/tools/compare-bids${qs}`,
      label: "Compare bids",
      hint: "2–4 estimates side by side",
    },
    {
      href: `/tools/pre-hire-checklist${qs}`,
      label: "Pre-hire checklist",
      hint: "Before you sign",
    },
  ];

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline hover:border-[var(--navy)]/30"
          >
            {l.label}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-[var(--accent)]/35 bg-[var(--accent-soft)] p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
        Decision tools
      </p>
      <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">
        Property, permits, scope, quotes, verify, checklist
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Educational tools to prepare before you hire — not rankings or marketplace bids.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 no-underline shadow-[var(--shadow-sm)] transition hover:border-[var(--navy)]/25"
          >
            <p className="text-sm font-semibold text-[var(--navy)]">{l.label}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{l.hint}</p>
          </Link>
        ))}
      </div>
      <Link
        href="/tools"
        className="mt-3 inline-block text-xs font-semibold text-[var(--navy)] no-underline hover:underline"
      >
        All decision tools
      </Link>
    </div>
  );
}
