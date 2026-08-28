import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";

/** Route-group loading UI. Do not emit a second page H1 (county pages share this file). */
export default function FloridaLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Florida" },
        ]}
      />
      <p className="mt-8 text-sm text-[var(--muted)]" role="status">
        Loading Florida research…
      </p>
    </main>
  );
}
