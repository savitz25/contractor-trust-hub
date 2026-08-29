"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ASK_EXAMPLES, interpretAskQuery } from "@/lib/ask/interpret";
import { askHref } from "@/lib/ask/url";
import type { ContractorHubIntelV2 } from "@/lib/home/intel-v2";
import { AskForm } from "./AskForm";

export function AskContractorTrustHub({ intel }: { intel: ContractorHubIntelV2 }) {
  const [previewQ] = useState<string>(ASK_EXAMPLES[0]);
  const preview = useMemo(() => interpretAskQuery(previewQ, intel), [previewQ, intel]);

  return (
    <section id="ask-graph" className="border-b border-[var(--border)] bg-white">
      <div className="max-w-3xl">
        <p className="cth-intel-eyebrow">Ask ContractorTrustHub</p>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
          Ask questions across our structured contractor research
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          This is not a generic web search and not an AI that invents license facts. We map your
          question onto geography, trade, credential status, and indexed evidence families, then
          query the production graph.
        </p>
      </div>

      <div className="mt-5">
        <AskForm />
      </div>

      <p className="mt-4 text-sm">
        <Link href={askHref(preview.query)} className="font-semibold text-[var(--navy)] hover:underline">
          View full research results
        </Link>
        <span className="text-[var(--muted)]"> — shareable, filterable, no homepage dump of every match.</span>
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Example interpretation for “{preview.query}”: {preview.interpretation.location}; {preview.interpretation.trade}; {preview.interpretation.credentialStatus}.
      </p>
    </section>
  );
}
