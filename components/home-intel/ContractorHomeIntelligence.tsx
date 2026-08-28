import Link from "next/link";
import { HomeBeyondLicense } from "@/components/home/HomeBeyondLicense";
import { HomeContinuity } from "@/components/home/HomeContinuity";
import { HomeEnforcement } from "@/components/home/HomeEnforcement";
import { HomeEvidenceLayers } from "@/components/home/HomeEvidenceLayers";
import { HomeIntelHero } from "@/components/home/HomeIntelHero";
import { HomeMethodology } from "@/components/home/HomeMethodology";
import { HomeTradeExplorer } from "@/components/home/HomeTradeExplorer";
import { JourneyNextStep } from "@/components/network/JourneyNextStep";
import { loadContractorHubIntel } from "@/lib/home/load-intel-v2";
import { researchDepthLabel } from "@/lib/home-intel/build";
import type { ContractorHomeIntel, FeaturedStory } from "@/lib/home-intel/types";
import type { JourneyModule } from "@/lib/network/journey-handoff";
import { ContractorHomeChecklist } from "./contractor-home-checklist";

function Bar({ value, max, label, note }: { value: number; max: number; label: string; note?: string }) {
  const width = max > 0 ? Math.max(8, Math.round((100 * value) / max)) : 0;
  return (
    <div className="cth-intel-bar">
      <div className="cth-intel-bar__meta">
        <span>{label}</span>
        <span>
          {value.toLocaleString("en-US")}
          {note ? ` · ${note}` : ""}
        </span>
      </div>
      <div className="cth-intel-bar__track" aria-hidden="true">
        <span className="cth-intel-bar__fill" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function Story({ finding }: { finding: FeaturedStory }) {
  return (
    <article className="cth-intel-card">
      <p className="cth-intel-eyebrow">{finding.storyType}</p>
      <h3>{finding.title}</h3>
      <p>{finding.summary}</p>
      <figure>
        <figcaption>{finding.chart.caption}</figcaption>
        <div className="cth-intel-chart" role="img" aria-label={finding.chart.caption}>
          {finding.chart.series.map((series) => (
            <Bar key={series.label} value={series.value} max={finding.chart.max} label={series.label} note={series.note} />
          ))}
        </div>
        <div className="cth-intel-table-scroll" tabIndex={0} role="region" aria-label={finding.chart.caption}>
          <table>
            <caption className="sr-only">{finding.chart.caption}</caption>
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col">Count</th>
                <th scope="col">Included states</th>
              </tr>
            </thead>
            <tbody>
              {finding.chart.series.map((series) => (
                <tr key={series.label}>
                  <th scope="row">{series.label}</th>
                  <td>{series.value.toLocaleString("en-US")}</td>
                  <td>{series.states?.join(", ") ?? series.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </figure>
      <details>
        <summary>Explain this chart</summary>
        <p>
          <strong>What am I looking at?</strong> {finding.chart.caption}
        </p>
        <p>
          <strong>Why might this matter?</strong> {finding.whyItMatters}
        </p>
        <p>
          <strong>What this does not mean</strong>
        </p>
        <ul>
          {finding.doesNotMean.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>
          Source keys: {finding.sourceIds.join(", ")}. Official as-of {finding.officialAsOf}. Retrieved {finding.retrievedAt}.
        </p>
      </details>
    </article>
  );
}

export function ContractorHomeIntelligence({
  intel,
  journeyModule,
}: {
  intel: ContractorHomeIntel;
  journeyModule: JourneyModule | null;
}) {
  const scale = loadContractorHubIntel();
  return (
    <div className="cth-intel-home">
      <HomeContinuity />
      <HomeIntelHero intel={scale} />
      <HomeTradeExplorer intel={scale} />
      <HomeEvidenceLayers />
      <HomeEnforcement intel={scale} />

      <section id="record" aria-labelledby="record-title">
        <p className="cth-intel-eyebrow">Coverage across the U.S.</p>
        <h2 id="record-title">Licensing works differently in every state</h2>
        <p>These are snapshot metrics about TrustHub coverage and regulatory structure. They are not contractor quality scores.</p>
        <div className="cth-intel-metrics">
          {intel.stateOfRecord.map((metric) => (
            <article className="cth-intel-card" key={metric.id}>
              <p className="cth-intel-metric-value">{metric.display}</p>
              <h3>{metric.label}</h3>
              <p className="cth-intel-kicker">
                Official as-of {metric.officialAsOf} · Retrieved {metric.retrievedAt}
              </p>
              <details>
                <summary>Trace this number</summary>
                <p>{metric.definition}</p>
                <p>
                  Grain: {metric.grain}. Method: {metric.method}. Payload key: <code>{metric.payloadKey}</code>
                </p>
                <p>Included states: {metric.includedStates.join(", ")}.</p>
                <ul>
                  {metric.components.map((part) => (
                    <li key={part.payloadKey}>
                      {part.label}: {part.value}
                    </li>
                  ))}
                </ul>
                <ul>
                  {metric.limitations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section id="findings" aria-labelledby="findings-title">
        <p className="cth-intel-eyebrow">What the data says</p>
        <h2 id="findings-title">Three national evidence stories</h2>
        <p>Each story is a benchmark or a coverage gap. None is a ranking of contractors or states.</p>
        <div className="cth-intel-findings">
          {intel.findings.map((finding) => (
            <Story key={finding.storyId} finding={finding} />
          ))}
        </div>
      </section>

      <section id="depth" aria-labelledby="depth-title">
        <p className="cth-intel-eyebrow">Evidence depth</p>
        <h2 id="depth-title">How complete is the research?</h2>
        <p>Coverage describes whether this hub has published evidence for a family. It does not describe how trustworthy a contractor is.</p>
        <div className="cth-intel-table-scroll" tabIndex={0} role="region" aria-label="Evidence availability by family">
          <table>
            <caption>Evidence availability by family</caption>
            <thead>
              <tr>
                <th scope="col">Evidence family</th>
                <th scope="col">Coverage</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {intel.evidenceDepth.map((row) => (
                <tr key={row.family}>
                  <th scope="row">{row.family}</th>
                  <td>{row.display}</td>
                  <td>{row.status.replaceAll("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="gaps" aria-labelledby="gaps-title">
        <p className="cth-intel-eyebrow">What we don&apos;t know</p>
        <h2 id="gaps-title">Limits of the research</h2>
        <ul className="cth-intel-list">
          {intel.gaps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section id="explore" aria-labelledby="explore-title">
        <p className="cth-intel-eyebrow">Explore contractor research</p>
        <h2 id="explore-title">Research depth by state — not a quality map</h2>
        <p>
          Color and badges encode TrustHub research depth and regulatory structure. They do not encode safer
          contractors, better markets, or recommended states. Florida is the enhanced Intelligence OS reference.
          Other live states use existing Verify routes. No thin intelligence shells.
        </p>
        <p className="cth-intel-legend">
          Enhanced Intelligence · Statewide Verify · Partial/Pilot · Specialty Verify. Not a ranking.
        </p>
        <ul className="cth-intel-geo">
          {intel.geography.map((row) => (
            <li key={row.code} data-depth={row.depth}>
              <p>
                <strong>
                  {row.code} · {row.name}
                </strong>{" "}
                <span>{researchDepthLabel(row.depth)}</span>
              </p>
              <p>{row.boardShort}</p>
              <p>{row.scopeHint}</p>
              <p>{row.coverageNote}</p>
              <p>
                <strong>Can verify:</strong> {row.canVerify}
              </p>
              <p>
                <strong>Cannot infer:</strong> {row.cannotInfer}
              </p>
              <Link href={row.href}>{row.hrefLabel}</Link>
            </li>
          ))}
        </ul>
        <div className="cth-intel-table-scroll" tabIndex={0} role="region" aria-label="Accessible state research list">
          <table>
            <caption>Live researched states, board, structure, and destination</caption>
            <thead>
              <tr>
                <th scope="col">State</th>
                <th scope="col">Board</th>
                <th scope="col">Structure</th>
                <th scope="col">Statewide GC class</th>
                <th scope="col">Destination</th>
              </tr>
            </thead>
            <tbody>
              {intel.geography.map((row) => (
                <tr key={`list-${row.code}`}>
                  <th scope="row">
                    {row.code} · {row.name}
                  </th>
                  <td>{row.boardShort}</td>
                  <td>{researchDepthLabel(row.depth)}</td>
                  <td>{row.statewideGc ? "Statewide class in this source" : "No statewide GC class in this source"}</td>
                  <td>
                    <Link href={row.href}>{row.hrefLabel}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="trade" aria-labelledby="trade-title">
        <p className="cth-intel-eyebrow">Trade / occupation class</p>
        <h2 id="trade-title">Trade labels are not a national license taxonomy</h2>
        <p>
          General, roofing, HVAC, and plumbing do not mean identical credentials in every state. Shortcuts open
          state-specific Verify or Florida Intelligence — they do not invent a universal code.
        </p>
        <ul className="cth-intel-trade">
          {intel.tradeAxis.map((row) => (
            <li key={row.label}>
              <strong>{row.label}</strong>
              <p>{row.note}</p>
              <Link href={row.href}>Open related research</Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="ask" aria-labelledby="ask-title">
        <p className="cth-intel-eyebrow">Ask the market</p>
        <h2 id="ask-title">Structured questions, not a chatbot</h2>
        <div className="cth-intel-ask">
          {intel.ask.map((item) => (
            <details key={item.id}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
              <p>
                <Link href={item.href}>{item.hrefLabel}</Link>
              </p>
            </details>
          ))}
        </div>
      </section>

      <section id="use" aria-labelledby="use-title">
        <p className="cth-intel-eyebrow">Use the research</p>
        <h2 id="use-title">Act after you understand the evidence</h2>
        <div className="cth-intel-tools">
          {intel.tools.map((tool) => (
            <Link href={tool.href} key={tool.id}>
              <strong>{tool.label}</strong>
              <span>{tool.note}</span>
            </Link>
          ))}
        </div>
        <h3>Research checklist</h3>
        <ContractorHomeChecklist />
        <h3>How this research was assembled</h3>
        <ol className="cth-intel-journey">
          {intel.journey.map((row) => (
            <li key={row.step}>
              {row.step} — {row.status.replaceAll("_", " ")}
            </li>
          ))}
        </ol>
      </section>

      <HomeBeyondLicense intel={scale} />
      <HomeMethodology intel={scale} />

      <section id="sources" aria-labelledby="sources-title">
        <p className="cth-intel-eyebrow">Sources / limitations</p>
        <h2 id="sources-title">Where the numbers come from</h2>
        <div className="cth-intel-table-scroll" tabIndex={0} role="region" aria-label="National source ledger">
          <table>
            <caption>Source ledger for live researched states</caption>
            <thead>
              <tr>
                <th scope="col">State</th>
                <th scope="col">Agency</th>
                <th scope="col">Dataset</th>
                <th scope="col">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {intel.sources.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.state}</th>
                  <td>
                    <a href={row.url} rel="noopener noreferrer">
                      {row.agency}
                    </a>
                  </td>
                  <td>{row.dataset}</td>
                  <td>{row.coverage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>What this page does not infer</h3>
        <ul className="cth-intel-list">
          {intel.doesNotInfer.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <ul className="cth-intel-list">
          {intel.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <details>
          <summary>Snapshot provenance</summary>
          <p>
            Intelligence OS {intel.contractVersion}. Evidence-scale snapshot {scale.schemaVersion} generated{" "}
            {scale.generatedAt.slice(0, 10)}. Change module: {intel.changeCapability.status}.
          </p>
        </details>
      </section>
      <JourneyNextStep module={journeyModule} />
    </div>
  );
}
