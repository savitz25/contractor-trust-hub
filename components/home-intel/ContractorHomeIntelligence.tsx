import Link from "next/link";
import { AskContractorTrustHub } from "@/components/ask/AskContractorTrustHub";
import { HomeBeyondLicense } from "@/components/home/HomeBeyondLicense";
import { HomeContinuity } from "@/components/home/HomeContinuity";
import { HomeIntelHero } from "@/components/home/HomeIntelHero";
import { HomeDiscoverySearch } from "@/components/home/HomeDiscoverySearch";
import { HomeEvidenceLayers } from "@/components/home/HomeEvidenceLayers";
import { HomeEvidenceInventory } from "@/components/home/HomeEvidenceInventory";
import { HomeMethodology } from "@/components/home/HomeMethodology";
import { HomeSearchBlock } from "@/components/home/HomeSearchBlock";
import { ExplainDataDrawer } from "@/components/intel/ExplainDataDrawer";
import { MarketCompare } from "@/components/intel/MarketCompare";
import { JourneyNextStep } from "@/components/network/JourneyNextStep";
import { loadContractorHubIntel } from "@/lib/home/load-intel-v2";
import { researchDepthLabel } from "@/lib/home-intel/build";
import type { ContractorHomeIntel, FeaturedStory } from "@/lib/home-intel/types";
import type { JourneyModule } from "@/lib/network/journey-handoff";
import { ContractorHomeChecklist } from "./contractor-home-checklist";
import wa from "@/lib/washington-intelligence/accepted-snapshot.json";
import az from "@/lib/arizona-intelligence/accepted-snapshot.json";
import tx from "@/lib/texas-intelligence/accepted-snapshot.json";
import txLocal from "@/lib/texas-intelligence/local/accepted-snapshot.json";
import ca from "@/lib/california-intelligence/accepted-snapshot.json";
import caLocal from "@/lib/california-intelligence/local/accepted-snapshot.json";
import nj from "@/lib/new-jersey-intelligence/accepted-snapshot.json";

const INTELLIGENCE_CODES = new Set(["FL", "NJ", "CA", "TX", "WA", "AZ"]);

function Freshness({ date, label = "Source as of" }: { date: string; label?: string }) {
  return <span className="cth-intel-freshness"><span aria-hidden="true" />{label} {date}</span>;
}

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
      <p className="mt-2 text-sm text-[var(--muted)]">{finding.doesNotMean[0]}</p>
      <ExplainDataDrawer
        lookingAt={finding.chart.caption}
        why={finding.whyItMatters}
        source={`${finding.sourceIds.join(", ")} · as of ${finding.officialAsOf}`}
        limitation={finding.doesNotMean[0]}
        technical={[
          { label: "Retrieved", value: finding.retrievedAt },
          { label: "Payload keys", value: finding.payloadKeys.join(", ") },
          ...finding.doesNotMean.slice(1).map((item, i) => ({ label: `Does not mean ${i + 2}`, value: item })),
        ]}
      />
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
      <HomeDiscoverySearch />
      <HomeEvidenceLayers />

      <HomeEvidenceInventory />

      <section id="findings" aria-labelledby="findings-title">
        <span id="enforcement" className="sr-only">
          Regulatory evidence
        </span>
        <p className="cth-intel-eyebrow">What the evidence teaches</p>
        <h2 id="findings-title">The same word does not mean the same system everywhere</h2>
        <p>Current, source-specific findings. None ranks contractors or predicts quality.</p>
        <div className="cth-intel-findings">
          {[
            { title: "Washington connects three evidence layers", body: `${wa.general.rows.toLocaleString("en-US")} registrations can be joined by exact contractor number to bond and insurance filings; ${wa.graph.ids_with_both.toLocaleString("en-US")} identities have both evidence types.`, why: "Exact identity linkage helps distinguish a filing from a name match.", limit: "Bond is not endorsement; an insurance filing is not safety; missing is not zero.", source: "Washington L&I General, Bond, and Insurance files", asof: wa.as_of },
            { title: "Arizona license files overlap", body: `ROC reports ${az.current_posting.all_current.toLocaleString("en-US")} current licenses. Commercial, Residential, and Dual posting files must not be added because Dual appears in both scope files.`, why: "The regulatory classification structure changes how totals must be read.", limit: "A license row is not a unique company, and a qualifying party is not necessarily an owner.", source: "Arizona ROC posting list", asof: az.current_posting.header_as_of },
            { title: "Texas has no statewide general-contractor license class", body: `The statewide evidence covers regulated specialties and ${tx.tsbpe.responsible_master_plumber.credential_rows.toLocaleString("en-US")} Responsible Master Plumber credentials; Austin adds local permit history at permit grain.`, why: "Consumers must check the regulator and locality that govern the work.", limit: "Austin permit identities are not state-licensed contractors, and permit volume is not quality.", source: "Texas TDLR, TSBPE, and City of Austin", asof: txLocal.as_of },
            { title: "Work history is separate from licensing", body: "California publishes CSLB identity and class evidence while San Francisco and Los Angeles publish distinct local permit/work-history sources.", why: "A credential answers a different question than attributable activity.", limit: "There is no single statewide California permit database; local activity is not contractor quality.", source: "California CSLB; SF and City of LA local sources", asof: caLocal.as_of },
          ].map((finding) => <article className="cth-intel-card" key={finding.title}><h3>{finding.title}</h3><p>{finding.body}</p><p><strong>Why it matters:</strong> {finding.why}</p><p><strong>Does not mean:</strong> {finding.limit}</p><p className="cth-intel-kicker">{finding.source} · Source as of {finding.asof}</p></article>)}
        </div>
      </section>

      <AskContractorTrustHub intel={scale} />
      <MarketCompare />

      <section id="record" aria-labelledby="record-title">
        <p className="cth-intel-eyebrow">Coverage across the U.S.</p>
        <h2 id="record-title">Licensing works differently in every state</h2>
        <p>Supporting structure metrics — not the principal proof of value, and not contractor quality scores.</p>
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
                  Grain: {metric.grain}. Method: {metric.method}.
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

      <section id="depth" aria-labelledby="depth-title">
        <p className="cth-intel-eyebrow">Evidence depth</p>
        <h2 id="depth-title">How complete is the research?</h2>
        <p>Coverage describes whether this hub has published evidence for a family. It does not describe how trustworthy a contractor is.</p>
        <ul className="cth-intel-metrics mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {intel.evidenceDepth.map((row) => (
            <li key={row.family} className="cth-intel-card">
              <p className="text-sm font-semibold text-[var(--text)]">{row.family}</p>
              <p className="mt-1 text-sm text-[var(--navy)]">{row.display}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{row.method}</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                {row.status.replaceAll("_", " ")}
              </p>
            </li>
          ))}
        </ul>
        <div className="sr-only">
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
                <tr key={`a11y-${row.family}`}>
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

      <section id="changes" aria-labelledby="changes-title" className="cth-intel-changes">
        <p className="cth-intel-eyebrow">Recently added / updated</p>
        <h2 id="changes-title">The research network has changed</h2>
        <div className="cth-intel-timeline">
          {[
            ["Arizona", "Statewide ROC license, classification, discipline, unlicensed-activity, address, and qualifying-party evidence", az.current_posting.header_as_of, "/arizona"],
            ["Washington", "Exact registration → bond → insurance relationships plus UBI and public business contacts", wa.as_of, "/washington"],
            ["Texas · Austin", "Local permit/work-history evidence kept separate from state specialty credentials", txLocal.as_of, "/texas/austin"],
            ["California · SF + LA", "Published city permit/work-history intelligence alongside CSLB identity evidence", caLocal.as_of, "/california"],
            ["New Jersey", "State construction-source, public-works enforcement, specialty, and four-county research", nj.as_of, "/new-jersey"],
          ].map(([place, change, date, href]) => <article key={place}><Freshness date={date} /><h3>{place}</h3><p>{change}</p><Link href={href}>Open the intelligence →</Link></article>)}
        </div>
      </section>

      <section id="showcase" aria-labelledby="showcase-title" className="cth-intel-showcase">
        <p className="cth-intel-eyebrow">Exact-identity showcase</p>
        <h2 id="showcase-title">Washington: from registration to filed evidence</h2>
        <p className="cth-intel-section-lede">L&I publishes three files on the same contractor-number identity. This permits exact joins rather than name-only guesses.</p>
        <div className="cth-intel-relationship" aria-label="Parallel Washington bond and insurance evidence sets with an exact-identity intersection">
          <div className="cth-intel-relationship__universe"><strong>{wa.general.rows.toLocaleString("en-US")}</strong><span>L&amp;I registrations</span></div>
          <div className="cth-intel-relationship__sets">
            <div><small>Bond evidence set</small><strong>{wa.graph.ids_with_bond_evidence.toLocaleString("en-US")}</strong><span>exact contractor IDs</span></div>
            <div><small>Insurance evidence set</small><strong>{wa.graph.ids_with_insurance_evidence.toLocaleString("en-US")}</strong><span>exact contractor IDs</span></div>
            <div><small>Intersection—not a next stage</small><strong>{wa.graph.ids_with_both.toLocaleString("en-US")}</strong><span>IDs present in both sets</span></div>
          </div>
        </div>
        <p className="cth-intel-caution">Registration is not quality. Bond is not endorsement. An insurance filing is not safety. Missing bond or insurance evidence is not proof of no coverage.</p>
        <Freshness date={wa.as_of} label="L&I sources as of" /> <Link href="/washington">Explore Washington intelligence →</Link>
      </section>

      <section aria-labelledby="az-showcase-title" className="cth-intel-az-showcase">
        <div><p className="cth-intel-eyebrow">Classification showcase</p><h2 id="az-showcase-title">Arizona: depth without double counting</h2><p>ROC’s statewide universe contains <strong>{az.current_posting.all_current.toLocaleString("en-US")}</strong> current license rows. Commercial, Residential, and Dual describe overlapping posting files.</p><p className="cth-intel-caution">Do not add the three files. License row ≠ unique company. Qualifying party ≠ owner unless the source establishes ownership.</p><Freshness date={az.current_posting.header_as_of} label="ROC posting list as of" /></div>
        <div className="cth-intel-overlap" aria-label="Overlapping Arizona ROC posting files"><span>Commercial<br/><strong>{az.current_posting.commercial_file.toLocaleString("en-US")}</strong></span><span>Dual<br/><strong>{az.current_posting.dual_file.toLocaleString("en-US")}</strong></span><span>Residential<br/><strong>{az.current_posting.residential_file.toLocaleString("en-US")}</strong></span></div>
      </section>

      <section id="states" aria-labelledby="explore-title">
        <span id="explore" className="sr-only">
          State explorer
        </span>
        <p className="cth-intel-eyebrow">Explore contractor research</p>
        <h2 id="explore-title">Six state intelligence hubs</h2>
        <p>Each destination reflects its own regulator, evidence families, and source clock. Research depth describes our coverage—not contractor quality.</p>
        <ul className="cth-intel-geo">
          {intel.geography.filter((row) => INTELLIGENCE_CODES.has(row.code)).map((row) => (
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
        <details className="mt-4">
          <summary className="cursor-pointer font-semibold text-[var(--navy)]">
            View all researched jurisdictions
          </summary>
        <div className="cth-intel-table-scroll mt-3" tabIndex={0} role="region" aria-label="Accessible state research list">
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
        </details>
      </section>

      <section id="trades" aria-labelledby="trade-title">
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
        <p className="cth-intel-eyebrow">Common research questions</p>
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

      <section id="verify" aria-labelledby="verify-title" className="scroll-mt-24">
        <p className="cth-intel-eyebrow">Verify a known contractor</p>
        <h2 id="verify-title">Verify by company, license number, or supported identifier</h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          Traditional verification is an action after you understand the market — not the identity of this homepage.
        </p>
        <div className="mt-4">
          <HomeSearchBlock embedded />
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
            {scale.generatedAt.slice(0, 10)}.
          </p>
        </details>
      </section>
      <JourneyNextStep module={journeyModule} />
    </div>
  );
}
