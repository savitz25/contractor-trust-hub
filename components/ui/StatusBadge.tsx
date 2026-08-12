import { statusLabel, statusTone } from "@/lib/contractors/format";

export function StatusBadge({
  status,
  label,
}: {
  status: string | null | undefined;
  label?: string;
}) {
  const tone = statusTone(status);
  const text = label || statusLabel(status);
  const classes =
    tone === "good"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : tone === "bad"
        ? "bg-rose-50 text-rose-800 ring-rose-200"
        : tone === "warn"
          ? "bg-amber-50 text-amber-900 ring-amber-200"
          : "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${classes}`}
    >
      {text}
    </span>
  );
}
