import type { Metadata } from "next";
import Link from "next/link";
import { GuideCtaRow, GuideH2, GuideShell } from "@/components/guides/GuideShell";
import { getOccupationInfo } from "@/lib/contractors/occupations";
import { getGuideBySlug } from "@/lib/guides/registry";
import { pageMetadata } from "@/lib/seo/page-meta";
import { shareRouteOgImage } from "@/lib/seo/share-hub";

const guide = getGuideBySlug("florida-contractor-license-types")!;
const og = shareRouteOgImage(guide.path, guide.title);

export const metadata: Metadata = pageMetadata({
  title: guide.seoTitle,
  description: guide.description,
  path: guide.path,
  ogType: "article",
  images: [og.url],
  ogAlt: og.alt,
});

const FEATURED = ["CGC", "CBC", "CRC", "CCC", "RC", "RR", "CFC", "CAC", "CMC", "CPC", "SCC"] as const;

const browse = [
  { href: "/florida/roofers", label: "Florida roofers" },
  { href: "/florida", label: "All Florida trades" },
  { href: "/studio/roofing", label: "Roofing calculator" },
  { href: "/studio/kitchen", label: "Kitchen calculator" },
  { href: "/studio/bathroom", label: "Bathroom calculator" },
];

export default function FloridaLicenseTypesPage() {
  return (
    <GuideShell guide={guide}>
      <section>
        <p>
          Florida construction licenses use short occupation codes. Homeowners usually see them on
          a card, a truck, or a Trust Report. This page explains common classes in plain language.
          Exact authority still depends on board rules, the project, and local permitting — not
          this summary.
        </p>
      </section>

      <section className="space-y-3">
        <GuideH2>Certified vs registered (quick frame)</GuideH2>
        <p>
          <strong className="font-medium text-[var(--text)]">Certified</strong> licenses (often
          starting with C) are typically statewide construction credentials issued through the
          Florida Construction Industry Licensing Board.
        </p>
        <p>
          <strong className="font-medium text-[var(--text)]">Registered</strong> licenses (for
          example RR) can carry more local or scope conditions. Always confirm where a registered
          credential is valid for your job site.
        </p>
      </section>

      <section className="space-y-3">
        <GuideH2>Common classes homeowners see</GuideH2>
        <div className="space-y-3">
          {FEATURED.map((code) => {
            const occ = getOccupationInfo(code);
            return (
              <article
                key={code}
                className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3.5"
              >
                <p className="font-mono text-xs font-semibold tracking-wide text-[var(--accent)]">
                  {code}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-[var(--text)]">{occ.label}</h3>
                <p className="mt-1.5 text-sm leading-relaxed">{occ.allows}</p>
                <p className="mt-2 text-xs leading-relaxed">
                  <span className="font-semibold text-[var(--text)]">Good to know: </span>
                  {occ.notes}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <GuideH2>How to use this with Verify</GuideH2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Search the license on{" "}
            <Link href="/verify" className="font-medium text-[var(--navy)]">
              Verify
            </Link>
            .
          </li>
          <li>Read the class on the result card — not just “active.”</li>
          <li>
            If the work is roofing, kitchen, or bath, start in a{" "}
            <Link href="/studios" className="font-medium text-[var(--navy)]">
              Studio
            </Link>{" "}
            so matching prefers the right classes.
          </li>
        </ol>
        <GuideCtaRow
          items={[
            { href: "/verify", label: "Search by license or name", primary: true },
            { href: "/guides/how-to-verify-florida-contractor", label: "How to verify" },
            { href: "/methodology", label: "How we map classes" },
          ]}
        />
      </section>

      <section className="space-y-3">
        <GuideH2>Browse or plan by project type</GuideH2>
        <p>
          Discovery listings and calculators are Florida planning and research tools — not paid
          directories.
        </p>
        <GuideCtaRow
          items={browse.map((b, i) => ({
            href: b.href,
            label: b.label,
            primary: i === 0,
          }))}
        />
      </section>
    </GuideShell>
  );
}
