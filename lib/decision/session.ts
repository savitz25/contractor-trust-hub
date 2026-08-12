/** localStorage keys for Decision Engine session state. */

export const DECISION_KEYS = {
  scope: "cth-decision-scope",
  quoteAnalysis: "cth-decision-quote-analysis",
  compareBids: "cth-decision-compare-bids",
  checklist: "cth-decision-checklist",
  questions: "cth-decision-questions-context",
} as const;

export function loadJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export function removeKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
