import type { Metadata } from "next";
import Link from "next/link";
import { listStudios } from "@/lib/studios/registry";

export const metadata: Metadata = {
  title: "Project Studios — scope, cost drivers, verified contractors",
  description:
    "Kitchen, bathroom, roofing replacement, addition, basement, exterior, and whole-home studios: clarify scope, see conceptual Florida cost ranges, and match licensed contractors.",
  alternates: { canonical: "/studios" },
  openGraph: {
    title: "Project Studios | Contractor Trust Hub",
    description:
      "Expert planning guides — roof replacement, kitchen, bath, and more. Scope, ranges, verified licenses. Not design software.",
    url: "/studios",
    type: "website",
  },
};

export default function StudiosHubPage() {
  const studios = listStudios();

  return (
    <main>
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6 sm:pt-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            Project Studios
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
            Get clearer on scope. See realistic ranges. Verify the right licensed contractors.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-[var(--muted)]">
            Focused planning guides — not a design tool or lead marketplace. Each studio asks a few
            project-specific questions, then shows conceptual cost drivers and evidence-based
            license matches for Florida. Texas planning studios are not available yet.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/studio/kitchen"
              className="inline-flex min-h-10 items-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--navy)] no-underline"
            >
              Kitchen calculator
            </Link>
            <Link
              href="/studio/roofing"
              className="inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--navy)] no-underline"
            >
              Roofing calculator
            </Link>
            <Link
              href="/studio/cost"
              className="inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--navy)] no-underline"
            >
              Cost Studio
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {studios.map((s) => (
            <Link
              key={s.slug}
              href={`/studios/${s.slug}`}
              className="rounded-3xl border border-[var(--border)] bg-white p-5 no-underline shadow-[var(--shadow-sm)] transition hover:border-[var(--navy)]/25 hover:shadow-[var(--shadow-md)] sm:p-6"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                {s.shortName}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">{s.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{s.positioning}</p>
              <p className="mt-4 text-sm font-medium text-[var(--navy)]">Open studio →</p>
            </Link>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-5 py-5 sm:px-6">
          <p className="text-sm font-medium text-[var(--text)]">Other project types?</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Use the general plan flow for additions, exterior, custom homes, and more.
          </p>
          <Link href="/plan" className="mt-3 inline-block text-sm font-semibold text-[var(--navy)]">
            Open project planner →
          </Link>
        </div>
      </section>
    </main>
  );
}
