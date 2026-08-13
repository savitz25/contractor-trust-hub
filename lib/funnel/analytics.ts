/**
 * Lightweight funnel instrumentation for Stage 8B.
 * Emits CustomEvent + data-funnel attributes; optional gtag/dataLayer if present.
 */

export type FunnelEvent =
  | "entry_path"
  | "scope_created"
  | "quote_analyzed"
  | "bids_compared"
  | "trust_report_viewed"
  | "checklist_started"
  | "checklist_completed"
  | "contract_analyzed"
  | "project_created"
  | "project_completed"
  | "passport_entry_created"
  | "next_action_click";

export type FunnelProps = Record<string, string | number | boolean | null | undefined>;

export function trackFunnel(event: FunnelEvent, props: FunnelProps = {}): void {
  if (typeof window === "undefined") return;
  const payload = {
    event,
    ...props,
    ts: new Date().toISOString(),
    path: window.location.pathname,
  };
  try {
    window.dispatchEvent(new CustomEvent("cth-funnel", { detail: payload }));
  } catch {
    /* ignore */
  }
  try {
    const w = window as unknown as {
      dataLayer?: Array<Record<string, unknown>>;
      gtag?: (...args: unknown[]) => void;
    };
    w.dataLayer?.push({ ...payload, event: `cth_${event}` });
    w.gtag?.("event", `cth_${event}`, props);
  } catch {
    /* analytics optional */
  }
  try {
    const key = "cth-funnel-log-v1";
    const prev = JSON.parse(localStorage.getItem(key) || "[]") as unknown[];
    const next = [...prev.slice(-99), payload];
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** data-* attrs for progressive enhancement / CSS hooks */
export function funnelDataAttrs(
  event: FunnelEvent,
  extra?: FunnelProps
): Record<string, string> {
  const out: Record<string, string> = { "data-funnel-event": event };
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v == null || v === "") continue;
      out[`data-funnel-${k.replace(/[^a-z0-9_-]/gi, "")}`] = String(v);
    }
  }
  return out;
}
