import React from "react";
import Link from "next/link";
import type { ContractorRecovery } from "@/lib/ask/recovery";
import { RECOVERY_SOURCES } from "@/lib/ask/recovery-sources";

export function RecoveryAnswer({
  recovery: r,
}: {
  recovery: ContractorRecovery;
}) {
  return (
    <section aria-label="Research guidance" className="space-y-5">
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="cth-intel-eyebrow">What we understood</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt>Task</dt>
            <dd>
              {
                {
                  VERIFY_GUIDANCE: "How to verify a credential",
                  REGULATORY_EXPLANATION: "Regulatory explanation",
                  TRANSACTION: "Booking or hiring request",
                  UNSUPPORTED_JURISDICTION_RESEARCH:
                    "Research outside this cohort capability",
                }[r.requestedTask]
              }
            </dd>
          </div>
          <div>
            <dt>Requested place</dt>
            <dd>{r.locationLabel}</dd>
          </div>
          <div>
            <dt>Trade / equipment</dt>
            <dd>
              {r.requestedTrade?.replaceAll("_", " ") ??
                "Please specify the trade"}
            </dd>
          </div>
        </dl>
      </section>
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-xl font-semibold">{r.title}</h2>
        <p className="mt-3">{r.answer}</p>
        {r.steps.length > 0 ? (
          <ol className="mt-4 list-decimal space-y-2 pl-6">
            {r.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : null}
        <h3 className="mt-6 font-semibold">What you can do next</h3>
        <ul className="mt-3 space-y-4">
          {r.actions.map((a) => (
            <li key={a.label}>
              {a.kind === "OFFICIAL_SOURCE" ? (
                <a
                  className="inline-block max-w-full rounded-xl border px-4 py-3 font-semibold underline focus-visible:outline-2"
                  href={a.destination}
                >
                  {a.label}{" "}
                  <span className="text-sm">(official external source)</span>
                </a>
              ) : (
                <Link
                  prefetch={false}
                  className="inline-block max-w-full rounded-xl border px-4 py-3 font-semibold underline focus-visible:outline-2"
                  href={a.destination}
                >
                  {a.label}
                </Link>
              )}
              <p className="mt-2 text-sm">{a.establishes}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {a.cannotEstablish}
              </p>
            </li>
          ))}
        </ul>
        {r.limitations.map((x) => (
          <p key={x} className="mt-4 text-sm text-[var(--muted)]">
            {x}
          </p>
        ))}
      </section>
      <details className="rounded-2xl border border-[var(--border)] bg-white p-5 text-sm">
        <summary className="cursor-pointer font-semibold">
          Trace this answer
        </summary>
        <dl className="mt-3 space-y-3">
          <div>
            <dt>Operation / capability</dt>
            <dd>
              {r.requestedTask} / {r.capabilityState}
            </dd>
          </div>
          <div>
            <dt>Requested jurisdiction / place</dt>
            <dd>
              {r.requestedState ?? "Unresolved"} / {r.locationLabel}
            </dd>
          </div>
          <div>
            <dt>Execution</dt>
            <dd>
              No provider cohort was queried. No provider count or licensing
              finding is inferred from this answer.
            </dd>
          </div>
        </dl>
        {r.sourceIds.map((id) => {
          const s = RECOVERY_SOURCES[id];
          return (
            <div key={id} className="mt-4">
              <p>
                {s.agency} — {s.title}
              </p>
              <p>
                Source/link checked: {s.checkedAt}. This is a guidance check
                date, not a provider status date.
              </p>
              <p>{s.limitation}</p>
            </div>
          );
        })}
        {!r.sourceIds.length ? (
          <p className="mt-3">
            Product capability guidance; no official provider lookup has been
            performed.
          </p>
        ) : null}
      </details>
    </section>
  );
}
