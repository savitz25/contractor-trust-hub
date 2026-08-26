import Link from "next/link";

const NEXT = [
  { href: "/verify", label: "Search a contractor" },
  { href: "#categories", label: "Browse by trade" },
  { href: "#geography", label: "Browse by county" },
  { href: "#education", label: "Learn how Florida licensing works" },
  { href: "/guides/how-to-verify-florida-contractor", label: "Verification checklist" },
  { href: "/methodology", label: "Methodology" },
];

export function IntelligenceContinue() {
  return (
    <section id="continue" aria-labelledby="continue-heading" className="scroll-mt-24">
      <h2 id="continue-heading" className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
        Continue your research
      </h2>
      <ul className="mt-4 flex flex-wrap gap-2">
        {NEXT.map((n) => (
          <li key={n.href + n.label}>
            <Link
              href={n.href}
              className="inline-flex min-h-11 items-center rounded-full border border-[var(--navy)] bg-[var(--navy)] px-4 py-2 text-sm font-medium text-white no-underline hover:opacity-90"
            >
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
