"use client";

import { useEffect, useState } from "react";

type Props = { profileId: string; managed?: boolean; state?: string; sourceSystem?: string };

/**
 * ATH-CLAIM-V2-001 — the claim CTA is an explicit human action: a same-origin POST form (works without
 * JavaScript) instead of a crawlable link. Analytics stay low-cardinality: no profile id, no licence number.
 */
function track(event: "claim_cta_viewed" | "claim_cta_activated", state: string, sourceSystem: string) {
  // Low-cardinality only: claim state and credential source (no profile id, no credential number).
  const payload = {
    event,
    hub: "contractor",
    profile_class: "contractor",
    state,
    source_system: sourceSystem,
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

export function ManageProfileCta({ profileId, managed = false, state = "FL", sourceSystem = "fl_dbpr" }: Props) {
  const [pending, setPending] = useState(false);
  useEffect(() => track("claim_cta_viewed", state, sourceSystem), [state, sourceSystem]);
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
            // ATH-CLAIM-V2-FLNJ-001R1: a synchronous DOM guard in addition to React state, so a double-click or a
            // tag-manager re-submit cannot post this form twice before React re-renders (each post would mint a
            // separate signed handoff). Ask also collapses a second mint for one click into one intent.
            const form = event.currentTarget;
            if (pending || form.dataset.submitted === "1") { event.preventDefault(); return; }
            form.dataset.submitted = "1";
            setPending(true);
            track("claim_cta_activated", state, sourceSystem);
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
