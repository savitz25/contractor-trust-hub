/** Client-safe Ask URL helpers. No Node built-ins. */

export const ASK_CLEARED = "-";

export type AskUrlOverrides = {
  geo?: string | null;
  geoAction?: string | null;
  geoChoice?: string | null;
  trade?: string | null;
  status?: string | null;
  evidence?: string | null;
  sort?: string | null;
  page?: string | null;
};

export function askHref(q: string, plan?: AskUrlOverrides): string {
  const sp = new URLSearchParams();
  const query = q.trim();
  if (query) sp.set("q", query);
  if (plan?.geo) sp.set("geo", plan.geo);
  if (plan?.geoAction) sp.set("geoAction",plan.geoAction);
  if (plan?.geoChoice) sp.set("geoChoice",plan.geoChoice);
  if (plan?.trade) sp.set("trade", plan.trade);
  if (plan?.status) sp.set("status", plan.status);
  if (plan?.evidence) sp.set("evidence", plan.evidence);
  if (plan?.sort) sp.set("sort", plan.sort);
  if (plan?.page && plan.page !== "1") sp.set("page", plan.page);
  const qs = sp.toString();
  return qs ? `/ask?${qs}` : "/ask";
}
