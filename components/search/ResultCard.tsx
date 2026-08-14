import Link from "next/link";
import { CompareToggle } from "@/components/compare/CompareToggle";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { displayStatusLabel, statusLabel, statusTone } from "@/lib/contractors/format";
import { occupationLabel } from "@/lib/states/config";
import { msSbcDisplayLabel, msSbcPublishedNumber } from "@/lib/states/ms-sbc";
import { laLslbcDisplayLabel } from "@/lib/states/la-lslbc";
import { azCategoryFromSecondary, azClassPlainLabel } from "@/lib/states/az-roc";
import {
  caClassChipLabel,
  caClassPlainLabel,
  getCaClassInfo,
} from "@/lib/states/ca-classifications";
import { getOrCcbTypeInfo, orCcbDisplayLabel } from "@/lib/states/or-ccb";
import { getNjCredentialInfo, njCredentialPlainLabel } from "@/lib/states/nj-credentials";
import {
  getTxTradeInfo,
  txTradeOfficialSuffix,
  txTradePlainLabel,
} from "@/lib/states/tx-trades";
import type { SearchResult } from "@/lib/contractors/types";

function signalTone(
  kind: "license" | "entity" | "discipline",
  result: SearchResult
): "good" | "warn" | "bad" | "neutral" {
  if (kind === "discipline") return result.hasDiscipline ? "warn" : "good";
  if (kind === "entity") {
    if (!result.entityStatus) return "neutral";
    const s = result.entityStatus.toLowerCase();
    if (s === "active" || s === "current") return "good";
    if (s === "inactive" || s === "dissolved") return "bad";
    return "warn";
  }
  // Prefer raw board status when present (Expired vs coarse Inactive)
  return statusTone(result.primaryStatus || result.licenseStatus);
}

const toneBar: Record<string, string> = {
  good: "bg-emerald-600",
  warn: "bg-amber-500",
  bad: "bg-rose-600",
  neutral: "bg-slate-400",
};

function isTexasResult(result: SearchResult): boolean {
  return (result.state || "").toUpperCase() === "TX";
}

function isNjResult(result: SearchResult): boolean {
  return (result.state || "").toUpperCase() === "NJ";
}

function isOregonResult(result: SearchResult): boolean {
  return (result.state || "").toUpperCase() === "OR" || result.sourceSystem === "or_ccb";
}

function isCaliforniaResult(result: SearchResult): boolean {
  return (result.state || "").toUpperCase() === "CA" || result.sourceSystem === "ca_cslb";
}

function isArizonaResult(result: SearchResult): boolean {
  return (result.state || "").toUpperCase() === "AZ" || result.sourceSystem === "az_roc";
}

function isWashingtonResult(result: SearchResult): boolean {
  return (result.state || "").toUpperCase() === "WA" || result.sourceSystem === "wa_lni";
}

function isLouisianaResult(result: SearchResult): boolean {
  return (result.state || "").toUpperCase() === "LA" || result.sourceSystem === "la_lslbc";
}

function isMississippiResult(result: SearchResult): boolean {
  return result.sourceSystem === "ms_sbc" || (result.state || "").toUpperCase() === "MS";
}

function displayLicenseKey(
  result: SearchResult,
  isTx: boolean,
  isNj: boolean
): string | null {
  const key = result.primaryLicenseKey;
  if (!key) return null;
  if (isTx) {
    // Prefer short numeric id when product key is long TX-TDLR:…
    const m = key.match(/:(\d+)(?::|$)/);
    if (m) return m[1];
  }
  if (isNj && key.includes(":")) {
    return key.split(":").pop() || key;
  }
  if (key.startsWith("OR-CCB:")) {
    const parts = key.split(":");
    return parts[1] || key;
  }
  if (key.startsWith("CA-CSLB:")) {
    return key.split(":").pop() || key;
  }
  if (key.startsWith("AZ-ROC:")) {
    return key.split(":").pop() || key;
  }
  if (key.startsWith("WA-LNI:")) {
    return key.split(":").pop() || key;
  }
  if (key.startsWith("LA-LSLBC:")) {
    return key.slice("LA-LSLBC:".length) || key;
  }
  if (key.startsWith("MS-SBC:")) {
    return msSbcPublishedNumber(key);
  }
  return key;
}

export function ResultCard({
  result,
  hideEntityWhenMissing = false,
}: {
  result: SearchResult;
  /** Specialty / pilot states without entity linking */
  hideEntityWhenMissing?: boolean;
}) {
  const isTx = isTexasResult(result);
  const isNj = isNjResult(result);
  const isOr = isOregonResult(result);
  const isCa = isCaliforniaResult(result);
  const isAz = isArizonaResult(result);
  const isWa = isWashingtonResult(result);
  const isLa = isLouisianaResult(result);
  const isMs = isMississippiResult(result);
  const location = [result.city, result.county, result.state].filter(Boolean).join(" · ");
  const licTone = signalTone("license", result);
  const entTone = signalTone("entity", result);
  const showEntity =
    Boolean(result.entityStatus) ||
    !(hideEntityWhenMissing || isTx || isNj || isOr || isCa || isAz || isWa || isLa || isMs);
  const trade = isTx ? getTxTradeInfo(result.occupationCode) : null;
  const njCred = isNj ? getNjCredentialInfo(result.occupationCode) : null;
  const orType = isOr ? getOrCcbTypeInfo(result.occupationCode) : null;
  const caClass = isCa ? getCaClassInfo(result.occupationCode) : null;
  const azClass = isAz ? azClassPlainLabel(result.occupationCode) : null;
  const azCategory = isAz ? azCategoryFromSecondary(result.secondaryStatus) : null;
  const tradeLabel = isNj
    ? njCredentialPlainLabel(result.occupationCode)
    : isTx
      ? txTradePlainLabel(result.occupationCode)
      : isOr
        ? orCcbDisplayLabel(result.occupationCode)
        : isCa
          ? caClassPlainLabel(result.occupationCode) || occupationLabel(result.occupationCode)
          : isAz
            ? // Do not fall through to CA labels — codes like C-39 collide across boards
              azClass ||
              (result.occupationCode
                ? `Class ${result.occupationCode}`
                : "Arizona ROC contractor")
            : isLa
              ? laLslbcDisplayLabel(result.occupationCode)
              : isMs
                ? msSbcDisplayLabel(result.occupationCode)
            : occupationLabel(result.occupationCode);
  const officialSuffix = isTx ? txTradeOfficialSuffix(result.occupationCode) : null;
  const shortKey = displayLicenseKey(result, isTx, isNj);

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-sm)] transition hover:border-[var(--navy)]/20 hover:shadow-[var(--shadow-md)]">
      {/* Status strip — fewer, clearer signals on mobile */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[var(--border)]/80 px-3.5 py-2.5 sm:gap-x-4 sm:px-5">
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <span className={`h-1.5 w-1.5 rounded-full ${toneBar[licTone]}`} aria-hidden />
          {isNj ? "Registration" : "License"}{" "}
          {displayStatusLabel(result.licenseStatus, result.primaryStatus)}
        </span>
        {isTx && trade ? (
          <span className="inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-[var(--navy)]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--navy)]/50" aria-hidden />
            <span className="truncate">{trade.chip}</span>
            <span className="hidden text-[var(--muted)] font-normal sm:inline">· specialty</span>
          </span>
        ) : null}
        {isNj && njCred ? (
          <span className="inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-[var(--navy)]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500/70" aria-hidden />
            <span className="truncate">{njCred.chip}</span>
            <span className="hidden text-[var(--muted)] font-normal sm:inline">· NJ</span>
          </span>
        ) : null}
        {isOr && orType ? (
          <span className="inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-[var(--navy)]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600/70" aria-hidden />
            <span className="truncate">{orType.chip}</span>
            <span className="hidden text-[var(--muted)] font-normal sm:inline">· CCB</span>
          </span>
        ) : null}
        {isCa && caClass ? (
          <span className="inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-[var(--navy)]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/80" aria-hidden />
            <span className="truncate">{caClassChipLabel(result.occupationCode)}</span>
            <span className="hidden text-[var(--muted)] font-normal sm:inline">· CSLB</span>
          </span>
        ) : null}
        {isAz ? (
          <span className="inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-[var(--navy)]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500/80" aria-hidden />
            <span className="truncate">
              {result.occupationCode || "ROC"}
              {azCategory ? ` · ${azCategory}` : ""}
            </span>
            <span className="hidden text-[var(--muted)] font-normal sm:inline">· ROC</span>
          </span>
        ) : null}
        {result.sourceSystem ? (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--muted)]">
            {result.sourceSystem}
          </span>
        ) : null}
        {showEntity ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <span className={`h-1.5 w-1.5 rounded-full ${toneBar[entTone]}`} aria-hidden />
            {result.entityStatus
              ? `Entity ${statusLabel(result.entityStatus)}`
              : "No Sunbiz link"}
          </span>
        ) : null}
        {location ? (
          <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-xs text-[var(--muted)] sm:max-w-[50%]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]/70" aria-hidden />
            <span className="truncate">{location}</span>
          </span>
        ) : null}
        {isTx ? null : result.hasDiscipline ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
            <span className={`h-1.5 w-1.5 rounded-full ${toneBar.warn}`} aria-hidden />
            {isNj
              ? "Enforcement flag on file"
              : isAz
                ? "ROC discipline on file"
                : "Discipline on file"}
          </span>
        ) : isNj ? (
          <span className="hidden items-center gap-1.5 text-xs text-[var(--muted)] sm:inline-flex">
            <span className={`h-1.5 w-1.5 rounded-full ${toneBar.neutral}`} aria-hidden />
            No enforcement flag in extract
          </span>
        ) : isAz ? (
          <span className="hidden items-center gap-1.5 text-xs text-[var(--muted)] sm:inline-flex">
            <span className={`h-1.5 w-1.5 rounded-full ${toneBar.good}`} aria-hidden />
            No ROC discipline row in extract
          </span>
        ) : (
          <span className="hidden items-center gap-1.5 text-xs text-[var(--muted)] sm:inline-flex">
            <span className={`h-1.5 w-1.5 rounded-full ${toneBar.good}`} aria-hidden />
            No discipline in extract
          </span>
        )}
      </div>

      <div className="p-3.5 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold leading-snug text-[var(--text)] sm:text-lg">
              <Link
                href={`/contractors/${encodeURIComponent(result.slug)}`}
                className="text-[var(--text)] no-underline hover:text-[var(--navy)]"
              >
                {result.displayName}
              </Link>
            </h2>
            {shortKey ? (
              <p className="mt-1 font-mono text-sm tracking-wide text-[var(--accent)]">
                {isTx || isNj ? (
                  <>
                    <span className="mr-1.5 font-sans text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                      {isNj ? "NJ" : "TDLR"}
                    </span>
                    {shortKey}
                    {result.primaryLicenseKey && result.primaryLicenseKey !== shortKey ? (
                      <span className="mt-0.5 block font-mono text-[11px] tracking-normal text-[var(--muted)] sm:mt-0 sm:ml-2 sm:inline">
                        {result.primaryLicenseKey}
                      </span>
                    ) : null}
                  </>
                ) : (
                  shortKey
                )}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5 sm:max-w-[42%] sm:justify-end">
            {isTx ? (
              <span className="inline-flex items-center rounded-full border border-[var(--navy)]/15 bg-[var(--navy)]/[0.04] px-2.5 py-1 text-[11px] font-medium text-[var(--navy)]">
                Specialty trade
              </span>
            ) : null}
            {isNj ? (
              <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-950">
                NJ pilot
              </span>
            ) : null}
            {isOr ? (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-950">
                Oregon CCB
              </span>
            ) : null}
            {isCa ? (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-950">
                California CSLB
              </span>
            ) : null}
            {isAz ? (
              <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-950">
                Arizona ROC
              </span>
            ) : null}
            {isWa ? (
              <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-950">
                Washington L&amp;I
              </span>
            ) : null}
            <StatusBadge
              status={result.primaryStatus || result.licenseStatus}
              label={`${isNj ? "Registration" : "License"}: ${displayStatusLabel(
                result.licenseStatus,
                result.primaryStatus
              )}`}
            />
            {result.entityStatus ? (
              <StatusBadge
                status={result.entityStatus}
                label={`Entity: ${statusLabel(result.entityStatus)}`}
              />
            ) : showEntity ? (
              <StatusBadge status="unknown" label="No entity link" />
            ) : null}
          </div>
        </div>

        <div className="mt-2.5 sm:mt-3">
          <p className="text-sm font-medium leading-snug text-[var(--text)]">{tradeLabel}</p>
          {officialSuffix ? (
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Official type: {officialSuffix}
            </p>
          ) : isTx ? (
            <p className="mt-0.5 text-xs text-[var(--muted)]">Texas specialty / plumbing license</p>
          ) : isNj ? (
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              NJ registration extract · not Florida-depth coverage
            </p>
          ) : isOr ? (
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {result.secondaryStatus || "Oregon CCB Active Licenses extract"}
            </p>
          ) : isAz ? (
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {result.secondaryStatus || "Arizona ROC current active posting list"}
            </p>
          ) : null}
          {(result.entityName || location) && !isTx && !isNj && !isOr && !isAz && !isWa ? (
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
              {result.entityName ? (
                <span className="text-[var(--text)]/80">Entity: {result.entityName}</span>
              ) : null}
              {result.entityName && location ? " · " : null}
              {location ? <span>{location}</span> : null}
            </p>
          ) : location && (isTx || isNj || isOr || isAz || isWa) ? (
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{location}</p>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link
            href={`/contractors/${encodeURIComponent(result.slug)}`}
            className="inline-flex min-h-10 items-center rounded-xl bg-[var(--navy)] px-3.5 text-xs font-semibold text-white no-underline sm:min-h-0 sm:bg-transparent sm:px-0 sm:font-medium sm:text-[var(--accent)] sm:hover:underline"
          >
            Open Trust Report
            <span className="ml-1 sm:ml-0" aria-hidden>
              →
            </span>
          </Link>
          <CompareToggle slug={result.slug} compact />
        </div>
      </div>
    </article>
  );
}
