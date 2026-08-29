import Link from "next/link";
import type { AskResult } from "@/lib/ask/types";
import type { ContractorResearchQuery } from "@/lib/ask/plan";
import { askHref, chipHref, planToOverrides } from "@/lib/ask/plan";
import type { AskExecution } from "@/lib/ask/execute";
import { formatIntelCount } from "@/lib/home/intel-v2";
import { AskResultCard } from "./AskResultCard";

export function AskResults({
  interpreted,
  plan,
  execution,
}: {
  interpreted: AskResult;
  plan: ContractorResearchQuery;
  execution: AskExecution;
}) {
  const overrides = planToOverrides(plan);
  const nextPage = askHref(plan.rawQuery, { ...overrides, page: String(plan.page + 1) });
  const prevPage = askHref(plan.rawQuery, { ...overrides, page: String(Math.max(1, plan.page - 1)) });
  const totalPages =
    execution.contractorCount != null ? Math.max(1, Math.ceil(execution.contractorCount / plan.limit)) : 1;

  return (
    <div className="space-y-8">
      <section aria-labelledby="ask-interpreted">
        <p className="cth-intel-eyebrow">We interpreted your question as</p>
        <h2 id="ask-interpreted" className="sr-only">
          Query interpretation
        </h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--muted)]">Location</dt>
            <dd className="font-medium">{plan.geography.countyLabel || plan.geography.state || "Not specified"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Geography basis</dt>
            <dd className="font-medium">Indexed DBPR address county — not service territory</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Trade</dt>
            <dd className="font-medium">{plan.trade.label || "Not specified"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Included credential classes</dt>
            <dd className="font-medium">{plan.trade.classLabels.join(", ") || "Not specified"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Status</dt>
            <dd className="font-medium">{plan.credentialStatus.replace("_", "/")}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Evidence</dt>
            <dd className="font-medium">{interpreted.interpretation.evidenceFamily}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Sort</dt>
            <dd className="font-medium">{plan.sort.field.replaceAll("_", " ")}</dd>
          </div>
        </dl>
        {plan.trade.classLabels.length > 0 ? (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold text-[var(--navy)]">Includes credential classes</summary>
            <ul className="mt-2 list-disc pl-5">
              {plan.trade.occupationCodes.map((code, i) => (
                <li key={code}>
                  {code} — {plan.trade.classLabels[i]}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {plan.notes.map((n) => (
          <p key={n} className="mt-2 text-sm text-[var(--muted)]">
            {n}
          </p>
        ))}
      </section>

      <div className="flex flex-wrap gap-2" aria-label="Active filters">
        {plan.geography.countySlug ? (
          <Link className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs" href={chipHref(plan.rawQuery, plan, "geo")}>
            Location: {plan.geography.countyLabel} ×
          </Link>
        ) : null}
        {plan.trade.familyId ? (
          <Link className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs" href={chipHref(plan.rawQuery, plan, "trade")}>
            Trade: {plan.trade.label} ×
          </Link>
        ) : null}
        {plan.credentialStatus === "active_current" ? (
          <Link className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs" href={chipHref(plan.rawQuery, plan, "status")}>
            Status: Active/current ×
          </Link>
        ) : null}
        {plan.evidenceFamily ? (
          <Link className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs" href={chipHref(plan.rawQuery, plan, "evidence")}>
            Evidence: {interpreted.interpretation.evidenceFamily} ×
          </Link>
        ) : null}
      </div>

      <p className="text-sm">
        Change interpretation: {plan.changeHints.join(" · ")}
      </p>

      {interpreted.failMessage || execution.blockMessage ? (
        <p className="rounded-xl border border-[var(--border)] bg-white p-4" role="status">
          {interpreted.failMessage || execution.blockMessage}
        </p>
      ) : null}

      {interpreted.definition ? (
        <article className="cth-intel-card">
          <h2>{interpreted.definition.title}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{interpreted.definition.body}</p>
        </article>
      ) : null}

      {interpreted.aggregate ? (
        <div>
          <table className="w-full text-sm">
            <caption className="text-left text-sm text-[var(--muted)]">
              Mapped trade families by active/current credential rows in the live public cohort. Grain: credential rows, not companies.
            </caption>
            <thead>
              <tr>
                <th className="text-left">Family</th>
                <th className="text-right">Active/current credential rows</th>
              </tr>
            </thead>
            <tbody>
              {interpreted.aggregate.map((row) => (
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
        </div>
      ) : null}

      {execution.compare ? (
        <section>
          <h2 className="text-lg font-semibold">Recorded-address comparison</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{execution.compare.limitation}</p>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">Metric</th>
                <th>
                  <Link href={execution.compare.left.href} className="hover:underline">
                    {execution.compare.left.label}
                  </Link>
                </th>
                <th>
                  <Link href={execution.compare.right.href} className="hover:underline">
                    {execution.compare.right.label}
                  </Link>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Contractor profiles with indexed address county</td>
                <td className="tabular-nums">{formatIntelCount(execution.compare.left.contractors)}</td>
                <td className="tabular-nums">{formatIntelCount(execution.compare.right.contractors)}</td>
              </tr>
              <tr>
                <td>Credential records with indexed address county</td>
                <td className="tabular-nums">{formatIntelCount(execution.compare.left.credentials)}</td>
                <td className="tabular-nums">{formatIntelCount(execution.compare.right.credentials)}</td>
              </tr>
              <tr>
                <td>Permit metrics</td>
                <td>Not compared</td>
                <td>Not compared</td>
              </tr>
            </tbody>
          </table>
        </section>
      ) : null}

      {execution.contractorCount != null || execution.credentialCount != null ? (
        <p role="status" className="text-sm">
          {execution.contractorCount != null ? (
            <strong className="text-xl tabular-nums">{formatIntelCount(execution.contractorCount)}</strong>
          ) : null}{" "}
          contractor profiles match.
          {execution.credentialCount != null ? (
            <>
              {" "}
              <span className="tabular-nums">{formatIntelCount(execution.credentialCount)}</span> matching credential
              records. Those are not the same grain.
            </>
          ) : null}
        </p>
      ) : null}

      {execution.evidenceSourceRows != null && execution.blocked ? (
        <p className="text-sm">
          <span className="text-xl font-semibold tabular-nums">{formatIntelCount(execution.evidenceSourceRows)}</span>{" "}
          indexed source rows in this evidence family — not contractors found guilty.
        </p>
      ) : null}

      {plan.sort.field === "evidence_count" ? (
        <p className="text-sm text-[var(--muted)]">
          Record count is not a severity score and does not account for company size, years operating, or projects completed.
        </p>
      ) : null}

      {execution.results.length > 0 ? (
        <ul className="space-y-4">
          {execution.results.map((card) => (
            <li key={card.contractorId}>
              <AskResultCard card={card} />
            </li>
          ))}
        </ul>
      ) : null}

      {execution.ok && execution.contractorCount != null && execution.contractorCount > plan.limit ? (
        <nav className="flex gap-4 text-sm" aria-label="Result pagination">
          {plan.page > 1 ? <Link href={prevPage}>Previous</Link> : <span className="text-[var(--muted)]">Previous</span>}
          <span>
            Page {plan.page} of {totalPages}
          </span>
          {plan.page < totalPages ? <Link href={nextPage}>Next</Link> : <span className="text-[var(--muted)]">Next</span>}
        </nav>
      ) : null}

      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-[var(--navy)]">Trace this query</summary>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-[var(--muted)]">Parsed intent</dt>
            <dd>{plan.mode}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Query grain</dt>
            <dd>{execution.grainLabel}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Source datasets</dt>
            <dd>fl_dbpr construction licenses; optional public-eligible discipline_actions</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Snapshot / as-of</dt>
            <dd>
              {execution.asOf} · {execution.snapshotFingerprint.slice(0, 12)}…
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Geography method</dt>
            <dd>{plan.geography.method}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Trade mapping</dt>
            <dd>{plan.trade.occupationCodes.join(", ") || "none"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Evidence families</dt>
            <dd>{plan.evidenceFamily || "none"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Sort logic</dt>
            <dd>
              {plan.sort.field} {plan.sort.direction}; tie-break display name / id
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Exclusions</dt>
            <dd>Thin profiles excluded. Florida DFS stop-work is not contractor-listed. Complaints and rates fail closed.</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Query plan ID</dt>
            <dd className="font-mono text-xs">{plan.planId}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">SQL contract</dt>
            <dd>{execution.sqlContract}</dd>
          </div>
        </dl>
      </details>
    </div>
  );
}
