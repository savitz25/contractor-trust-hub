import Link from "next/link";
import {
  getLiveStateCount,
  getLiveVerifyPeerStates,
  livePeerShortCodesLine,
} from "@/lib/states/config";

/**
 * Credibility strip — counts and peer list driven by live config.
 */
export function ProofStrip() {
  const liveCount = getLiveStateCount();
  const peerCount = getLiveVerifyPeerStates().length;
  const peerLine = livePeerShortCodesLine();

  const proofs = [
    {
      title: "Florida full journey",
      body: "DBPR licenses, Sunbiz entity links, discipline, map & county browse, plan tools, and guides.",
    },
    {
      title:
        peerCount > 0
          ? `${peerCount} Verify-first state${peerCount === 1 ? "" : "s"}`
          : "Multi-state Verify",
      body:
        peerCount > 0
          ? `${peerLine} — name and license search with board-specific scope and honest limits.`
          : "Additional states use Verify when loaded.",
    },
    {
      title: "Official extracts",
      body: "Built from board posting lists and open data. No paid placement in results.",
    },
    {
      title: "Confirm before hire",
      body: "Use Trust Reports to prepare questions, then verify final status on the official board.",
    },
  ] as const;

  return (
    <section
      aria-labelledby="proof-heading"
      className="border-b border-[var(--border)] bg-[var(--bg-elevated)]/50"
    >
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="max-w-2xl">
          <h2
            id="proof-heading"
            className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl"
          >
            Grounded in official public records
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            License evidence from board extracts across{" "}
            <strong className="font-medium text-[var(--text)]">
              {liveCount} live state{liveCount === 1 ? "" : "s"}
            </strong>
            . Florida is deepest; peers are Verify-first with board-specific scope.
          </p>
        </div>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {proofs.map((p) => (
            <li
              key={p.title}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4"
            >
              <p className="text-sm font-semibold text-[var(--text)]">{p.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">{p.body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
          <Link href="/methodology" className="text-[var(--navy)] no-underline hover:underline">
            Methodology
          </Link>
          <Link href="/independence" className="text-[var(--navy)] no-underline hover:underline">
            Independence
          </Link>
          <Link href="/#states" className="text-[var(--navy)] no-underline hover:underline">
            State coverage
          </Link>
          <Link href="/disclaimer" className="text-[var(--muted)] no-underline hover:underline">
            Disclaimer
          </Link>
        </div>
      </div>
    </section>
  );
}
