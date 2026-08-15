import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectDashboardClient } from "@/components/projects/ProjectDashboardClient";
import { pageMetadata } from "@/lib/seo/page-meta";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return pageMetadata({
    title: "Project workspace",
    description: "Active project protection dashboard.",
    path: `/projects/${id}`,
    noIndex: true,
  });
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading project...</p>}>
        <ProjectDashboardClient projectId={id} />
      </Suspense>
    </main>
  );
}
