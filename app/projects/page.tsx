import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectsListClient } from "@/components/projects/ProjectsListClient";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Project protection dashboard",
  description:
    "Track Florida home projects: milestones, payments, documents, and contractor watches. Educational tooling — not legal advice.",
  path: "/projects",
});

export default function ProjectsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading projects...</p>}>
        <ProjectsListClient />
      </Suspense>
    </main>
  );
}
