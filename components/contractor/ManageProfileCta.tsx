"use client";

import { useEffect, useState } from "react";

type Props = { profileId: string; managed?: boolean };

/**
 * ATH-CLAIM-V2-001 — the claim CTA is an explicit human action: a same-origin POST form (works without
 * JavaScript) instead of a crawlable link. Analytics stay low-cardinality: no profile id, no licence number.
 */
function track(event: "claim_cta_viewed" | "claim_cta_activated") {
  const payload = {
    event,
    hub: "contractor",
    profile_class: "contractor",
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
  const [pending, setPending] = useState(false);
  useEffect(() => track("claim_cta_viewed"), []);
  const buttonClass = "mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--accent)] px-4 text-sm font-semibold text-[var(--navy)] no-underline hover:bg-[var(--surface)] disabled:opacity-60";
  return (
    <aside id="manage-profile" className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm sm:p-6 print:hidden">
      <p className="text-sm font-semibold text-[var(--text)]">{managed ? "Profile managed by an authorized representative" : "Is this your business?"}</p>
      {managed ? (
        <a href="https://www.asktrusthub.com/manage" className={buttonClass}>Manage on AskTrustHub</a>
      ) : (
        <form
          method="post"
          action={`/api/claim/handoff/${encodeURIComponent(profileId)}`}
          onSubmit={(event) => {
            if (pending) { event.preventDefault(); return; }
            setPending(true);
            track("claim_cta_activated");
          }}
        >
          {/* ATH-CLAIM-V2-001R2 (Q2): no source field. The server never reads a browser-supplied source; every
              mint from this form is signed as "organic" inside the handoff token itself. */}
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Opening AskTrustHub…" : "Claim or manage this profile — free"}
          </button>
        </form>
      )}
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        {managed ? "Business-supplied information is managed separately from licensing, regulatory records, and TrustHub research." : <>Claiming is free and is not an endorsement. Verify your relationship to manage business-supplied information and responses. Regulatory records remain independently sourced, and corrections can be requested without claiming.</>}
      </p>
    </aside>
  );
}
