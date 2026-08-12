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
      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
      : tone === "bad"
        ? "bg-rose-500/15 text-rose-300 ring-rose-500/30"
        : tone === "warn"
          ? "bg-amber-500/15 text-amber-200 ring-amber-500/30"
          : "bg-slate-500/15 text-slate-300 ring-slate-500/30";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${classes}`}
    >
      {text}
    </span>
  );
}
