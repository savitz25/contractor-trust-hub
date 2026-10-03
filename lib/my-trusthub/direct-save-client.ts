/**
 * Browser side of the Contractor Save hand-off (the Move model).
 *
 * The device Save is always written or cleared by the caller before any of this
 * runs. This only stages the hand-off through the same-origin endpoint and, if
 * the server returns a parent form target, hands the browser to it. Nothing
 * here is authority: the ticket is an opaque retry reference, and the markers
 * only choose a message or whether an Unsave is worth offering to the parent.
 *
 * The hand-off is a chain of navigations that a click elsewhere abandons
 * part-way. So neither a Save nor an Unsave is reported as reaching the account
 * unless the server holds the parent's signed acknowledgement for that ticket,
 * and an Unsave that is not acknowledged leaves the device believing the
 * profile is still in My TrustHub so it can be retried.
 *
 * With production sync off the endpoint answers "unavailable" and every call
 * here returns without navigating.
 */
export type DirectIntent = "save" | "unsave";
export type ParentSync = "synced" | "unknown";
export type StartResult = "navigating" | "unavailable" | "not_eligible" | "dry_run";
/** confirmed: the parent acknowledged this ticket. not_confirmed: it did not act. unknown: outcome unreadable. */
export type DirectOutcome = { intent: DirectIntent; outcome: "confirmed" | "not_confirmed" | "unknown" };
type KeyValue = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type DirectPorts = {
  /** Same-origin endpoint call. Rejects on any non-2xx response. */
  post(body: unknown, csrf?: string): Promise<unknown>;
  /** Top-level form POST to the validated parent target. */
  submit(target: string, fields: Record<string, string>): void;
  /** Device storage: an abandoned hand-off is still reported on the next visit. */
  local: KeyValue;
};

const OPAQUE = /^[A-Za-z0-9_-]{43}$/;
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const pendingKey = (slug: string) => "cth-mth-direct:" + slug;
const syncKey = (slug: string) => "cth-mth-parent-sync:" + slug;
const read = (store: KeyValue, key: string) => { try { return store.getItem(key); } catch { return null; } };
const write = (store: KeyValue, key: string, value: string | null) => {
  try { if (value === null) store.removeItem(key); else store.setItem(key, value); } catch { /* storage unavailable */ }
};

/** Exactly the production Ask form, or a local/test host. No query, fragment or credentials. */
export function handoffTargetAllowed(target: unknown): target is string {
  if (typeof target !== "string") return false;
  try {
    const url = new URL(target);
    if (url.search || url.hash || url.username || url.password) return false;
    if (url.origin === "https://www.asktrusthub.com") return url.pathname === "/my/profile-save";
    return ["http:", "https:"].includes(url.protocol) && (url.hostname.endsWith(".test") || ["localhost", "127.0.0.1"].includes(url.hostname));
  } catch { return false; }
}

/** Whether this device believes the profile is in My TrustHub. */
export function parentSync(local: KeyValue, slug: string): ParentSync | null {
  const value = read(local, syncKey(slug));
  return value === "synced" || value === "unknown" ? value : null;
}

/** Stage and hand off. `navigating`: the browser is leaving for the parent
 * form. Every other result means nothing left this page and the device state
 * stands. `proceed` is asked right before the hand-off: once the user has left
 * the profile, nothing navigates. */
export async function startDirect(ports: DirectPorts, slug: string, intent: DirectIntent, proceed: () => boolean = () => true): Promise<StartResult> {
  try {
    const csrf = record(await ports.post({ action: "bootstrap" })).csrf;
    if (typeof csrf !== "string") return "unavailable";
    const result = record(await ports.post({ action: "prepare", slug, intent }, csrf));
    if (result.state === "local_only") return "not_eligible";
    if (result.state === "staged_dry_run") return "dry_run";
    const continuationRef = record(result.fields).continuationRef;
    if (result.state !== "continue" || !OPAQUE.test(String(result.ticket)) || !OPAQUE.test(String(continuationRef)) || !handoffTargetAllowed(result.target)) return "unavailable";
    if (!proceed()) return "unavailable";
    // Opaque retry reference and the intent only; never research or account data.
    write(ports.local, pendingKey(slug), JSON.stringify({ intent, ticket: result.ticket }));
    ports.submit(result.target, { continuationRef: String(continuationRef), intent });
    return "navigating";
  } catch { return "unavailable"; }
}

/** When the profile is next shown (normally the parent's return): consume the
 * pending marker once and report what the parent acknowledged. */
export async function resumeDirect(ports: DirectPorts, slug: string): Promise<DirectOutcome | null> {
  const raw = read(ports.local, pendingKey(slug));
  if (!raw) return null;
  write(ports.local, pendingKey(slug), null);
  let pending: Record<string, unknown>;
  try { pending = record(JSON.parse(raw)); } catch { return null; }
  const intent = pending.intent;
  if ((intent !== "save" && intent !== "unsave") || !OPAQUE.test(String(pending.ticket))) return null;
  try {
    const csrf = record(await ports.post({ action: "bootstrap" })).csrf;
    if (typeof csrf !== "string") throw new Error("unavailable");
    const state = record(await ports.post({ action: "status", ticket: pending.ticket }, csrf)).state;
    if (state !== "parent_acknowledged" && state !== "pending") throw new Error("unavailable");
    const confirmed = state === "parent_acknowledged";
    if (intent === "unsave") {
      // Acknowledged: the account no longer holds it. Otherwise keep believing
      // it is in My TrustHub so the Unsave can be offered again.
      if (confirmed) write(ports.local, syncKey(slug), null);
      return { intent, outcome: confirmed ? "confirmed" : "not_confirmed" };
    }
    write(ports.local, syncKey(slug), confirmed ? "synced" : null);
    return { intent, outcome: confirmed ? "confirmed" : "not_confirmed" };
  } catch {
    if (intent !== "unsave") write(ports.local, syncKey(slug), "unknown");
    return { intent, outcome: "unknown" };
  }
}

const ENDPOINT = "/api/my-trusthub/profile-save";
/** Browser ports: same-origin fetch and a native form POST. */
export function browserDirectPorts(): DirectPorts {
  return {
    async post(body, csrf) {
      const response = await fetch(ENDPOINT, { method: "POST", credentials: "same-origin", redirect: "error", cache: "no-store",
        headers: { "Content-Type": "application/json", ...(csrf ? { "X-CTH-CSRF": csrf } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error("unavailable");
      return response.json();
    },
    submit(target, fields) {
      const form = document.createElement("form"); form.method = "POST"; form.action = target;
      for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement("input"); input.type = "hidden"; input.name = name; input.value = value; form.append(input);
      }
      document.body.append(form); form.submit();
    },
    local: localStorage,
  };
}
