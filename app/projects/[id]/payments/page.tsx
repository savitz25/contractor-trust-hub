import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/** Deep link to payments tab via hash-style redirect to dashboard. */
export default async function ProjectPaymentsPage({ params }: Props) {
  const { id } = await params;
  redirect(`/projects/${id}?tab=payments`);
}
