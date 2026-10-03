"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { SAVED_CHANGE_EVENT, isContractorSaved, saveContractor, unsaveContractor } from "@/lib/saved/store";
import { browserDirectPorts, parentSync, resumeDirect, startDirect, type DirectIntent } from "@/lib/my-trusthub/direct-save-client";

/** Client half of My TrustHub sync. Bundled at build; OFF unless set to "1".
 * Even when on, the server decides: with production sync off the endpoint
 * answers "unavailable" and the Save stays on this device. */
export const PARENT_SYNC_UI = process.env.NEXT_PUBLIC_MY_TRUSTHUB_CONTRACTOR_SYNC === "1";

/**
 * One Save toggle for a Trust Report: Save -> Saved -> Save.
 *
 * Selecting the control while it reads Saved removes the Save; there is no
 * separate Unsave control, no Keep step and no confirmation. Device-first: the
 * local saved list is written or cleared immediately and never waits for
 * anything. It never starts or changes a Watch. The visible word and
 * aria-pressed carry the state; the filled heart only reinforces it.
 *
 * My TrustHub sync (off by default) is additive and runs only on the canonical
 * profile page of a profile the server marked identity-safe. The hand-off is a
 * chain of navigations that a click elsewhere abandons, so while it runs the
 * page shows a blocking notice, and an Unsave the parent did not acknowledge is
 * never reported as an account Unsave: the control says it may still be saved
 * in My TrustHub and offers the removal again.
 */
export function SaveContractorToggle({ slug, name, profileId, syncEligible = false }: { slug: string; name: string; profileId?: string | null; syncEligible?: boolean }) {
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<DirectIntent | null>(null);
  const [parentHeld, setParentHeld] = useState(false);
  const pathname = usePathname();
  const direct = PARENT_SYNC_UI && syncEligible && pathname === "/contractors/" + slug;
  const here = useRef(true);

  useEffect(() => {
    here.current = true;
    const sync = () => setSaved(isContractorSaved(slug));
    setMounted(true);
    sync();
    window.addEventListener(SAVED_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      here.current = false;
      window.removeEventListener(SAVED_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [slug]);

  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), 4000);
    return () => window.clearTimeout(timer);
  }, [note]);

  useEffect(() => {
    if (!syncing) return;
    // The notice ends with the page. If the navigation never happens, or the
    // page is restored from the back/forward cache, release it.
    const release = () => setSyncing(null);
    const timer = window.setTimeout(release, 30_000);
    window.addEventListener("pageshow", release);
    return () => { window.clearTimeout(timer); window.removeEventListener("pageshow", release); };
  }, [syncing]);

  // Back from My TrustHub (or reopening the profile after an abandoned
  // hand-off): report only what the parent acknowledged. Consumed once.
  useEffect(() => {
    if (!direct) return;
    let active = true;
    void resumeDirect(browserDirectPorts(), slug).then((result) => {
      if (!active) return;
      setParentHeld(parentSync(localStorage, slug) !== null);
      if (!result) return;
      if (result.intent === "unsave") setNote(result.outcome === "confirmed" ? "Removed from this device and My TrustHub" : "Removed from this device. My TrustHub did not confirm the removal.");
      else setNote(result.outcome === "confirmed" ? "Saved to My TrustHub" : result.outcome === "not_confirmed" ? "Saved on this device. Sign in to My TrustHub to sync across devices." : "Saved on this device");
    });
    return () => { active = false; };
  }, [direct, slug]);

  /** Stage and hand the browser to My TrustHub. Nothing navigates once the user has left this profile. */
  const handOff = async (intent: DirectIntent) => {
    setSyncing(intent);
    const result = await startDirect(browserDirectPorts(), slug, intent, () => here.current);
    if (result !== "navigating") setSyncing(null);
    return result;
  };

  const retryParentUnsave = () => {
    void handOff("unsave").then((result) => { if (result !== "navigating") setNote("My TrustHub could not be reached. It may still be saved there."); });
  };

  const toggle = async () => {
    if (syncing) return;
    if (saved) {
      const reachParent = direct && parentSync(localStorage, slug) !== null;
      // The device removal is immediate and never depends on the parent.
      unsaveContractor(slug);
      setSaved(false);
      if (!reachParent) { setNote("Removed from saved contractors on this device"); return; }
      setParentHeld(true);
      if ((await handOff("unsave")) === "navigating") return;
      setNote("Removed from this device. My TrustHub could not be reached, so it may still be saved there.");
      return;
    }
    // The device Save is complete before anything else is attempted.
    const row = saveContractor({ slug, name, profileId });
    setSaved(Boolean(row));
    if (!row) { setNote("Could not save on this device"); return; }
    if (!direct) { setNote("Saved on this device"); return; }
    const result = await handOff("save");
    if (result === "navigating") return;
    setNote(result === "not_eligible" ? "Saved on this device. This profile can’t be added to My TrustHub yet." : "Saved on this device");
  };

  const progress = syncing && typeof document !== "undefined"
    ? createPortal(
        <div role="status" aria-live="assertive" data-mth-sync={syncing} className="fixed inset-0 z-[200] flex items-center justify-center bg-white/70 p-4">
          <div className="max-w-xs rounded-xl border border-[var(--border)] bg-white px-5 py-4 text-center text-sm font-semibold text-[var(--text)] shadow-lg">
            {syncing === "unsave" ? "Removing from My TrustHub…" : "Saving to My TrustHub…"}
            <span className="mt-1 block text-xs font-normal text-[var(--muted)]">Keep this page open. This takes a few seconds.</span>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <span className="inline-flex flex-col gap-1" data-save-state={mounted && saved ? "saved" : "unsaved"} data-parent-sync={direct ? "on" : "off"}>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={syncing !== null}
        data-save-toggle="true"
        aria-pressed={mounted ? saved : undefined}
        aria-busy={syncing !== null}
        aria-label={saved ? `Saved: ${name}. Select to remove from your saved contractors.` : `Save ${name}`}
        title={saved ? "Saved on this device — select to unsave" : "Save on this device"}
        className={
          saved
            ? "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--navy)]/30 bg-[var(--accent-soft)] px-4 text-sm font-semibold text-[var(--navy)] disabled:opacity-70"
            : "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--text)] hover:border-[var(--navy)]/25 disabled:opacity-70"
        }
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" data-heart={saved ? "filled" : "outline"}
          fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {saved ? "Saved" : "Save"}
      </button>
      <span role="status" aria-live="polite" className="min-h-0 text-[11px] font-medium text-[var(--muted)]">
        {note}
      </span>
      {direct && mounted && !saved && parentHeld && !syncing ? (
        <span className="text-[11px] text-[var(--muted)]" data-mth-parent-held="true">
          May still be saved in My TrustHub.{" "}
          <a href="#remove-from-my-trusthub" onClick={(event) => { event.preventDefault(); retryParentUnsave(); }} className="font-medium text-[var(--navy)] underline">
            Remove it there
          </a>
        </span>
      ) : null}
      {progress}
    </span>
  );
}
