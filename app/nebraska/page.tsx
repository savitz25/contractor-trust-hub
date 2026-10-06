import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";
import { NE_SNAPSHOT as data } from "@/lib/nebraska-intelligence/snapshot";

export const metadata: Metadata = pageMetadata({
  title: "Nebraska contractor registration research",
  description:
    "Nebraska Department of Labor contractor registration is a requirement, not a quality endorsement. A bulk roster was not acquired.",
  path: "/nebraska",
});

export default function NebraskaContractorPage() {
  return (
    <main className="th-shell py-10 sm:py-14">
      <p className="cth-intel-eyebrow">Nebraska / Department of Labor</p>
      <h1>Nebraska contractor registration</h1>
      <p className="mt-3 max-w-3xl text-lg">
        The Nebraska Contractor Registration Act requires contractors and subcontractors doing
        business in the state to register. Registration is not a quality endorsement. A bulk
        roster was not acquired, so this page does not publish a contractor count.
      </p>

      <section className="mt-8 max-w-3xl space-y-3 text-sm leading-relaxed" id="registration">
        <h2>Registration requirement</h2>
        <p>
          Source:{" "}
          <a className="underline" href={data.sources.registrationHome}>
            Contractor Registration
          </a>{" "}
          and{" "}
          <a className="underline" href={data.sources.whoMustRegister}>
            Who Needs to Register
          </a>
          . Pages retrieved {data.examinedAt}. {data.requirement} The department states:{" "}
          {data.qualityStatement}
        </p>
        <p>
          The registration home page prints an annual fee of ${data.annualFeeUsd}.00 effective{" "}
          {data.annualFeeEffective}. That fee is not current compliance and is not a roster.
        </p>
        <p>
          {data.workersCompRequirement} Provider insurance observations are{" "}
          <strong>{data.workersCompObservations}</strong>. A filing requirement is not an observed
          certificate.
        </p>
        <p>
          The{" "}
          <a className="underline" href={data.sources.search}>
            registered-contractor search
          </a>{" "}
          is a lookup. Roster status: <strong>{data.roster}</strong>. {data.rosterReason}{" "}
          Registration number, business or person, status, business name, and workers&apos;
          compensation status were not acquired as rows.
        </p>
      </section>

      <section className="mt-10 max-w-3xl space-y-3 text-sm leading-relaxed" id="separate">
        <h2>Separate from this registration</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Statewide electrical credentials: <strong>{data.electricalCensus}</strong>. They are
            not this registration roster.
          </li>
          <li>
            Statewide plumbing credentials: <strong>{data.plumbingCensus}</strong>. They are not
            added to electrical credentials or to contractor registration.
          </li>
          <li>
            An NDOT prequalified list was not used as this census.
          </li>
          <li>
            The department links a list of contractors with unpaid fines for Employee
            Classification Act violations. Rows on that list:{" "}
            <strong>{data.unpaidFinesRows}</strong>. No name was joined to a registration row.
          </li>
          <li>Omaha and Lincoln are geography only. This page publishes no city route.</li>
          <li>Graph writes: {data.graphWrites}. New canonical entities: {data.newCanonicalEntities}.</li>
        </ul>
      </section>
    </main>
  );
}
