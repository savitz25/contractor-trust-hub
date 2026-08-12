"use client";

import { useState } from "react";
import {
  FLORIDA_LIEN_EDUCATION,
  PAYMENT_DOC_CHECKS,
} from "@/lib/projects/payment-checklist";
import { PAYMENT_TRACKER_DISCLAIMER } from "@/lib/projects/disclaimers";
import { addPayment, paymentOutstanding, updatePayment } from "@/lib/projects/store";
import type { PaymentRecord, Project } from "@/lib/projects/types";
import { formatUsd } from "@/lib/plan/cost-model";

export function PaymentsPanel({
  project,
  onChange,
}: {
  project: Project;
  onChange: (p: Project) => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("Check");
  const [milestone, setMilestone] = useState("");
  const [notes, setNotes] = useState("");
  const [hasInvoice, setHasInvoice] = useState(false);
  const [hasWaiver, setHasWaiver] = useState(false);
  const [hasCo, setHasCo] = useState(false);

  const outstanding = paymentOutstanding(project);

  const add = () => {
    const n = amount ? Number(amount.replace(/[,$]/g, "")) : null;
    const updated = addPayment(project.id, {
      amount: n != null && Number.isFinite(n) ? n : null,
      date,
      method,
      milestoneLabel: milestone || "Payment",
      notes: notes || undefined,
      hasInvoice,
      hasLienWaiver: hasWaiver,
      hasChangeOrderRef: hasCo,
      completed: true,
    });
    if (updated) {
      onChange(updated);
      setAmount("");
      setMilestone("");
      setNotes("");
      setHasInvoice(false);
      setHasWaiver(false);
      setHasCo(false);
    }
  };

  const toggleDoc = (
    pay: PaymentRecord,
    field: "hasInvoice" | "hasLienWaiver" | "hasChangeOrderRef"
  ) => {
    const updated = updatePayment(project.id, pay.id, { [field]: !pay[field] });
    if (updated) onChange(updated);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-900">
          Florida educational panel
        </p>
        <ul className="mt-2 space-y-3">
          {FLORIDA_LIEN_EDUCATION.map((e) => (
            <li key={e.title}>
              <p className="text-sm font-medium text-amber-950">{e.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-950/85">{e.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-[var(--muted)]">{PAYMENT_TRACKER_DISCLAIMER}</p>
      </div>

      {outstanding.length > 0 ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3">
          <p className="text-sm font-semibold text-rose-950">Outstanding documentation</p>
          <ul className="mt-2 space-y-1 text-xs text-rose-900">
            {outstanding.map((p) => (
              <li key={p.id}>
                · {p.milestoneLabel} ({p.date})
                {!p.hasInvoice ? " — missing invoice" : ""}
                {!p.hasLienWaiver ? " — missing lien waiver status" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Log a payment</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Before marking complete, note documentation status ({PAYMENT_DOC_CHECKS.map((c) => c.label).join("; ")}).
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs">
            Amount
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
              placeholder="10000"
            />
          </label>
          <label className="block text-xs">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            Method
            <input
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            Milestone label
            <input
              value={milestone}
              onChange={(e) => setMilestone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
              placeholder="Deposit / rough / final"
            />
          </label>
          <label className="block text-xs sm:col-span-2">
            Notes
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={hasInvoice}
              onChange={(e) => setHasInvoice(e.target.checked)}
            />
            Invoice / draw request
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={hasWaiver}
              onChange={(e) => setHasWaiver(e.target.checked)}
            />
            Lien waiver status noted
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={hasCo} onChange={(e) => setHasCo(e.target.checked)} />
            Change-order ref
          </label>
        </div>
        <button
          type="button"
          onClick={add}
          className="mt-3 rounded-xl bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white"
        >
          Add payment
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Payment ledger</h3>
        {project.payments.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No payments logged yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {[...project.payments].reverse().map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/40 px-3 py-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-[var(--text)]">
                    {p.milestoneLabel}
                    {p.amount != null ? ` · ${formatUsd(p.amount)}` : ""}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {p.date} · {p.method}
                  </p>
                </div>
                {p.notes ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">{p.notes}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => toggleDoc(p, "hasInvoice")}
                    className={`rounded-full border px-2 py-0.5 ${
                      p.hasInvoice
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-rose-200 bg-rose-50 text-rose-900"
                    }`}
                  >
                    Invoice {p.hasInvoice ? "✓" : "—"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDoc(p, "hasLienWaiver")}
                    className={`rounded-full border px-2 py-0.5 ${
                      p.hasLienWaiver
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-rose-200 bg-rose-50 text-rose-900"
                    }`}
                  >
                    Lien waiver {p.hasLienWaiver ? "✓" : "—"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDoc(p, "hasChangeOrderRef")}
                    className={`rounded-full border px-2 py-0.5 ${
                      p.hasChangeOrderRef
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-[var(--border)] bg-white text-[var(--muted)]"
                    }`}
                  >
                    CO ref {p.hasChangeOrderRef ? "✓" : "—"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
