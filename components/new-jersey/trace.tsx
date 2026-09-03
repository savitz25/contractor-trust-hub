export function Trace({
  source,
  sourceDate,
  denominator,
  calculation,
  grain,
  coverage,
  caveat,
}: {
  source: string;
  sourceDate: string;
  denominator: string;
  calculation: string;
  grain: string;
  coverage: string;
  caveat: string;
}) {
  return (
    <details className="mt-2 text-xs text-[var(--muted)]">
      <summary className="cursor-pointer font-medium text-[var(--navy)] underline-offset-2 hover:underline">
        Trace this number
      </summary>
      <dl className="mt-2 grid gap-1 rounded-lg border border-[var(--border)] bg-[var(--navy-soft)] p-3">
        <div>
          <dt className="font-semibold">Source</dt>
          <dd>{source}</dd>
        </div>
        <div>
          <dt className="font-semibold">Source date</dt>
          <dd>{sourceDate}</dd>
        </div>
        <div>
          <dt className="font-semibold">Denominator</dt>
          <dd>{denominator}</dd>
        </div>
        <div>
          <dt className="font-semibold">Calculation</dt>
          <dd>{calculation}</dd>
        </div>
        <div>
          <dt className="font-semibold">Reporting grain</dt>
          <dd>{grain}</dd>
        </div>
        <div>
          <dt className="font-semibold">Coverage</dt>
          <dd>{coverage}</dd>
        </div>
        <div>
          <dt className="font-semibold">Caveat</dt>
          <dd>{caveat}</dd>
        </div>
      </dl>
    </details>
  );
}
