type Props = {
  lookingAt: string;
  why: string;
  source: string;
  limitation: string;
  technical?: Array<{ label: string; value: string }>;
};

export function ExplainDataDrawer({ lookingAt, why, source, limitation, technical }: Props) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer font-semibold text-[var(--navy)]">Explain this data</summary>
      <div className="mt-2 space-y-2 text-[var(--muted)]">
        <p>
          <strong className="text-[var(--text)]">What am I looking at?</strong> {lookingAt}
        </p>
        <p>
          <strong className="text-[var(--text)]">Why does it matter?</strong> {why}
        </p>
        <p>
          <strong className="text-[var(--text)]">Where did this come from?</strong> {source}
        </p>
        <p>
          <strong className="text-[var(--text)]">Important limitation</strong> {limitation}
        </p>
        {technical && technical.length > 0 ? (
          <details>
            <summary>View technical provenance</summary>
            <ul className="mt-2 list-disc pl-5">
              {technical.map((row) => (
                <li key={row.label}>
                  {row.label}: {row.value}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </details>
  );
}
