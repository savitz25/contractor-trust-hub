import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";
import { ID_SNAPSHOT as data, idBoard } from "@/lib/idaho-intelligence/snapshot";

export const metadata: Metadata = pageMetadata({
  title: "Idaho contractor registration research",
  description:
    "Idaho Contractors Board FY 2025 registration evidence. The performance report says Total Number of Licenses. Electrical, HVAC, plumbing, and public works stay separate.",
  path: "/idaho",
});

export default function IdahoContractorPage() {
  const n = (value: number) => value.toLocaleString("en-US");
  const board = data.contractorsBoard;
  const electrical = idBoard("electrical");
  const hvac = idBoard("hvac");
  const plumbing = idBoard("plumbing");
  const publicWorks = idBoard("public-works");

  return (
    <main className="th-shell py-10 sm:py-14">
      <p className="cth-intel-eyebrow">Idaho / Contractors Board</p>
      <h1>Idaho contractor registration</h1>
      <p className="mt-3 max-w-3xl text-lg">
        Idaho has statewide contractor registration through the Idaho Contractors Board. The FY 2025
        performance report prints that board as Total Number of Licenses. That report word is kept.
        The line is not relabeled into a professional trade-license census. Electrical, HVAC,
        plumbing, and public works are other boards. They are not added to the Contractors Board
        line, and they are not added to each other.
      </p>

      <section className="mt-8" id="contractors-board" aria-labelledby="id-contractors">
        <h2 id="id-contractors">Contractors Board, FY 2025 column</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          Source{" "}
          <a className="underline" href={data.source.url}>
            {data.source.title}
          </a>
          . Retrieved {data.source.retrievedAt}. Bytes {n(data.source.bytes)}. SHA-256 {data.source.sha256}.
          The table columns are {data.source.columns.join(", ")}. The current column is {data.source.currentColumn}.
          The Contractors Board row does not print its own as-of date. Board row as-of date:{" "}
          {data.source.boardRowAsOfDate}.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          The board site{" "}
          <a className="underline" href={data.boardSite.url}>
            dopl.idaho.gov/con
          </a>{" "}
          was retrieved {data.boardSite.retrievedAt}. It says registration: apply for or renew a
          registration, search for a registration, and file a complaint against a registration. It
          dates the biennial registration transition at {data.biennialTransitionBegan}. That date is
          not used to change the FY 2025 printed line.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="mb-2 text-left">
              Idaho Contractors Board. The report label is Total Number of Licenses. The public
              program is registration. Person and business are not separated.
            </caption>
            <thead>
              <tr>
                <th className="pr-4 text-left">Column</th>
                <th className="text-left">Total Number of Licenses</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="py-2 pr-4 text-left font-semibold">FY 2025</th>
                <td className="py-2">{n(board.fy2025.totalNumberOfLicenses)}</td>
              </tr>
              <tr>
                <th className="py-2 pr-4 text-left font-semibold">FY 2024</th>
                <td className="py-2">{n(board.earlierTotals.fy2024)}</td>
              </tr>
              <tr>
                <th className="py-2 pr-4 text-left font-semibold">FY 2023</th>
                <td className="py-2">{n(board.earlierTotals.fy2023)}</td>
              </tr>
              <tr>
                <th className="py-2 pr-4 text-left font-semibold">FY 2022</th>
                <td className="py-2">{n(board.earlierTotals.fy2022)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed">
          Person versus business inside {n(board.fy2025.totalNumberOfLicenses)} is {data.personVsBusiness}.
          FY 2024, FY 2023, and FY 2022 stay on their own columns. They are not blended into FY 2025.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          On the same FY 2025 Contractors Board rows, new applicants denied licensure are{" "}
          {n(board.fy2025.newApplicantsDeniedLicensure)} and applicants refused renewal are{" "}
          {n(board.fy2025.applicantsRefusedRenewal)}. Complaints against licensees are{" "}
          {n(board.fy2025.complaints)}. Final disciplinary actions against licensees are{" "}
          {n(board.fy2025.finalDisciplinaryActions)}. {data.complaintIsNotAFinding} Those counts are
          not added to {n(board.fy2025.totalNumberOfLicenses)}. No complaint was joined to a name.
        </p>
      </section>

      <section className="mt-10" id="other-boards" aria-labelledby="id-other-boards">
        <h2 id="id-other-boards">Other boards, not added</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          These FY 2025 lines are in the same performance report. Each one is a different board.
          Electrical, HVAC, and plumbing are occupational licensure. Public works uses the report
          name Public Works Contractors License Board. None of these lines is the Contractors Board
          registration population.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="mb-2 text-left">
              FY 2025 only. Complaints and final actions stay beside the board. They are not findings
              by themselves, and they are not added across boards.
            </caption>
            <thead>
              <tr>
                <th className="pr-4 text-left">Board</th>
                <th className="pr-4 text-left">Total Number of Licenses</th>
                <th className="pr-4 text-left">Complaints</th>
                <th className="text-left">Final disciplinary actions</th>
              </tr>
            </thead>
            <tbody>
              {[electrical, hvac, plumbing, publicWorks].map((row) => (
                <tr key={row.id}>
                  <th className="py-2 pr-4 text-left font-semibold">{row.name}</th>
                  <td className="py-2 pr-4">{n(row.fy2025TotalNumberOfLicenses)}</td>
                  <td className="py-2 pr-4">{n(row.complaints)}</td>
                  <td className="py-2">{n(row.finalDisciplinaryActions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10" id="division" aria-labelledby="id-division">
        <h2 id="id-division">Division-wide row, not contractors</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          The same report has a division-wide row, Active Licensees on June 30. Its FY 2025 column
          is {n(data.divisionWideActiveLicenseesJune30Fy2025)}. That row covers the division. It is
          not an Idaho contractor count. The June 30 label belongs to that division-wide row. It is
          not printed on the Contractors Board row.
        </p>
      </section>

      <section className="mt-10 max-w-3xl space-y-4 text-sm leading-relaxed" id="limits">
        <h2>What this page does not claim</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Named roster: {data.namedRoster}. {data.publicSearch} Search: {data.publicSearchUrl}.
          </li>
          <li>No combined contractor denominator is published.</li>
          <li>Fees are not a population and are not printed here.</li>
          <li>
            Net-new entities: {data.newCanonicalEntities}. Graph writes: {data.graphWrites}.
          </li>
          <li>
            Boise is geography only. /idaho is the only new route. No local licensing list was
            collected.
          </li>
        </ul>
      </section>
    </main>
  );
}
