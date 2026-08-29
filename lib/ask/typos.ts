import { EVIDENCE_ONTOLOGY, GEO_ONTOLOGY, TRADE_ONTOLOGY, normalizeAskText } from "./ontology";

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
      prev = tmp;
    }
  }
  return dp[m];
}

const DICTIONARY: Array<{ token: string; label: string }> = [
  ...TRADE_ONTOLOGY.flatMap((t) => t.phrases.filter((p) => p.length >= 5).map((p) => ({ token: p, label: t.label }))),
  ...GEO_ONTOLOGY.flatMap((g) => g.phrases.filter((p) => p.length >= 5).map((p) => ({ token: p, label: g.label }))),
  ...EVIDENCE_ONTOLOGY.flatMap((e) => e.phrases.filter((p) => p.length >= 5).map((p) => ({ token: p, label: e.label }))),
  { token: "contractor", label: "contractor" },
  { token: "contractors", label: "contractors" },
];

export type TypoSuggestion = { from: string; to: string; label: string };

/** Conservative: only suggest, never silently rewrite. */
export function suggestTypos(raw: string): TypoSuggestion[] {
  const text = normalizeAskText(raw);
  const tokens = text.split(" ").filter((t) => t.length >= 5);
  const out: TypoSuggestion[] = [];
  for (const token of tokens) {
    if (DICTIONARY.some((d) => d.token === token)) continue;
    let best: TypoSuggestion | null = null;
    let bestDist = 3;
    for (const d of DICTIONARY) {
      const dist = levenshtein(token, d.token);
      const allowed = token.length >= 7 ? 2 : 1;
      if (dist > 0 && dist <= allowed && dist < bestDist) {
        bestDist = dist;
        best = { from: token, to: d.token, label: d.label };
      }
    }
    if (best && !out.some((x) => x.from === best!.from)) out.push(best);
  }
  return out.slice(0, 3);
}

export function applyTypoSuggestion(raw: string, from: string, to: string): string {
  const re = new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return raw.replace(re, to);
}
