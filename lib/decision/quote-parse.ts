/** Heuristic quote text extraction — degrades to manual entry when weak. */

export type ParsedQuoteFields = {
  contractorName?: string;
  totalPrice: number | null;
  depositAmount: number | null;
  depositPercent: number | null;
  paymentTerms?: string;
  timelineLanguage?: string;
  warrantyLanguage?: string;
  permitLanguage?: string;
  foundItemHints: string[];
  confidence: "low" | "medium" | "high";
  notes: string[];
};

function parseMoney(s: string): number | null {
  const cleaned = s.replace(/[,$]/g, "").replace(/\s/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function firstMoney(re: RegExp, text: string): number | null {
  const m = text.match(re);
  if (!m) return null;
  return parseMoney(m[1] || m[0]);
}

/**
 * Extract common estimate fields from pasted text.
 * Not OCR — user should upload text layer PDFs or paste text; images need manual entry.
 */
export function parseQuoteText(raw: string): ParsedQuoteFields {
  const text = raw.replace(/\r/g, "\n");
  const lower = text.toLowerCase();
  const notes: string[] = [];
  const foundItemHints: string[] = [];

  if (!text.trim()) {
    return {
      totalPrice: null,
      depositAmount: null,
      depositPercent: null,
      foundItemHints: [],
      confidence: "low",
      notes: ["No text provided — use manual fields."],
    };
  }

  // Total
  let totalPrice =
    firstMoney(
      /(?:grand\s*total|total\s*(?:price|amount|due|estimate|bid)|contract\s*price|job\s*total)[:\s]*\$?\s*([\d,]+(?:\.\d{2})?)/i,
      text
    ) ||
    firstMoney(/\$\s*([\d,]{4,}(?:\.\d{2})?)/, text);

  // Prefer largest dollar-looking amount if multiple
  const allMoney = [...text.matchAll(/\$\s*([\d,]+(?:\.\d{2})?)/g)]
    .map((m) => parseMoney(m[1]))
    .filter((n): n is number => n != null && n >= 500);
  if (allMoney.length > 0) {
    const max = Math.max(...allMoney);
    if (totalPrice == null || max > totalPrice * 1.05) {
      // only override if we didn't find a labeled total, or max is clearly the total
      if (totalPrice == null) totalPrice = max;
    }
  }

  // Deposit
  let depositAmount = firstMoney(
    /(?:deposit|down\s*payment|retainer)[:\s]*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    text
  );
  let depositPercent: number | null = null;
  const pct = text.match(
    /(?:deposit|down\s*payment)[^\n%]{0,40}?(\d{1,2}(?:\.\d+)?)\s*%/i
  );
  if (pct) depositPercent = Number(pct[1]);
  if (depositAmount == null && depositPercent != null && totalPrice) {
    depositAmount = Math.round((totalPrice * depositPercent) / 100);
  }
  if (depositPercent == null && depositAmount != null && totalPrice) {
    depositPercent = Math.round((depositAmount / totalPrice) * 1000) / 10;
  }

  // Contractor name heuristics
  let contractorName: string | undefined;
  const nameLine = text.match(
    /(?:contractor|company|business|from)[:\s]+([A-Za-z0-9 &.'-]{3,60})/i
  );
  if (nameLine) contractorName = nameLine[1].trim();

  // Payment / timeline / warranty / permit snippets
  const paymentTerms = snippet(lower, text, [
    "payment",
    "progress payment",
    "draw schedule",
    "cash only",
    "check payable",
  ]);
  const timelineLanguage = snippet(lower, text, [
    "timeline",
    "schedule",
    "duration",
    "weeks",
    "completion",
    "start date",
  ]);
  const warrantyLanguage = snippet(lower, text, ["warranty", "guarantee", "workmanship"]);
  const permitLanguage = snippet(lower, text, [
    "permit",
    "inspection",
    "building department",
    "owner to obtain",
  ]);

  // Item hints
  const hintWords = [
    "demo",
    "debris",
    "cabinet",
    "countertop",
    "plumbing",
    "electrical",
    "permit",
    "tile",
    "shower",
    "roof",
    "shingle",
    "allowance",
    "exclusion",
    "not included",
    "owner furnish",
  ];
  for (const w of hintWords) {
    if (lower.includes(w)) foundItemHints.push(w);
  }

  let confidence: "low" | "medium" | "high" = "low";
  let signals = 0;
  if (totalPrice) signals++;
  if (depositAmount || depositPercent) signals++;
  if (foundItemHints.length >= 3) signals++;
  if (paymentTerms || timelineLanguage) signals++;
  if (text.length > 400) signals++;
  if (signals >= 4) confidence = "high";
  else if (signals >= 2) confidence = "medium";

  if (confidence === "low") {
    notes.push("Limited structure detected — review and correct fields manually.");
  } else if (confidence === "medium") {
    notes.push("Partial extraction — confirm totals and line items before relying on flags.");
  } else {
    notes.push("Structured fields found — still verify against the original estimate.");
  }

  if (/cash\s*only|cash\s*discount/i.test(text)) {
    notes.push("Cash-only or cash-discount language detected — worth confirming payment method.");
  }

  return {
    contractorName,
    totalPrice,
    depositAmount,
    depositPercent,
    paymentTerms,
    timelineLanguage,
    warrantyLanguage,
    permitLanguage,
    foundItemHints,
    confidence,
    notes,
  };
}

function snippet(lower: string, original: string, keys: string[]): string | undefined {
  for (const k of keys) {
    const idx = lower.indexOf(k);
    if (idx >= 0) {
      const start = Math.max(0, idx - 20);
      const end = Math.min(original.length, idx + 120);
      return original.slice(start, end).replace(/\s+/g, " ").trim();
    }
  }
  return undefined;
}

/** Read text from uploaded file (text/plain or PDF with extractable text only). */
export async function readFileAsText(file: File): Promise<string> {
  if (file.type.startsWith("image/")) {
    return "";
  }
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    // Browser cannot reliably extract PDF text without a library — return empty for manual entry
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf.slice(0, Math.min(buf.byteLength, 500_000)));
    // Attempt crude string extract from PDF streams
    let out = "";
    let ascii = "";
    for (let i = 0; i < bytes.length; i++) {
      const c = bytes[i];
      if (c >= 32 && c < 127) ascii += String.fromCharCode(c);
      else {
        if (ascii.length > 4) out += ascii + " ";
        ascii = "";
      }
    }
    if (ascii.length > 4) out += ascii;
    // Clean PDF operators noise a bit
    const cleaned = out
      .replace(/\\[nrt]/g, " ")
      .replace(/[()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned.length > 80 ? cleaned : "";
  }
  return file.text();
}
