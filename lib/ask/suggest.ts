import { CLASS_LABELS, EVIDENCE_ONTOLOGY, GEO_ONTOLOGY, TRADE_ONTOLOGY, normalizeAskText } from "./ontology";

export type AskSuggestion = { label: string; prompt: string; kind: "trade" | "geo" | "evidence" | "class" };

export function suggestAskCompletions(raw: string): AskSuggestion[] {
  const q = normalizeAskText(raw);
  if (q.length < 3) return [];
  const out: AskSuggestion[] = [];
  for (const t of TRADE_ONTOLOGY) {
    if (t.phrases.some((p) => p.startsWith(q) || q.startsWith(p.slice(0, Math.max(3, q.length))))) {
      out.push({ label: t.label, prompt: `Show active ${t.label.toLowerCase()} contractors in Florida.`, kind: "trade" });
      for (const code of t.exactClasses) {
        const name = CLASS_LABELS[code];
        if (name) out.push({ label: name, prompt: `Show active ${name} records in Florida.`, kind: "class" });
      }
    }
  }
  for (const g of GEO_ONTOLOGY) {
    if (g.phrases.some((p) => p.startsWith(q) || q.startsWith(p.slice(0, Math.max(3, q.length))))) {
      out.push({
        label: g.label,
        prompt: g.kind === "county" ? `Show active roofing contractors in ${g.label}.` : "Show active roofing contractors in Florida.",
        kind: "geo",
      });
    }
  }
  for (const e of EVIDENCE_ONTOLOGY) {
    if (e.phrases.some((p) => p.startsWith(q) || q.includes(p) || p.startsWith(q))) {
      out.push({ label: e.label, prompt: `Show Florida contractors with ${e.label}.`, kind: "evidence" });
    }
  }
  const seen = new Set<string>();
  return out.filter((s) => {
    if (seen.has(s.label)) return false;
    seen.add(s.label);
    return true;
  }).slice(0, 8);
}
