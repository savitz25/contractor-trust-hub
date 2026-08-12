"use client";

import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";

type SearchFormProps = {
  defaultQuery?: string;
  /** hero = homepage primary; default = verify page; compact = tight layouts */
  size?: "hero" | "default" | "compact";
  autoFocus?: boolean;
  /** Optional visible label above the field */
  label?: string;
  placeholder?: string;
  /** Extra query params (e.g. intent=have) */
  intent?: "have" | "research" | null;
  /** Evidence state slug: fl | tx */
  stateSlug?: string;
};

const PLACEHOLDERS = {
  hero: "License number (CBC015082) or company name…",
  default: "License (CBC015082) or company name",
  compact: "License or company name",
};

const TX_PLACEHOLDERS = {
  hero: "License # or business / owner name…",
  default: "License # or business name",
  compact: "License or name",
};

export function SearchForm({
  defaultQuery = "",
  size = "default",
  autoFocus = false,
  label,
  placeholder,
  intent = null,
  stateSlug = "fl",
}: SearchFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inputId = useId();

  const isHero = size === "hero";
  const isCompact = size === "compact";
  const isTx = stateSlug === "tx";
  const ph =
    placeholder ||
    (isTx ? TX_PLACEHOLDERS[size] : PLACEHOLDERS[size]);

  const inputClass = isHero
    ? "min-h-12 w-full flex-1 rounded-2xl border border-[var(--border)] bg-white px-4 text-base text-[var(--text)] shadow-[var(--shadow-sm)] placeholder:text-[var(--muted)] outline-none ring-[var(--accent)] focus:ring-2 disabled:opacity-70 sm:min-h-[3.75rem] sm:px-5 sm:text-lg"
    : isCompact
      ? "min-h-11 w-full flex-1 rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--text)] placeholder:text-[var(--muted)] outline-none ring-[var(--accent)] focus:ring-2 disabled:opacity-70 sm:text-sm"
      : "min-h-12 w-full flex-1 rounded-xl border border-[var(--border)] bg-white px-4 text-base text-[var(--text)] shadow-[var(--shadow-sm)] placeholder:text-[var(--muted)] outline-none ring-[var(--accent)] focus:ring-2 disabled:opacity-70";

  const buttonClass = isHero
    ? "min-h-12 w-full shrink-0 rounded-2xl bg-[var(--accent)] px-6 text-base font-semibold text-[var(--navy)] shadow-[var(--shadow-sm)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70 sm:min-h-[3.75rem] sm:w-auto sm:px-10 sm:text-lg"
    : isCompact
      ? "min-h-11 w-full rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--navy)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
      : "min-h-12 w-full rounded-xl bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--navy)] shadow-[var(--shadow-sm)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70 sm:w-auto";

  return (
    <form
      action="/verify"
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const q = String(fd.get("q") || "").trim();
        if (q.length < 2) return;
        const params = new URLSearchParams({ q });
        if (intent) params.set("intent", intent);
        if (stateSlug && stateSlug !== "fl") params.set("state", stateSlug);
        startTransition(() => {
          router.push(`/verify?${params.toString()}`);
        });
      }}
      className="w-full"
    >
      {intent && <input type="hidden" name="intent" value={intent} />}
      {stateSlug && stateSlug !== "fl" ? (
        <input type="hidden" name="state" value={stateSlug} />
      ) : null}
      {label && (
        <label
          htmlFor={inputId}
          className="mb-2 block text-sm font-medium text-[var(--text)]"
        >
          {label}
        </label>
      )}
      {!label && (
        <label className="sr-only" htmlFor={inputId}>
          Search by license number or contractor name
        </label>
      )}
      <div
        className={
          isHero
            ? "flex w-full flex-col gap-3 sm:flex-row sm:items-stretch"
            : isCompact
              ? "flex w-full flex-col gap-2 sm:flex-row sm:items-stretch"
              : "flex w-full flex-col gap-3 sm:flex-row sm:items-stretch"
        }
      >
        <input
          id={inputId}
          name="q"
          type="search"
          required
          minLength={2}
          defaultValue={defaultQuery}
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="search"
          disabled={pending}
          placeholder={ph}
          className={inputClass}
        />
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Searching…" : "Verify"}
        </button>
      </div>
    </form>
  );
}
