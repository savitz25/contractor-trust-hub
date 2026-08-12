import type { ProjectTypeId, ScaleBand } from "@/lib/plan/types";
import type {
  BidComparison,
  BidSlot,
  CompareDiff,
  QuoteAnalysis,
  QuoteItemStatus,
  QuoteLineStatus,
} from "./types";
import { scopeTemplateFor } from "./scope-templates";
import { generateQuestionsFromComparison } from "./questions";

function uid(): string {
  return `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function analysisToBidSlot(a: QuoteAnalysis, index: number): BidSlot {
  return {
    id: a.id || `bid_${index}`,
    label: a.contractorName?.trim() || `Bid ${index + 1}`,
    contractorName: a.contractorName,
    contractorSlug: a.contractorSlug,
    totalPrice: a.totalPrice,
    depositTerms:
      a.depositPercent != null
        ? `${a.depositPercent}% deposit${a.depositAmount != null ? ` (≈ $${Math.round(a.depositAmount).toLocaleString()})` : ""}`
        : a.depositAmount != null
          ? `$${Math.round(a.depositAmount).toLocaleString()} deposit`
          : a.paymentTerms || "Not clearly stated",
    timelineLanguage: a.timelineLanguage || "Not clearly stated",
    warrantyLanguage: a.warrantyLanguage || "Not clearly stated",
    permitLanguage: a.permitLanguage || "Not clearly stated",
    items: a.scopeItems,
    rawNotes: a.parseNotes.join(" "),
  };
}

function statusFor(items: QuoteLineStatus[], id: string): QuoteItemStatus {
  return items.find((i) => i.id === id)?.status || "unclear";
}

export function buildBidComparison(input: {
  projectType: ProjectTypeId;
  scale?: ScaleBand;
  locationLabel?: string;
  bids: BidSlot[];
}): BidComparison {
  const bids = input.bids.slice(0, 4);
  const template = scopeTemplateFor(input.projectType);

  const matrixRows = [
    {
      id: "total",
      label: "Total quoted price",
      cells: bids.map((b) => ({
        status: (b.totalPrice != null ? "included" : "missing") as QuoteItemStatus,
        note:
          b.totalPrice != null
            ? `$${Math.round(b.totalPrice).toLocaleString()}`
            : "Not stated",
      })),
    },
    {
      id: "deposit",
      label: "Deposit terms",
      cells: bids.map((b) => ({
        status: (b.depositTerms && !b.depositTerms.includes("Not clearly")
          ? "included"
          : "unclear") as QuoteItemStatus,
        note: b.depositTerms || "Not clearly stated",
      })),
    },
    {
      id: "permits",
      label: "Permit responsibility",
      cells: bids.map((b) => ({
        status: (b.permitLanguage && !b.permitLanguage.includes("Not clearly")
          ? "included"
          : "missing") as QuoteItemStatus,
        note: b.permitLanguage || "Not clearly stated",
      })),
    },
    {
      id: "timeline",
      label: "Timeline language",
      cells: bids.map((b) => ({
        status: (b.timelineLanguage && !b.timelineLanguage.includes("Not clearly")
          ? "included"
          : "missing") as QuoteItemStatus,
        note: b.timelineLanguage || "Not clearly stated",
      })),
    },
    {
      id: "warranty",
      label: "Warranty language",
      cells: bids.map((b) => ({
        status: (b.warrantyLanguage && !b.warrantyLanguage.includes("Not clearly")
          ? "included"
          : "missing") as QuoteItemStatus,
        note: b.warrantyLanguage || "Not clearly stated",
      })),
    },
    ...template.slice(0, 12).map((t) => ({
      id: t.id,
      label: t.label,
      cells: bids.map((b) => {
        const st = statusFor(b.items, t.id);
        return {
          status: st,
          note: b.items.find((i) => i.id === t.id)?.evidence,
        };
      }),
    })),
  ];

  const differences: CompareDiff[] = [];
  const prices = bids
    .map((b) => b.totalPrice)
    .filter((n): n is number => n != null && n > 0);
  if (prices.length >= 2) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const spread = max - min;
    const minBid = bids.find((b) => b.totalPrice === min);
    const maxBid = bids.find((b) => b.totalPrice === max);
    differences.push({
      id: "price_spread",
      title: "Price spread between bids",
      detail: `Range is about $${Math.round(spread).toLocaleString()} (${minBid?.label} lower, ${maxBid?.label} higher). Check whether the lower bid excludes work or uses larger allowances.`,
    });
  }

  for (const row of matrixRows) {
    if (row.id === "total" || row.id === "deposit") continue;
    const statuses = new Set(row.cells.map((c) => c.status));
    if (statuses.size >= 2 && (statuses.has("included") || statuses.has("allowance"))) {
      if (statuses.has("missing") || statuses.has("excluded") || statuses.has("allowance")) {
        differences.push({
          id: `diff_${row.id}`,
          title: `Mismatch: ${row.label}`,
          detail:
            "Bidders do not treat this item the same (included vs allowance vs missing/excluded). Align scope before choosing on price alone.",
        });
      }
    }
  }

  // Lower bid with more missing items
  if (prices.length >= 2) {
    const sorted = [...bids].filter((b) => b.totalPrice != null).sort(
      (a, b) => (a.totalPrice || 0) - (b.totalPrice || 0)
    );
    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];
    if (lowest && highest) {
      const lowMissing = lowest.items.filter((i) => i.status === "missing" || i.status === "allowance").length;
      const highMissing = highest.items.filter((i) => i.status === "missing" || i.status === "allowance").length;
      if (lowMissing > highMissing + 1) {
        differences.push({
          id: "cheap_incomplete",
          title: "Lower bid may omit more items",
          detail: `${lowest.label} has more missing/allowance-style items than ${highest.label}. A lower number is not automatically a better value until scope matches.`,
        });
      }
    }
  }

  const comparison: BidComparison = {
    id: uid(),
    projectType: input.projectType,
    scale: input.scale || "medium",
    locationLabel: input.locationLabel || "Florida",
    bids,
    matrixRows,
    differences: differences.slice(0, 10),
    sharedQuestions: [],
    generatedAt: new Date().toISOString(),
  };
  comparison.sharedQuestions = generateQuestionsFromComparison(comparison);
  return comparison;
}
