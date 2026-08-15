import type { Metadata } from "next";
import Link from "next/link";
import { GuideCtaRow, GuideH2, GuideH3, GuideShell } from "@/components/guides/GuideShell";
import { getGuideBySlug } from "@/lib/guides/registry";
import { pageMetadata } from "@/lib/seo/page-meta";

const guide = getGuideBySlug("how-to-verify-florida-contractor")!;

export const metadata: Metadata = pageMetadata({
  title: guide.seoTitle,
  description: guide.description,
  path: guide.path,
  ogType: "article",
});

const checks = [
  {
    title: "License status",
    body: "Look for Current or Active on the Florida DBPR construction record. Inactive, expired, or other statuses are not automatically “cleared.” Re-check the official board the day you hire — our extract can lag live systems.",
    tool: "Trust Report license badge and dates",
  },
  {
    title: "License class",
    body: "The occupation code (CBC, CGC, CRC, CCC, CFC, and others) describes what the person is typically licensed to contract. Roofing is not the same as a general remodel. A mismatch is a reason to ask questions, not a score.",
    tool: "License class label on the result card and Trust Report",
  },
  {
    title: "Business name vs. license name",
    body: "The name on your written contract should match the licensed qualifier and, when available, the linked Sunbiz filing. Marketing nicknames are not evidence.",
    tool: "Display, legal, and DBA fields on the Trust Report",
  },
  {
    title: "Sunbiz entity (when linked)",
    body: "We only show a Sunbiz status when a high-confidence name-and-location match exists. No link does not mean “no company” — it means we would not invent one.",
    tool: "Entity status on the card; entity section on the Trust Report",
  },
  {
    title: "Discipline in our extract",
    body: "Linked board actions appear with dates and source. None linked is a statement about our files, not a lifetime clean-record certificate.",
    tool: "Discipline section and “what we checked” on the Trust Report",
  },
  {
    title: "Workers’ compensation (separate check)",
    body: "We do not store coverage status. Ask for a current certificate and use official Florida Proof of Coverage tools before relying on a verbal claim.",
    tool: "Insurance guidance on the Trust Report",
  },
];

export default function HowToVerifyFloridaPage() {
  return (
    <GuideShell
      guide={guide}
      faq={checks.map((c) => ({
        question: `What should I check for ${c.title.toLowerCase()}?`,
        answer: c.body,
      }))}
    >
      <section>
        <p>
          If you already have a name, a truck, or a license number, start with evidence — not
          reviews and not a marketplace. This page walks through what Florida homeowners typically
          check before hiring, and how{" "}
          <Link href="/verify" className="font-medium text-[var(--navy)]">
            Verify
          </Link>{" "}
          and a Trust Report support each step.
        </p>
      </section>

      <section className="space-y-3">
        <GuideH2>What you should check</GuideH2>
        <p>
          Use this as a research checklist. Official boards remain authoritative. Public extracts
          can lag.
        </p>
        <ol className="space-y-3">
          {checks.map((c, i) => (
            <li
              key={c.title}
              className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3.5"
            >
              <p className="text-sm font-semibold text-[var(--text)]">
                {i + 1}. {c.title}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed">{c.body}</p>
              <p className="mt-2 text-xs font-medium text-[var(--navy)]">In the product: {c.tool}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <GuideH2>How to use Contractor Trust Hub</GuideH2>
        <GuideH3>1. Search Verify</GuideH3>
        <p>
          Go to{" "}
          <Link href="/verify" className="font-medium text-[var(--navy)]">
            /verify
          </Link>
          . A full license id (for example CBC015082) is most precise. A distinctive company name
          also works. Legal endings like LLC or Inc are optional.
        </p>
        <GuideH3>2. Scan the result card</GuideH3>
        <p>
          License status, class, location, and a high-confidence entity signal appear first. Open
          the Trust Report for dates, sources, and “last verified” meaning: present in our last
          successful ingest — not a live ping at page load.
        </p>
        <GuideH3>3. Read “What should I know before hiring?”</GuideH3>
        <p>
          That section translates the same evidence into plain language. It is educational — not
          advice to hire or avoid anyone.
        </p>
        <GuideCtaRow
          items={[
            { href: "/verify", label: "Search Florida Verify", primary: true },
            { href: "/guides/florida-contractor-license-types", label: "License types explained" },
            { href: "/methodology", label: "Methodology" },
          ]}
        />
      </section>

      <section className="space-y-3">
        <GuideH2>If you do not have a name yet</GuideH2>
        <p>
          Planning first is often clearer than browsing a directory. Florida Cost Studio and the
          kitchen, bath, and roofing calculators produce planning ranges only — never bids — then
          hand off to verified license matches.
        </p>
        <GuideCtaRow
          items={[
            { href: "/plan/start", label: "Plan a project" },
            { href: "/studio/cost", label: "Cost Studio" },
            { href: "/studio/roofing", label: "Roofing calculator" },
            { href: "/studio/kitchen", label: "Kitchen calculator" },
            { href: "/studio/bathroom", label: "Bathroom calculator" },
            { href: "/florida", label: "Browse by county & trade" },
          ]}
        />
      </section>

      <section className="space-y-3">
        <GuideH2>Honest limits</GuideH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            We are not a consumer reporting agency and not the licensing board. Confirm critical
            details on{" "}
            <a
              href="https://www2.myfloridalicense.com/construction-industry/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[var(--navy)]"
            >
              Florida DBPR
            </a>{" "}
            and{" "}
            <a
              href="https://dos.fl.gov/sunbiz/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[var(--navy)]"
            >
              Sunbiz
            </a>{" "}
            before you sign.
          </li>
          <li>Missing from search does not always mean unlicensed — thin shells are hidden by design.</li>
          <li>
            Local permits, HOA rules, and insurance requirements live outside our extracts. See{" "}
            <Link href="/disclaimer" className="font-medium text-[var(--navy)]">
              Disclaimer
            </Link>{" "}
            and{" "}
            <Link href="/independence" className="font-medium text-[var(--navy)]">
              Independence
            </Link>
            .
          </li>
        </ul>
      </section>
    </GuideShell>
  );
}
