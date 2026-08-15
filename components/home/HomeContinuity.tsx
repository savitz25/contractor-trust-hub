"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const PROJECTS_KEY = "cth-projects-store-v1";
const PROPERTY_KEY = "cth-property-context";

type ContinuityCard = {
  key: string;
  href: string;
  title: string;
  body: string;
  primary?: boolean;
};

/**
 * Returning-user strip — projects, passport, watches, saved property.
 * Reads localStorage directly (no shared store imports) for a clean client boundary.
 * Renders nothing when there is no session data.
 */
export function HomeContinuity() {
  const [cards, setCards] = useState<ContinuityCard[] | null>(null);

  useEffect(() => {
    try {
      const next: ContinuityCard[] = [];

      let hasProject = false;
      let hasWatch = false;
      const raw = localStorage.getItem(PROJECTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          projects?: Array<{ id: string; title?: string; status?: string; updatedAt?: string }>;
          watches?: Array<{ slug: string; name?: string }>;
        };
        const projects = [...(parsed.projects || [])].sort((a, b) =>
          String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
        );
        const open =
          projects.find((p) =>
            ["planning", "under_contract", "in_progress"].includes(p.status || "")
          ) || projects[0];
        if (open?.id) {
          hasProject = true;
          next.push({
            key: "project",
            href: `/projects/${encodeURIComponent(open.id)}`,
            title: "Continue project",
            body: open.title || "Active protection workspace",
            primary: true,
          });
        }
        const watches = parsed.watches || [];
        if (watches.length > 0) {
          hasWatch = true;
          next.push({
            key: "watches",
            href: "/watch",
            title: "Watched contractors",
            body:
              watches.length === 1
                ? watches[0].name || watches[0].slug
                : `${watches.length} saved on this device`,
          });
        }
      }

      // Priority: project → passport → watches → property (Stage 8B resume)
      if (hasProject || hasWatch) {
        next.push({
          key: "passport",
          href: "/passport",
          title: "Open Home Passport",
          body: "Property history, warranties, documents",
        });
      }

      const propRaw = localStorage.getItem(PROPERTY_KEY);
      if (propRaw) {
        const prop = JSON.parse(propRaw) as {
          propertyId?: string;
          normalizedAddress?: string;
          zip?: string;
        };
        if (prop.propertyId || prop.zip) {
          next.push({
            key: "property",
            href: prop.propertyId
              ? `/property/${encodeURIComponent(prop.propertyId)}`
              : "/property",
            title: "Saved property",
            body: prop.normalizedAddress || (prop.zip ? `ZIP ${prop.zip}` : "Saved address"),
          });
        }
      }

      // Journey context (scope / quote in progress)
      try {
        const jRaw = localStorage.getItem("cth-journey-context-v1");
        if (jRaw) {
          const j = JSON.parse(jRaw) as {
            hasScope?: boolean;
            hasQuoteAnalysis?: boolean;
            contractorSlug?: string;
            contractorName?: string;
            projectType?: string;
          };
          if (j.hasScope && !j.hasQuoteAnalysis) {
            next.unshift({
              key: "scope",
              href: "/tools/quote-analyzer?from=resume",
              title: "Continue: analyze a quote",
              body: j.projectType
                ? `Scope saved · ${String(j.projectType).replace(/_/g, " ")}`
                : "Scope saved on this device",
              primary: !hasProject,
            });
          } else if (j.hasQuoteAnalysis) {
            next.unshift({
              key: "verify-resume",
              href: j.contractorSlug
                ? `/contractors/${encodeURIComponent(j.contractorSlug)}`
                : j.contractorName
                  ? `/verify?q=${encodeURIComponent(j.contractorName)}`
                  : "/verify",
              title: "Continue: verify contractor",
              body: j.contractorName || "Quote analyzed — verify before shortlist",
              primary: !hasProject,
            });
          }
        }
      } catch {
        /* ignore */
      }

      if (!hasProject && !hasWatch && !propRaw && next.length === 0) {
        setCards(null);
        return;
      }

      // Passport always available when any continuity exists
      if (!next.some((c) => c.key === "passport")) {
        next.push({
          key: "passport",
          href: "/passport",
          title: "Open Home Passport",
          body: "Property history, warranties, documents",
        });
      }

      setCards(next);
    } catch {
      setCards(null);
    }
  }, []);

  if (!cards?.length) return null;

  return (
    <section
      aria-label="Continue where you left off"
      className="border-b border-[var(--accent)]/30 bg-[var(--accent-soft)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--navy)]">
              Pick up where you left off
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Work saved on this device — optional account keeps it longer.
            </p>
          </div>
          <Link
            href="/account"
            className="text-xs font-semibold text-[var(--navy)] no-underline hover:underline"
          >
            Save my work
          </Link>
        </div>

        <div className="mt-4 flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
          {cards.map((c) => (
            <Link
              key={c.key}
              href={c.href}
              data-entry-path={`continue-${c.key}`}
              className={`min-w-[200px] shrink-0 rounded-2xl border px-4 py-3.5 no-underline shadow-[var(--shadow-sm)] sm:min-w-0 ${
                c.primary
                  ? "border-[var(--accent)]/50 bg-white"
                  : "border-[var(--border)] bg-white/90"
              }`}
            >
              <p className="text-sm font-semibold text-[var(--text)]">{c.title}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">
                {c.body}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
