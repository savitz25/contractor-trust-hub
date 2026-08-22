"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { getLiveStates } from "@/lib/states/config";

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
  /** Active Verify work chip — preserved on submit */
  workIntent?: string | null;
};

const PLACEHOLDERS = {
  hero: "License number (CBC015082) or company name...",
  default: "License (CBC015082) or company name",
  compact: "License or company name",
};

const TX_PLACEHOLDERS = {
  hero: "License # or business / owner name...",
  default: "License # or business name",
  compact: "License or name",
};

const NJ_PLACEHOLDERS = {
  hero: "Registration # or company name...",
  default: "Registration # or company name",
  compact: "Registration or name",
};

const OR_PLACEHOLDERS = {
  hero: "CCB license number or company name...",
  default: "CCB license # or company name",
  compact: "License or name",
};

const CA_PLACEHOLDERS = {
  hero: "CSLB license number or business name...",
  default: "CSLB license # or business name",
  compact: "License or name",
};

const AZ_PLACEHOLDERS = {
  hero: "ROC license number or business name...",
  default: "ROC license # or business name",
  compact: "License or name",
};

const WA_PLACEHOLDERS = {
  hero: "L&I license number or company name...",
  default: "L&I license # or company name",
  compact: "License or name",
};

const LA_PLACEHOLDERS = {
  hero: "LSLBC license number or company name...",
  default: "LSLBC license # or company name",
  compact: "License or name",
};

const MS_PLACEHOLDERS = {
  hero: "MSBOC license number or company name...",
  default: "MSBOC license # or company name",
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
  workIntent = null,
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
  const isLa = activeState === "la";
  const isMs = activeState === "ms";
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
                : isLa
                  ? LA_PLACEHOLDERS[size]
                  : isMs
                    ? MS_PLACEHOLDERS[size]
                : PLACEHOLDERS[size]);

  const inputClass = isHero
    ? "th-field-hero w-full flex-1 bg-white px-4 text-[16px] text-[var(--text)] shadow-[var(--shadow-sm)] placeholder:text-[var(--muted)] outline-none ring-[var(--accent)] focus:ring-2 disabled:opacity-70 sm:px-5"
    : isCompact
      ? "th-field w-full flex-1 bg-white px-3 text-[16px] text-[var(--text)] placeholder:text-[var(--muted)] outline-none ring-[var(--accent)] focus:ring-2 disabled:opacity-70"
      : "th-field-hero w-full flex-1 bg-white px-4 text-[16px] text-[var(--text)] shadow-[var(--shadow-sm)] placeholder:text-[var(--muted)] outline-none ring-[var(--accent)] focus:ring-2 disabled:opacity-70";

  const buttonClass = isHero
    ? "th-btn-hero w-full shrink-0 px-6 disabled:cursor-wait disabled:opacity-70 sm:w-auto sm:px-10"
    : isCompact
      ? "th-btn-primary w-full px-4 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
      : "th-btn-hero w-full px-6 disabled:cursor-wait disabled:opacity-70 sm:w-auto";

  return (
    <form
      action="/verify"
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const q = String(fd.get("q") || "").trim();
        const work = String(fd.get("work") || workIntent || "").trim();
        if (q.length < 2 && !work) return;
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (intent) params.set("intent", intent);
        if (activeState && activeState !== "fl") params.set("state", activeState);
        if (work) params.set("work", work);
        startTransition(() => {
          router.push(`/verify?${params.toString()}`);
        });
      }}
      className="w-full"
    >
      {intent && <input type="hidden" name="intent" value={intent} />}
      {workIntent ? <input type="hidden" name="work" value={workIntent} /> : null}
      {activeState && activeState !== "fl" ? (
        <input type="hidden" name="state" value={activeState} />
      ) : null}
      {showStatePicker ? (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Search state">
          {getLiveStates().map((s) => {
            const on = activeState === s.slug;
            const hint = s.scopeHint || s.shortName;
            return (
              <button
                key={s.slug}
                type="button"
                onClick={() => setPickedState(s.slug)}
                aria-pressed={on}
                className={`inline-flex min-h-10 flex-col justify-center rounded-2xl border px-3.5 py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:min-h-9 sm:flex-row sm:items-center sm:gap-2 sm:rounded-full sm:py-1 ${
                  on ? "control-selected" : "control-off"
                }`}
              >
                <span className="text-sm font-semibold leading-none">{s.name}</span>
                <span className="text-[10px] font-medium leading-none">{hint}</span>
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
          required={!workIntent}
          minLength={workIntent ? undefined : 2}
          defaultValue={defaultQuery}
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="search"
          disabled={pending}
          placeholder={ph}
          className={inputClass}
        />
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Searching..." : "Verify"}
        </button>
      </div>
    </form>
  );
}
