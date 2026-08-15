import type { Metadata } from "next";
import Link from "next/link";
import { WatchedListClient } from "@/components/watch/WatchedListClient";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Watched contractors",
  description:
    "Contractors you saved on this device to re-check license evidence later. Not live board monitoring — independent research only.",
  path: "/watch",
  noIndex: true,
});

export default function WatchPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        On this device
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)]">
        Watched contractors
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-[15px]">
        Finalists you chose to save for later — license and status snapshots from when you watched
        them. Re-open the full Trust Report to compare against current extracts.{" "}
        <strong className="font-semibold text-[var(--text)]">Saved on this device</strong> for v1;
        no account required.
      </p>
      <ul className="mt-4 space-y-1.5 text-sm text-[var(--muted)]">
        <li>· Not continuous live government monitoring</li>
        <li>· Not a ranking or recommendation</li>
        <li>· Device watch does not send email by itself</li>
      </ul>

      <div className="mt-5 flex flex-wrap gap-3 text-sm">
        <Link href="/verify" className="font-semibold text-[var(--navy)] no-underline hover:underline">
          Verify search
        </Link>
        <Link
          href="/projects"
          className="font-medium text-[var(--muted)] no-underline hover:text-[var(--text)] hover:underline"
        >
          Projects workspace
        </Link>
        <Link
          href="/account"
          className="font-medium text-[var(--muted)] no-underline hover:text-[var(--text)] hover:underline"
        >
          Optional account
        </Link>
      </div>

      <div className="mt-8">
        <WatchedListClient />
      </div>
    </main>
  );
}
