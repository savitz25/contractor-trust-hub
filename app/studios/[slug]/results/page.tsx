import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StudioResults } from "@/components/studios/StudioResults";
import { parseStudioQuery } from "@/lib/studios/context";
import { getStudioBySlug, listStudios } from "@/lib/studios/registry";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return listStudios().map((s) => ({ slug: s.slug }));
}

export const metadata: Metadata = {
  title: "Studio results — planning range & verified contractors",
  robots: { index: false, follow: true },
};

export default async function StudioResultsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const studio = getStudioBySlug(slug);
  if (!studio) notFound();

  const sp = await searchParams;
  const answers = parseStudioQuery(slug, sp);
  if (!answers) {
    redirect(`/studios/${slug}`);
  }

  return (
    <main>
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-4 pb-6 pt-10 sm:px-6 sm:pt-12">
          <nav className="text-xs font-medium text-[var(--muted)]">
            <Link href="/studios" className="no-underline hover:text-[var(--navy)]">
              Studios
            </Link>
            <span className="mx-2 opacity-50">/</span>
            <Link href={`/studios/${slug}`} className="no-underline hover:text-[var(--navy)]">
              {studio.shortName}
            </Link>
            <span className="mx-2 opacity-50">/</span>
            <span className="text-[var(--text)]">Results</span>
          </nav>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
            {studio.name} results
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Planning guidance · license verification evidence · optional controlled introduction
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <StudioResults studioSlug={slug} answers={answers} />
      </section>
    </main>
  );
}
