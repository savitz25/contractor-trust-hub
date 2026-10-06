import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";
import { nmCount, NM_SNAPSHOT as data, sumLineCounts } from "@/lib/new-mexico-intelligence/snapshot";

export const metadata: Metadata = pageMetadata({
  title: "New Mexico contractor credential research",
  description:
    "New Mexico Construction Industries Division licensee lines from the NMRLD 2026 Strategic Plan. An earlier budget form stays on its own clock. No combined contractor total. Manufactured housing is not CID.",
  path: "/new-mexico",
});

export default function NewMexicoContractorPage() {
  const n = (value: number) => value.toLocaleString("en-US");
  const currentLines = data.current.lines;
  const earlierLines = data.earlier.lines;
  const business = nmCount(currentLines, "companies") + nmCount(currentLines, "lp");
  const certificates =
    nmCount(currentLines, "qualifying-parties") +
    nmCount(currentLines, "qualifying-parties-lp") +
    nmCount(currentLines, "journeyman");
  const currentSum = sumLineCounts(currentLines);
  const earlierSum = sumLineCounts(earlierLines);
  const earlierGap = data.earlier.printedTotal - earlierSum;
  const earlierBusiness = nmCount(earlierLines, "companies") + nmCount(earlierLines, "lp");
  const mhdCurrent = data.manufacturedHousing.current;
  const mhdEarlier = data.manufacturedHousing.earlier;

  return (
    <main className="th-shell py-10 sm:py-14">
      <p className="cth-intel-eyebrow">New Mexico / Construction Industries Division</p>
      <h1>New Mexico contractor credentials</h1>
      <p className="mt-3 max-w-3xl text-lg">
        The Construction Industries Division prints licensee lines on two clocks. The current
        printed table is the NMRLD 2026 Strategic Plan. The earlier budget form is not that table.
        The clocks are not blended. A qualifying party is not the company. A journeyman license is
        not the company. Manufactured housing is not CID. These lines are not added into one New
        Mexico contractor number.
      </p>

      <section className="mt-8" id="current" aria-labelledby="nm-current">
        <h2 id="nm-current">Current printed table</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          Source{" "}
          <a className="underline" href={data.current.sourceUrl}>
            {data.current.sourceTitle}
          </a>
          . Retrieved {data.current.retrievedAt}. Bytes {n(data.current.bytes)}. SHA-256{" "}
          {data.current.sha256}. The file path is {data.current.filePathMonth}. {data.current.adjacentPages}{" "}
          Five trade bureaus: {data.current.bureaus.join(", ")}. The elevator bureau was established in{" "}
          {data.current.elevatorBureauEstablished}. Its licensee count is {data.current.elevatorLicenseeCount}.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          The division licenses roughly {n(data.current.proseContractingBusinessesRoughly)} contracting
          businesses and {n(data.current.proseCertificateHolders)} certificate holders in{" "}
          {data.current.statedClassifications} different licensing classifications. Classification counts
          are {data.current.classificationCounts}. The 78 classifications are stated, not enumerated.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="mb-2 text-left">
              CID licensee lines. The six lines sum to the printed total. That printed total is not a
              contractor-company count.
            </caption>
            <thead>
              <tr>
                <th className="pr-4 text-left">Line</th>
                <th className="pr-4 text-left">Count</th>
                <th className="text-left">Where it sits</th>
              </tr>
            </thead>
            <tbody>
              {currentLines.map((row) => (
                <tr key={row.id}>
                  <th className="py-2 pr-4 text-left font-semibold">{row.label}</th>
                  <td className="py-2 pr-4">{n(row.count)}</td>
                  <td className="py-2">{row.kind}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th className="py-2 pr-4 text-left">Printed total</th>
                <td className="py-2 pr-4">{n(data.current.printedTotal)}</td>
                <td className="py-2">Sum of the six lines. Not a contractor-company count.</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed">
          A qualifying party is not the company. A journeyman license is not the company. Licensee -
          Companies plus Licensee - LP is {n(business)}, matching the prose figure of roughly{" "}
          {n(data.current.proseContractingBusinessesRoughly)} contracting businesses. Qualifying
          Parties, Qualifying Parties LP, and Journeyman Licenses sum to {n(certificates)}, matching
          the prose figure of {n(data.current.proseCertificateHolders)} certificate holders. Those two
          prose groups are not added into a new total. Secondhand metal dealers, {n(nmCount(currentLines, "secondhand-metal"))}, are
          inside the printed total and outside both prose groups. The six lines sum to {n(currentSum)}.
          That printed total is not a contractor-company count.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          Permits issued {n(data.current.permitsIssued)} and inspections {n(data.current.inspections)} are
          activity, not licenses.
        </p>
      </section>

      <section className="mt-10" id="earlier" aria-labelledby="nm-earlier">
        <h2 id="nm-earlier">Earlier document, not the current table</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          This earlier document is not the current printed table. Source{" "}
          <a className="underline" href={data.earlier.sourceUrl}>
            {data.earlier.sourceTitle}
          </a>
          . Retrieved {data.earlier.retrievedAt}. Bytes {n(data.earlier.bytes)}. SHA-256{" "}
          {data.earlier.sha256}. CID budget form run date {data.earlier.runDate}.{" "}
          {data.earlier.bureauCount} bureaus only. No elevator bureau.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          The prose says roughly {n(data.earlier.proseContractingBusinessesRoughly)} contracting
          businesses and more than {n(data.earlier.proseCertificateHoldersMoreThan)} certificate
          holders.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="mb-2 text-left">
              Earlier CID lines. The six lines are not the printed total. The residual is unlabeled.
            </caption>
            <thead>
              <tr>
                <th className="pr-4 text-left">Line</th>
                <th className="text-left">Count</th>
              </tr>
            </thead>
            <tbody>
              {earlierLines.map((row) => (
                <tr key={row.id}>
                  <th className="py-2 pr-4 text-left font-semibold">{row.label}</th>
                  <td className="py-2">{n(row.count)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th className="py-2 pr-4 text-left">Printed total</th>
                <td className="py-2">{n(data.earlier.printedTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed">
          The six lines sum to {n(earlierSum)}, which is not the printed total of{" "}
          {n(data.earlier.printedTotal)}. The residual {n(earlierGap)} is unlabeled. No class is
          invented for it. Licensee - Companies plus Licensee - LP is {n(earlierBusiness)}, which is
          not the prose figure of roughly {n(data.earlier.proseContractingBusinessesRoughly)}. The
          qualifying-party and journeyman lines are not the prose statement of more than{" "}
          {n(data.earlier.proseCertificateHoldersMoreThan)} certificate holders. They are not forced
          equal.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          The same earlier document says recycled metals oversees{" "}
          {n(data.earlier.recycledMetalsDealersHighlight)} dealers, while the table says{" "}
          {n(nmCount(earlierLines, "secondhand-metal"))}. Both dealer figures are printed. They are
          not forced equal. The Crane Operators Safety Program oversees {n(data.earlier.craneOperators)}{" "}
          licensed crane operators. Crane operators are not a CID contractor class.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          Permits {n(data.earlier.permitsIssued)} and inspections {n(data.earlier.inspections)} are
          activity, not licenses.
        </p>
      </section>

      <section className="mt-10" id="manufactured-housing" aria-labelledby="nm-mhd">
        <h2 id="nm-mhd">Manufactured housing, separate from CID</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          Manufactured housing is not CID. It is a separate division in the same two documents. Do
          not add it into the Construction Industries Division. The narrative active-contractor
          figure matches the crossover line, not the manufactured-housing table total.
        </p>
        <h3 className="mt-4 text-base font-semibold">Current plan</h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed">
          Narrative: {n(mhdCurrent.narrativeActiveContractors)} active contractors and{" "}
          {n(mhdCurrent.narrativeSalespersons)} salespersons. Table total {n(mhdCurrent.tableTotal)}.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {mhdCurrent.lines.map((row) => (
            <li key={row.id}>
              {row.label}: {n(row.count)}
            </li>
          ))}
        </ul>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed">
          Permits {n(mhdCurrent.permits)} and inspections {n(mhdCurrent.inspections)} are activity,
          not licenses.
        </p>
        <h3 className="mt-4 text-base font-semibold">Earlier document</h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed">
          Narrative: {n(mhdEarlier.narrativeActiveContractors)} active contractors and{" "}
          {n(mhdEarlier.narrativeSalespersons)} salespersons. Table total {n(mhdEarlier.tableTotal)}.
          This is the earlier clock, not the current manufactured-housing table.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {mhdEarlier.lines.map((row) => (
            <li key={row.id}>
              {row.label}: {n(row.count)}
            </li>
          ))}
        </ul>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed">
          Permits {n(mhdEarlier.permits)} and inspections {n(mhdEarlier.inspections)} are activity,
          not licenses.
        </p>
      </section>

      <section className="mt-10 max-w-3xl space-y-4 text-sm leading-relaxed" id="limits">
        <h2>What this page does not claim</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Named roster: {data.namedRoster}. {data.publicSearch}
          </li>
          <li>Observed bond or insurance coverage: {data.observedBondOrInsurance}. No bond minimum is published from these two documents.</li>
          <li>
            Enforcement corpus: {data.enforcementCorpus}. {data.complaintIsNotAFinding}
          </li>
          <li>
            Net-new entities: {data.newCanonicalEntities}. Graph writes: {data.graphWrites}.
          </li>
          <li>
            Albuquerque and Santa Fe are geography only. /new-mexico is the only new route. No local
            licensing list was collected.
          </li>
        </ul>
      </section>
    </main>
  );
}
