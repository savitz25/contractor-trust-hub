import type { Metadata } from "next";
import Link from "next/link";
import { GuideCtaRow, GuideH2, GuideShell } from "@/components/guides/GuideShell";
import { getGuideBySlug } from "@/lib/guides/registry";
import { pageMetadata } from "@/lib/seo/page-meta";

const guide = getGuideBySlug("florida-contractor-red-flags")!;

export const metadata: Metadata = pageMetadata({
  title: guide.seoTitle,
  description: guide.description,
  path: guide.path,
  ogType: "article",
});

const flags = [
  {
    title: "No license they can show — or a number that does not match",
    body: "Ask for the full Florida construction license id and look it up yourself. If the number, name, or class does not match the person on your contract, stop and verify before paying a deposit.",
    record: "Search Verify by license number first. Compare the Trust Report name to your contract.",
  },
  {
    title: "The license class does not fit the work",
    body: "A roofing job typically needs a roofing class (CCC or RR), not a substitute “we do everything” story. Remodels and specialty trades have their own classes. Ask who will pull the permit for each trade.",
    record: "Read the occupation label on the Trust Report. See the license-types guide for CBC, CGC, CRC, CCC, and CFC.",
  },
  {
    title: "Pressure to pay cash today or skip a written contract",
    body: "Rushed deposits, “today-only” pricing, and handshake scopes are process risks. Public records cannot prove a contractor is trustworthy — they can only show what is on file.",
    record: "Use Plan or a decision checklist to write scope before you sign. We do not collect bids.",
  },
  {
    title: "No talk of permits, inspections, or who holds the permit",
    body: "Many Florida roof, electrical, plumbing, and structural jobs require local permits. Reluctance to discuss permitting is a practical warning sign — not a license status by itself.",
    record: "Permit research is local. Check your address tools and still confirm with the city or county.",
  },
  {
    title: "Business name on the invoice does not match the license or Sunbiz filing",
    body: "DBAs happen. Invented company names on the contract are harder to defend later. Match the legal name when a high-confidence Sunbiz link exists.",
    record: "Trust Reports only show Sunbiz when our exact-match rules fire. No link is unknown — not “cleared.”",
  },
  {
    title: "Discipline on file that nobody will discuss",
    body: "A past board action is not an automatic disqualification. Refusing to discuss dates and outcomes is a reason to read the extract yourself and confirm on the official board.",
    record: "Open the Discipline section. None linked means none in our current extract.",
  },
];

export default function FloridaRedFlagsPage() {
  return (
    <GuideShell
      guide={guide}
      faq={flags.map((f) => ({
        question: f.title,
        answer: f.body,
      }))}
    >
      <section>
        <p>
          Most hiring problems show up in process, not in a star rating. This page lists practical
          warning signs Florida homeowners can watch for — then maps each one to what public
          records can actually show. It is not a “worst contractors” list and not legal advice.
        </p>
      </section>

      <section className="space-y-3">
        <GuideH2>Warning signs to take seriously</GuideH2>
        <div className="space-y-3">
          {flags.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3.5"
            >
              <p className="text-sm font-semibold text-[var(--text)]">{f.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed">{f.body}</p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--navy)]">
                <span className="font-semibold">Records can help: </span>
                {f.record}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <GuideH2>What public records cannot tell you</GuideH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Whether the crew that shows up is the same licensed qualifier you looked up.</li>
          <li>Whether the quote is fair, complete, or includes required wind or moisture details.</li>
          <li>Whether a contractor will finish on time or treat your home carefully.</li>
          <li>Whether local registration or HOA approval is in place — those are often city or county only.</li>
        </ul>
        <p>
          A clean extract is not a recommendation. An incomplete extract is not a conviction. Use
          records to ask better questions, then confirm on the official board.
        </p>
      </section>

      <section className="space-y-3">
        <GuideH2>A calmer sequence</GuideH2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Look the license up on{" "}
            <Link href="/verify" className="font-medium text-[var(--navy)]">
              Verify
            </Link>{" "}
            and open the Trust Report.
          </li>
          <li>
            If you are still scoping the job, use{" "}
            <Link href="/plan" className="font-medium text-[var(--navy)]">
              Plan
            </Link>{" "}
            or a studio calculator so the conversation is about work, not a rushed deposit.
          </li>
          <li>Get a written scope, payment schedule, and permit holder in writing.</li>
          <li>Re-check DBPR (and Sunbiz if relevant) the day you sign.</li>
        </ol>
        <GuideCtaRow
          items={[
            { href: "/verify", label: "Verify a contractor", primary: true },
            { href: "/guides/how-to-verify-florida-contractor", label: "How to verify (checklist)" },
            { href: "/plan/start", label: "Plan a project" },
            { href: "/tools/pre-hire-checklist", label: "Pre-hire checklist" },
          ]}
        />
      </section>

      <section className="space-y-3">
        <GuideH2>Planning tools (not quotes)</GuideH2>
        <p>
          Cost bands are conceptual Florida planning ranges. They are not contractor prices and not
          a way to “shop the lowest bid” on this site.
        </p>
        <GuideCtaRow
          items={[
            { href: "/studio/cost", label: "Cost Studio" },
            { href: "/studio/roofing", label: "Roofing calculator" },
            { href: "/studio/kitchen", label: "Kitchen calculator" },
            { href: "/studio/bathroom", label: "Bathroom calculator" },
            { href: "/florida", label: "Browse Florida" },
          ]}
        />
      </section>
    </GuideShell>
  );
}
