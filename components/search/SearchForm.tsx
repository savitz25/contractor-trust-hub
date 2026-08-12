"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type SearchFormProps = {
  defaultQuery?: string;
  compact?: boolean;
  autoFocus?: boolean;
};

export function SearchForm({
  defaultQuery = "",
  compact = false,
  autoFocus = false,
}: SearchFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      action="/verify"
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const q = String(fd.get("q") || "").trim();
        if (q.length < 2) return;
        startTransition(() => {
          router.push(`/verify?q=${encodeURIComponent(q)}`);
        });
      }}
      className={
        compact
          ? "flex w-full flex-col gap-2 sm:flex-row sm:items-stretch"
          : "flex w-full flex-col gap-3 sm:flex-row sm:items-stretch"
      }
    >
      <label className="sr-only" htmlFor="q">
        Search by license number or contractor name
      </label>
      <input
        id="q"
        name="q"
        type="search"
        required
        minLength={2}
        defaultValue={defaultQuery}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        disabled={pending}
        placeholder="License (CBC015082) or company name"
        className="min-h-12 w-full flex-1 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 text-base text-[var(--text)] placeholder:text-[var(--muted)] outline-none ring-[var(--accent)] focus:ring-2 disabled:opacity-70 sm:text-[15px]"
      />
      <button
        type="submit"
        disabled={pending}
        className={
          compact
            ? "min-h-11 rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--navy)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70 sm:min-h-12"
            : "min-h-12 rounded-xl bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--navy)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70"
        }
      >
        {pending ? "Searching…" : "Verify"}
      </button>
    </form>
  );
}
