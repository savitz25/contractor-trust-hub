import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { IntelligenceHero } from "@/components/intelligence/IntelligenceHero";

/** Instant hero — metrics load behind Suspense without a dead page. */
export default function FloridaLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Florida" },
        ]}
      />
      <div className="mt-4">
        <IntelligenceHero />
        <p className="mt-8 text-sm text-[var(--muted)]" role="status">
          Loading Florida research snapshot…
        </p>
      </div>
    </main>
  );
}
