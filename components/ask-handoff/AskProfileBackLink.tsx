"use client";

import { useEffect, useState } from "react";
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
  const [href, setHref] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = parseContractorAskHandoff(searchParams);
    const ctx = fromUrl || readContractorAskHandoff();
    if (!ctx) {
      setHref(null);
      setLabel(null);
      return;
    }
    const dest = resolveContractorAskHandoff(ctx);
    if (!safeInternalPath(dest.href)) return;
    setHref(dest.href);
    setLabel(dest.backLabel.startsWith("Back") ? dest.backLabel : `← ${dest.backLabel}`);
  }, [searchParams]);

  if (!href || !label) return null;

  return (
    <p className="mb-3">
      <Link
        href={href}
        className="text-sm font-medium text-[var(--accent)] no-underline hover:underline"
        data-ask-handoff-back="1"
      >
        {label.startsWith("←") ? label : `← ${label}`}
      </Link>
    </p>
  );
}
