"use client";

import { useEffect } from "react";

type Props = { profileId: string; managed?: boolean };

function track(event: "manage_profile_cta_view" | "manage_profile_cta_click", profileId: string) {
  const payload = {
    event,
    hub: "contractor",
    native_profile_id: profileId,
    state: "FL",
    source_system: "fl_dbpr",
  };
  try {
    const w = window as unknown as {
      gtag?: (...args: unknown[]) => void;
      dataLayer?: Array<Record<string, unknown>>;
    };
    w.gtag?.("event", event, payload);
    w.dataLayer?.push(payload);
  } catch {
    // Analytics is best-effort and must never block the handoff.
  }
}

export function ManageProfileCta({ profileId, managed = false }: Props) {
  useEffect(() => track("manage_profile_cta_view", profileId), [profileId]);
  return (
    <aside className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm sm:p-6 print:hidden">
      <p className="text-sm font-semibold text-[var(--text)]">{managed ? "Managed by the business" : "Is this your business?"}</p>
      <a
        href={managed ? "https://www.asktrusthub.com/manage" : `/api/claim/handoff/${encodeURIComponent(profileId)}`}
        onClick={() => track("manage_profile_cta_click", profileId)}
        className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--accent)] px-4 text-sm font-semibold text-[var(--navy)] no-underline hover:bg-[var(--surface)]"
      >
        {managed ? "Manage on AskTrustHub" : "Manage this profile on AskTrustHub"}
      </a>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        {managed ? "Business-supplied information is managed separately from licensing, regulatory records, and TrustHub research." : <>Verify your relationship to manage business-supplied information and responses. Regulatory records remain independently sourced.</>}
      </p>
    </aside>
  );
}
