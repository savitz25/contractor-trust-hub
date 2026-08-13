"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

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
  /** Homepage: let the visitor choose FL vs TX before searching */
  showStatePicker?: boolean;
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

const NJ_PLACEHOLDERS = {
  hero: "Registration # or company name…",
  default: "Registration # or company name",
  compact: "Registration or name",
};

const OR_PLACEHOLDERS = {
  hero: "CCB license number or company name…",
  default: "CCB license # or company name",
  compact: "License or name",
};

const CA_PLACEHOLDERS = {
  hero: "CSLB license number or business name…",
  default: "CSLB license # or business name",
  compact: "License or name",
};

const AZ_PLACEHOLDERS = {
  hero: "ROC license number or business name…",
  default: "ROC license # or business name",
  compact: "License or name",
};

const WA_PLACEHOLDERS = {
  hero: "L&I license number or company name…",
  default: "L&I license # or company name",
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
  showStatePicker = false,
}: SearchFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickedState, setPickedState] = useState(stateSlug);
  const inputId = useId();

  const activeState = showStatePicker ? pickedState : stateSlug;
  const isHero = size === "hero";
  const isCompact = size === "compact";
  const isTx = activeState === "tx";
  const isNj = activeState === "nj";
  const isOr = activeState === "or";
  const isWa = activeState === "wa";
  const isCa = activeState === "ca";
  const isAz = activeState === "az";
  const ph =
    placeholder ||
    (isTx
      ? TX_PLACEHOLDERS[size]
      : isNj
        ? NJ_PLACEHOLDERS[size]
        : isOr
          ? OR_PLACEHOLDERS[size]
          : isWa
            ? WA_PLACEHOLDERS[size]
            : isCa
              ? CA_PLACEHOLDERS[size]
              : isAz
                ? AZ_PLACEHOLDERS[size]
                : PLACEHOLDERS[size]);

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
        if (activeState && activeState !== "fl") params.set("state", activeState);
        startTransition(() => {
          router.push(`/verify?${params.toString()}`);
        });
      }}
      className="w-full"
    >
      {intent && <input type="hidden" name="intent" value={intent} />}
      {activeState && activeState !== "fl" ? (
        <input type="hidden" name="state" value={activeState} />
      ) : null}
      {showStatePicker ? (
        <div
          className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
          role="group"
          aria-label="Search state"
        >
          {(
            [
              { id: "fl", label: "Florida", hint: "Full construction licenses" },
              { id: "tx", label: "Texas", hint: "TDLR + TSBPE plumbing" },
              { id: "nj", label: "New Jersey", hint: "HIC + specialty boards" },
              { id: "or", label: "Oregon", hint: "CCB statewide" },
              { id: "wa", label: "Washington", hint: "L&I contractors" },
              { id: "ca", label: "California", hint: "CSLB high-impact counties" },
              { id: "az", label: "Arizona", hint: "ROC + discipline" },
            ] as const
          ).map((s) => {
            const on = activeState === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setPickedState(s.id)}
                className={`inline-flex min-h-10 shrink-0 flex-col justify-center rounded-2xl border px-3.5 py-1.5 text-left sm:min-h-9 sm:flex-row sm:items-center sm:gap-2 sm:rounded-full sm:py-0 ${
                  on
                    ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                    : "border-[var(--border)] bg-[var(--bg)] text-[var(--navy)]"
                }`}
              >
                <span className="text-sm font-semibold leading-none">{s.label}</span>
                <span
                  className={`text-[10px] font-medium leading-none ${
                    on ? "text-white/75" : "text-[var(--muted)]"
                  }`}
                >
                  {s.hint}
                </span>
              </button>
            );
          })}
        </div>
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
