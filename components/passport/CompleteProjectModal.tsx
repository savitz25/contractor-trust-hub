"use client";

import { useState } from "react";
import { completeProjectInWorkspace } from "@/lib/passport/complete-project";
import { loadLocalWorkspace, saveLocalWorkspace } from "@/lib/passport/local-workspace";
import type { Project } from "@/lib/projects/types";

export function CompleteProjectModal({
  project,
  onDone,
  onClose,
}: {
  project: Project;
  onDone: (project: Project, passportId: string | null) => void;
  onClose: () => void;
}) {
  const [completionDate, setCompletionDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [finalAmount, setFinalAmount] = useState(
    project.contractAmount != null ? String(project.contractAmount) : ""
  );
  const [permitCloseout, setPermitCloseout] = useState("");
  const [warrantyDocsReceived, setWarranty] = useState(false);
  const [finalPaymentDocumented, setFinalPay] = useState(false);
  const [notes, setNotes] = useState("");
  const [keepWatch, setKeepWatch] = useState(true);
  const [saveToPassport, setSaveToPassport] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const local = loadLocalWorkspace();
      const { workspace, passportId, project: next } = completeProjectInWorkspace(
        local,
        project.id,
        {
          completionDate,
          finalAmount: finalAmount
            ? Number(finalAmount.replace(/[,$]/g, ""))
            : null,
          permitCloseout: permitCloseout || undefined,
          warrantyDocsReceived,
          finalPaymentDocumented,
          notes: notes || undefined,
          keepWatch,
          saveToPassport,
        }
      );
      saveLocalWorkspace(workspace);

      // Best-effort cloud sync if signed in
      try {
        await fetch("/api/account/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace, mode: "merge" }),
        });
      } catch {
        /* local still saved */
      }

      if (next) onDone(next, passportId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-lg sm:rounded-2xl sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--text)]">Mark project complete</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Bridge active protection into long-term Home Passport records. Educational only.
        </p>

        <div className="mt-4 grid gap-3">
          <label className="text-xs">
            Completion date
            <input
              type="date"
              value={completionDate}
              onChange={(e) => setCompletionDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs">
            Final contract amount (optional)
            <input
              value={finalAmount}
              onChange={(e) => setFinalAmount(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs">
            Final inspection / permit closeout (if known)
            <input
              value={permitCloseout}
              onChange={(e) => setPermitCloseout(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
              placeholder="e.g. Finaled · permit BLD-…"
            />
          </label>
          <label className="text-xs">
            Notes / issues to remember
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={warrantyDocsReceived}
              onChange={(e) => setWarranty(e.target.checked)}
            />
            Warranty docs received
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={finalPaymentDocumented}
              onChange={(e) => setFinalPay(e.target.checked)}
            />
            Final payment + waiver documentation logged
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={saveToPassport}
              onChange={(e) => setSaveToPassport(e.target.checked)}
            />
            Save to Home Passport
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={keepWatch}
              onChange={(e) => setKeepWatch(e.target.checked)}
            />
            Keep contractor on Watch through warranty period
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Complete project
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
