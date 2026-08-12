import type { QuoteItemStatus } from "@/lib/decision/types";

const styles: Record<QuoteItemStatus, string> = {
  included: "border-emerald-200 bg-emerald-50 text-emerald-900",
  excluded: "border-slate-200 bg-slate-50 text-slate-700",
  allowance: "border-amber-200 bg-amber-50 text-amber-950",
  unclear: "border-sky-200 bg-sky-50 text-sky-950",
  missing: "border-rose-200 bg-rose-50 text-rose-900",
};

const labels: Record<QuoteItemStatus, string> = {
  included: "Included",
  excluded: "Excluded",
  allowance: "Allowance",
  unclear: "Unclear",
  missing: "Missing",
};

export function StatusChip({ status }: { status: QuoteItemStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
