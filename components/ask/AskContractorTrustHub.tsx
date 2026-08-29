"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ASK_CHIPS, ASK_EXAMPLES, interpretAskQuery } from "@/lib/ask/interpret";
import type { ContractorHubIntelV2 } from "@/lib/home/intel-v2";
import { formatIntelCount } from "@/lib/home/intel-v2";

export function AskContractorTrustHub({ intel }: { intel: ContractorHubIntelV2 }) {
  const [q, setQ] = useState<string>(ASK_EXAMPLES[0]);
  const [submitted, setSubmitted] = useState<string>(ASK_EXAMPLES[0]);
  const result = useMemo(() => interpretAskQuery(submitted, intel), [submitted, intel]);

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
          show the interpretation before any result.
        </p>
      </div>

      <form
        className="mt-5 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(q);
        }}
      >
        <label htmlFor="ask-q" className="sr-only">
          Ask ContractorTrustHub
        </label>
        <textarea
          id="ask-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          rows={2}
          className="th-field-hero w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-[16px] text-[var(--text)]"
        />
        <button type="submit" className="th-btn-hero px-6">
          Interpret question
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {ASK_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)]"
            onClick={() => {
              setQ(chip.prompt);
              setSubmitted(chip.prompt);
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--navy)]">
          We interpreted your question as
        </p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--muted)]">Location</dt>
            <dd className="font-medium text-[var(--text)]">{result.interpretation.location}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Trade</dt>
            <dd className="font-medium text-[var(--text)]">{result.interpretation.trade}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Credential status</dt>
            <dd className="font-medium text-[var(--text)]">{result.interpretation.credentialStatus}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Regulatory evidence</dt>
            <dd className="font-medium text-[var(--text)]">{result.interpretation.evidenceFamily}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Sort</dt>
            <dd className="font-medium text-[var(--text)]">{result.interpretation.sort}</dd>
          </div>
        </dl>
        {result.interpretation.notes.length > 0 ? (
          <ul className="mt-3 list-disc pl-5 text-xs text-[var(--muted)]">
            {result.interpretation.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 text-xs">
          <span className="font-semibold text-[var(--navy)]">Change interpretation</span>
          {": "}
          {result.changeHints.join(" · ")}
        </p>
      </div>

      <div className="mt-4 text-sm">
        {result.failMessage ? (
          <p className="rounded-xl border border-[var(--border)] bg-white p-4 text-[var(--text)]">
            {result.failMessage}
          </p>
        ) : null}
        {result.count ? (
          <p className="mt-3">
            <span className="text-2xl font-semibold tabular-nums">{formatIntelCount(result.count.value)}</span>
            <span className="mt-1 block text-xs text-[var(--muted)]">
              {result.count.grain}. {result.count.caveat}
            </span>
          </p>
        ) : null}
        {result.aggregate ? (
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">Mapped trade families by active/current rows</caption>
            <thead>
              <tr>
                <th className="text-left">Family</th>
                <th className="text-right">Active/current rows</th>
              </tr>
            </thead>
            <tbody>
              {result.aggregate.map((row) => (
                <tr key={row.label}>
                  <td>
                    <Link href={row.href} className="text-[var(--navy)] hover:underline">
                      {row.label}
                    </Link>
                  </td>
                  <td className="text-right tabular-nums">{formatIntelCount(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {result.comparison ? (
          <div className="mt-3">
            <p className="text-xs text-[var(--muted)]">{result.comparison.limitation}</p>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Metric</th>
                  <th>
                    <Link href={result.comparison.left.href} className="hover:underline">
                      {result.comparison.left.label}
                    </Link>
                  </th>
                  <th>
                    <Link href={result.comparison.right.href} className="hover:underline">
                      {result.comparison.right.label}
                    </Link>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.comparison.metrics.map((m) => (
                  <tr key={m.label}>
                    <td>{m.label}</td>
                    <td>{m.left}</td>
                    <td>{m.right}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {result.href && !result.failMessage ? (
          <p className="mt-3">
            <Link href={result.href} className="font-semibold text-[var(--navy)] hover:underline">
              Continue to matching research
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
