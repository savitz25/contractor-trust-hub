"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { parseContractorAskHandoff } from "@/lib/ask-handoff/parse";
import { resolveContractorAskHandoff } from "@/lib/ask-handoff/resolve";
import { readContractorAskHandoff } from "@/lib/ask-handoff/session";

function safeInternalPath(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//") && !href.includes("://");
}

export function AskProfileBackLink() {
  const searchParams = useSearchParams();
  const ctx = parseContractorAskHandoff(searchParams) || readContractorAskHandoff();
  const destination = ctx ? resolveContractorAskHandoff(ctx) : null;
  const href = destination && safeInternalPath(destination.href) ? destination.href : null;

  if (!href || !destination) return null;

  return (
    <p className="mb-3">
      <Link
        href={href}
        className="text-sm font-medium text-[var(--accent)] no-underline hover:underline"
        data-ask-handoff-back="1"
      >
        ← {destination.backLabel}
      </Link>
    </p>
  );
}
