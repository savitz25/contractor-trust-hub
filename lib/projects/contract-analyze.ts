import { CONTRACT_FLAGS } from "./contract-flags";
import type { ContractAnalysis, ContractFinding, FindingStatus } from "./types";

export type AnalyzeContractInput = {
  rawText: string;
  contractorName?: string;
  contractorSlug?: string;
  projectType?: string;
};

function uid(): string {
  return `ca_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function detectStatus(lower: string, keywords: string[]): FindingStatus {
  if (!lower.trim()) return "unclear";
  let hits = 0;
  let evidenceAt = -1;
  for (const k of keywords) {
    const idx = lower.indexOf(k.toLowerCase());
    if (idx >= 0) {
      hits++;
      if (evidenceAt < 0) evidenceAt = idx;
    }
  }
  if (hits === 0) return "missing";
  if (hits === 1 && lower.length < 200) return "unclear";
  return "present";
}

function snippet(text: string, lower: string, keywords: string[]): string | undefined {
  for (const k of keywords) {
    const idx = lower.indexOf(k.toLowerCase());
    if (idx >= 0) {
      return text.slice(Math.max(0, idx - 30), Math.min(text.length, idx + 100)).replace(/\s+/g, " ").trim();
    }
  }
  return undefined;
}

export function analyzeContract(input: AnalyzeContractInput): ContractAnalysis {
  const text = (input.rawText || "").replace(/\r/g, "\n");
  const lower = text.toLowerCase();
  const findings: ContractFinding[] = [];

  for (const flag of CONTRACT_FLAGS) {
    const status = detectStatus(lower, flag.presentKeywords);
    const detail =
      status === "present"
        ? `Language related to “${flag.label}” appears in the text.`
        : status === "missing"
          ? flag.missingHint
          : flag.unclearHint;
    findings.push({
      id: flag.id,
      category: flag.category,
      label: flag.label,
      status,
      detail,
      evidence: status === "present" ? snippet(text, lower, flag.presentKeywords) : undefined,
    });
  }

  const counts = {
    present: findings.filter((f) => f.status === "present").length,
    missing: findings.filter((f) => f.status === "missing").length,
    unclear: findings.filter((f) => f.status === "unclear").length,
  };

  const questions = CONTRACT_FLAGS.filter((f) => {
    const st = findings.find((x) => x.id === f.id)?.status;
    return st === "missing" || st === "unclear";
  })
    .map((f) => f.question)
    .slice(0, 14);

  // Always include a couple of evergreen clarifiers
  if (questions.length < 3) {
    questions.push(
      "Please confirm the legal entity name, license number, and total price in one written summary.",
      "Please confirm permit responsibility and the change-order process in writing."
    );
  }

  let confidence: ContractAnalysis["parseConfidence"] = "low";
  const signals =
    (text.length > 400 ? 1 : 0) +
    (counts.present >= 4 ? 1 : 0) +
    (counts.present >= 8 ? 1 : 0) +
    (/\$[\d,]+/.test(text) ? 1 : 0);
  if (signals >= 3) confidence = "high";
  else if (signals >= 2) confidence = "medium";

  const parseNotes: string[] = [];
  if (!text.trim()) {
    parseNotes.push("No text provided — use paste or manual review against the checklist.");
  } else if (confidence === "low") {
    parseNotes.push("Limited structure detected — correct findings manually and re-read the original PDF.");
  } else if (confidence === "medium") {
    parseNotes.push("Partial extraction — confirm every missing/unclear item against the signed version.");
  } else {
    parseNotes.push("Several structured terms found — still verify against the full original contract.");
  }
  if (text.length > 0 && text.length < 120) {
    parseNotes.push("Very short text — consider pasting more pages or filling fields from the PDF manually.");
  }

  return {
    id: uid(),
    contractorName: input.contractorName,
    contractorSlug: input.contractorSlug,
    projectType: input.projectType,
    rawText: text,
    parseConfidence: confidence,
    parseNotes,
    findings,
    questions: [...new Set(questions)],
    counts,
    generatedAt: new Date().toISOString(),
  };
}
