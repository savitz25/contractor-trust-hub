import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";
import { AR_SNAPSHOT as data } from "@/lib/arkansas-intelligence/snapshot";

export const metadata: Metadata = pageMetadata({
  title: "Arkansas contractor credential research",
  description:
    "Arkansas Contractors Licensing Board classes from the August 2026 Directory of Licensed Occupations. Issuance figures stay on their own clocks. No combined contractor total.",
  path: "/arkansas",
});

export default function ArkansasContractorPage() {
  const n = (value: number) => value.toLocaleString("en-US");
  return (
    <main className="th-shell py-10 sm:py-14">
      <p className="cth-intel-eyebrow">Arkansas / Contractors Licensing Board</p>
      <h1>Arkansas contractor credentials</h1>
      <p className="mt-3 max-w-3xl text-lg">
        The Contractors Licensing Board classes below come from the August 2026 Directory of
        Licensed Occupations. Several figures are licenses issued during a named period. The
        remodeler figure is a 2023 point-in-time total. An issued-during-a-period count is not an
        active roster, and these classes are not added into one Arkansas contractor number.
      </p>

      <section className="mt-8" id="classes" aria-labelledby="ar-classes">
        <h2 id="ar-classes">Board classes</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          Source{" "}
          <a className="underline" href={data.sourceUrl}>
            {data.sourceTitle}
          </a>
          . SHA-256 {data.sha256}. File last modified {data.httpLastModified}. Examined{" "}
          {data.examinedAt}. Qualifying party, company, and person are not split. The active roster
          is NOT_ACQUIRED.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="mb-2 text-left">
              Contractors Licensing Board figures. Different clocks. Not a combined census.
            </caption>
            <thead>
              <tr>
                <th className="pr-4 text-left">Class</th>
                <th className="pr-4 text-left">Figure</th>
                <th className="text-left">Clock and grain</th>
              </tr>
            </thead>
            <tbody>
              {data.classes.map((row) => (
                <tr key={row.id}>
                  <th className="py-2 pr-4 text-left font-semibold">{row.label}</th>
                  <td className="py-2 pr-4">{n(row.count)}</td>
                  <td className="py-2">
                    {row.clock}. {row.grain}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 max-w-3xl space-y-4 text-sm leading-relaxed" id="limits">
        <h2>What this page does not claim</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>An application is not an issued license. A printed bond requirement is not observed insurance.</li>
          <li>
            Electrical, plumbing, and HVAC boards outside this Contractors Licensing Board section are{" "}
            {data.otherBoards}. They are not folded into the commercial license figure.
          </li>
          <li>Enforcement orders: {data.enforcementCorpus}. No adverse record was joined by name.</li>
          <li>
            Existing matches: {data.existingMatches}. New canonical entities: {data.newCanonicalEntities}.
            Evidence attachments: {data.evidenceAttachments}. Graph writes: {data.graphWrites}.
          </li>
          <li>
            Little Rock, North Little Rock, Fayetteville, and Fort Smith are geography only. /arkansas
            is the only new route. No local licensing list was collected.
          </li>
        </ul>
      </section>
    </main>
  );
}
