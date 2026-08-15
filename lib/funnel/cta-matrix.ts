/**
 * CTA matrix for Florida conversion funnel (Stage 8B).
 * One primary + up to two secondary + continuity link.
 */

import { toolHref } from "./journey-context";

export type CtaLink = {
  href: string;
  label: string;
  /** funnel event name for click tracking */
  event?: string;
};

export type NextActionSpec = {
  surface: string;
  eyebrow: string;
  title: string;
  body: string;
  primary: CtaLink;
  secondary: CtaLink[];
  continuity: CtaLink;
};

export function planResultsActions(ctx: {
  firstContractorSlug?: string | null;
  projectType?: string;
  scale?: string;
  zip?: string;
  city?: string;
}): NextActionSpec {
  const scope = toolHref("/tools/scope-builder", {
    type: ctx.projectType,
    scale: ctx.scale,
    zip: ctx.zip,
    city: ctx.city,
    from: "plan",
  });
  return {
    surface: "plan_results",
    eyebrow: "Next best action",
    title: "Next: make this scope bid-ready",
    body: "Turn plan answers into a contractor-ready scope, then analyze quotes with the same inclusions.",
    primary: {
      href: scope,
      label: "Build contractor-ready scope",
      event: "scope_created",
    },
    secondary: [
      {
        href: toolHref("/tools/quote-analyzer", {
          type: ctx.projectType,
          scale: ctx.scale,
          zip: ctx.zip,
          from: "plan",
        }),
        label: "Analyze a quote",
      },
      {
        href: ctx.firstContractorSlug
          ? `/contractors/${encodeURIComponent(ctx.firstContractorSlug)}`
          : "/verify",
        label: "Verify contractors",
      },
    ],
    continuity: { href: "/account", label: "Save / continue later" },
  };
}

export function scopeBuilderActions(ctx: {
  projectType?: string;
  scale?: string;
  zip?: string;
  city?: string;
}): NextActionSpec {
  return {
    surface: "scope_builder",
    eyebrow: "Next best action",
    title: "Next: check what this quote leaves unclear",
    body: "Use this scope when you review estimates so missing line items are visible.",
    primary: {
      href: toolHref("/tools/quote-analyzer", {
        type: ctx.projectType,
        scale: ctx.scale,
        zip: ctx.zip,
        city: ctx.city,
        from: "scope",
      }),
      label: "Analyze a quote",
      event: "quote_analyzed",
    },
    secondary: [
      {
        href: toolHref("/tools/compare-bids", {
          type: ctx.projectType,
          scale: ctx.scale,
          from: "scope",
        }),
        label: "Compare bids",
      },
      {
        href: toolHref("/verify", { from: "scope" }),
        label: "Verify a contractor",
      },
    ],
    continuity: { href: "/plan", label: "Back to Plan" },
  };
}

export function quoteAnalyzerActions(ctx: {
  projectType?: string;
  scale?: string;
  contractorSlug?: string | null;
  contractorName?: string | null;
}): NextActionSpec {
  const verifyHref = ctx.contractorSlug
    ? `/contractors/${encodeURIComponent(ctx.contractorSlug)}`
    : ctx.contractorName
      ? `/verify?q=${encodeURIComponent(ctx.contractorName)}`
      : "/verify";
  return {
    surface: "quote_analyzer",
    eyebrow: "Next best action",
    title: "Next: line up another bid fairly",
    body: "Compare the same scope side by side, then verify license evidence before you shortlist.",
    primary: {
      href: toolHref("/tools/compare-bids", {
        type: ctx.projectType,
        scale: ctx.scale,
        contractor: ctx.contractorSlug,
        name: ctx.contractorName,
        from: "quote",
      }),
      label: "Compare another bid",
      event: "bids_compared",
    },
    secondary: [
      { href: verifyHref, label: "Verify this contractor" },
      {
        href: toolHref("/tools/pre-hire-checklist", {
          contractor: ctx.contractorSlug,
          name: ctx.contractorName,
          from: "quote",
        }),
        label: "Pre-hire checklist",
      },
    ],
    continuity: { href: "/tools", label: "All decision tools" },
  };
}

export function trustReportActions(ctx: {
  slug: string;
  name: string;
  hasProjectContext?: boolean;
  projectType?: string | null;
  toolsQs: string;
}): NextActionSpec {
  const qs = ctx.toolsQs ? `?${ctx.toolsQs}` : "";
  return {
    surface: "trust_report",
    eyebrow: ctx.hasProjectContext
      ? "Recommended next step for this project"
      : "Next best action",
    title: "Next: check what this quote leaves unclear",
    body: "Evidence first — then use tools to prepare questions. Not a ranking or endorsement.",
    primary: {
      href: `/tools/quote-analyzer${qs}`,
      label: "Analyze a quote from this contractor",
      event: "quote_analyzed",
    },
    secondary: [
      {
        href: `/tools/pre-hire-checklist${qs}`,
        label: "Pre-hire checklist",
      },
      {
        href: `/tools/compare-bids${qs}`,
        label: "Add to compare path",
      },
    ],
    continuity: {
      href: ctx.hasProjectContext
        ? `/projects${qs}`
        : `/tools/contract-analyzer${qs}`,
      label: ctx.hasProjectContext ? "Open project protection" : "Review a contract next",
    },
  };
}

export function contractAnalyzerActions(ctx: {
  contractorSlug?: string | null;
  contractorName?: string | null;
}): NextActionSpec {
  return {
    surface: "contract_analyzer",
    eyebrow: "Next best action",
    title: "Next: protect payments and documents",
    body: "Create a protected project workspace for milestones, payments, and watches.",
    primary: {
      href: toolHref("/projects", {
        contractor: ctx.contractorSlug,
        name: ctx.contractorName,
        from: "contract",
        create: "1",
      }),
      label: "Create protected project",
      event: "project_created",
    },
    secondary: [
      {
        href: toolHref("/tools/pre-hire-checklist", {
          contractor: ctx.contractorSlug,
          name: ctx.contractorName,
        }),
        label: "Checklist",
      },
      {
        href: ctx.contractorSlug
          ? `/contractors/${encodeURIComponent(ctx.contractorSlug)}`
          : "/verify",
        label: "Trust Report",
      },
    ],
    continuity: { href: "/account", label: "Save / continue later" },
  };
}

export function projectDashboardActions(ctx: {
  projectId: string;
  looksComplete?: boolean;
  passportId?: string | null;
}): NextActionSpec {
  if (ctx.looksComplete) {
    return {
      surface: "project_complete_ready",
      eyebrow: "Ready to close out",
      title: "Next: mark complete and save to Home Passport",
      body: "Preserve warranties, documents, and contractor history on the property timeline.",
      primary: {
        href: `#complete-passport`,
        label: "Mark complete - Passport",
        event: "project_completed",
      },
      secondary: [
        { href: `?tab=payments`, label: "Review payments" },
        { href: `?tab=docs`, label: "Review documents" },
      ],
      continuity: { href: "/passport", label: "Open Home Passport" },
    };
  }
  return {
    surface: "project_dashboard",
    eyebrow: "Next best action",
    title: "Next: protect payments and documents",
    body: "Log payments with invoice/waiver notes and keep milestones current.",
    primary: {
      href: `?tab=payments`,
      label: "Log payment / add waiver notes",
    },
    secondary: [
      { href: `?tab=docs`, label: "Add documents" },
      { href: `?tab=alerts`, label: "Watch alerts" },
    ],
    continuity: { href: "/account", label: "Save work to account" },
  };
}
