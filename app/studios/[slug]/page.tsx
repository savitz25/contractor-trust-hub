import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioFlow } from "@/components/studios/StudioFlow";
import { getStudioBySlug, listStudios } from "@/lib/studios/registry";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return listStudios().map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const studio = getStudioBySlug(slug);
  if (!studio) return { title: "Studio not found" };
  return {
    title: `${studio.name} — scope, cost drivers, verified contractors`,
    description: studio.positioning,
    alternates: { canonical: `/studios/${studio.slug}` },
    openGraph: {
      title: `${studio.name} | Contractor Trust Hub`,
      description: studio.positioning,
      url: `/studios/${studio.slug}`,
      type: "website",
    },
  };
}

export default async function StudioPage({ params }: Props) {
  const { slug } = await params;
  const studio = getStudioBySlug(slug);
  if (!studio) notFound();

  return (
    <main>
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 sm:pt-12">
          <nav className="text-xs font-medium text-[var(--muted)]">
            <Link href="/studios" className="no-underline hover:text-[var(--navy)]">
              Studios
            </Link>
            <span className="mx-2 opacity-50">/</span>
            <span className="text-[var(--text)]">{studio.shortName}</span>
          </nav>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
            {studio.headline}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-[var(--muted)]">{studio.positioning}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Expert planning guide — not design software. Conceptual ranges only; license matches
            from official Florida records.
          </p>
          {studio.slug === "bathroom" ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Prefer live planning bands?{" "}
              <Link href="/studio/bathroom" className="font-medium text-[var(--navy)] hover:underline">
                Bathroom Cost Calculator
              </Link>
            </p>
          ) : null}
          {studio.slug === "kitchen" ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Prefer live planning bands?{" "}
              <Link href="/studio/kitchen" className="font-medium text-[var(--navy)] hover:underline">
                Kitchen Cost Calculator
              </Link>
            </p>
          ) : null}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <StudioFlow slug={studio.slug} />
      </section>
    </main>
  );
}
