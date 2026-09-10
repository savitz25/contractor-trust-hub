export function MyTrustHubSave({ profileId }: { profileId: string }) {
  if (process.env.MY_TRUSTHUB_CONTRACTOR_SAVE_ENABLED !== "true" || profileId !== "0001ac38-0c96-4e2f-8bf6-9ab243f7b79b") return null;
  return <div className="my-4 rounded-xl border border-[var(--border)] p-4">
    <form method="post" action="https://www.asktrusthub.com/my/handoff/start"><button type="submit" className="inline-flex min-h-11 max-w-full items-center rounded-lg bg-[var(--text)] px-4 py-2 text-center text-sm font-semibold text-[var(--bg)] focus-visible:outline-2 focus-visible:outline-offset-4">Save to My TrustHub</button></form>
    <p className="mt-2 text-sm text-[var(--muted)]">Save this exact contractor profile to your private research. A Watch requires a separate choice.</p>
  </div>;
}
