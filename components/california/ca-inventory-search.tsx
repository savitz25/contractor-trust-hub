"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCaBoardCode } from "@/lib/states/ca-classifications";
import {
  CA_SEARCH_LIMIT,
  cslbLiveStatusUrl,
  filterCaInventory,
  type CaInventoryFile,
  type CaInventoryRow,
} from "@/lib/california-intelligence/search";

const DETAIL_PREFIX =
  "https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/LicenseDetail.aspx?LicNum=";
const INSTANT =
  "https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx";

function formatPhone(digits: string): string {
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

function ResultRow({ row }: { row: CaInventoryRow }) {
  const [license, name, city, zip, county, status, classes, phone, asbestosExact] = row;
  const classChips = classes
    ? classes.split(",").filter(Boolean).map((c) => formatCaBoardCode(c))
    : [];
  return (
    <article className="rounded-xl border border-[var(--border)] p-4">
      <p className="font-semibold text-[var(--navy)]">{name || "Unnamed license row"}</p>
      <p className="mt-1 text-sm">
        CSLB {license}
        {city ? ` · ${city}` : ""}
        {zip ? ` ${zip}` : ""}
        {county ? ` · ${county} County mailing` : ""}
      </p>
      <p className="mt-1 text-sm">
        Status: {status || "UNKNOWN"}
        {phone ? ` · Business phone ${formatPhone(phone)}` : ""}
      </p>
      {classChips.length ? (
        <p className="mt-1 text-xs text-[var(--muted)]">Classes: {classChips.join(", ")}</p>
      ) : null}
      {asbestosExact ? (
        <p className="mt-1 text-xs">
          Cal/OSHA asbestos registrant overlay (exact CSLB ID). Not general license status.
        </p>
      ) : null}
      <p className="mt-2 text-sm">
        <a
          href={cslbLiveStatusUrl(license, DETAIL_PREFIX)}
          className="font-medium underline underline-offset-2"
          rel="noopener noreferrer"
          target="_blank"
        >
          Verify with CSLB
        </a>
      </p>
    </article>
  );
}

export function CaliforniaInventorySearch({
  coverageLabel,
  rowCount,
  statuses,
}: {
  coverageLabel: string;
  rowCount: number;
  statuses: string[];
}) {
  const [file, setFile] = useState<CaInventoryFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [classification, setClassification] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [submitted, setSubmitted] = useState<typeof q | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/california-inventory.json")
      .then((res) => {
        if (!res.ok) throw new Error(`inventory HTTP ${res.status}`);
        return res.json() as Promise<CaInventoryFile>;
      })
      .then((data) => {
        if (!cancelled) setFile(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "inventory load failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    if (!file || submitted === null) return [];
    return filterCaInventory(file.rows, { q, status, classification, city, zip });
  }, [file, submitted, q, status, classification, city, zip]);

  return (
    <section className="mt-10" aria-labelledby="ca-inventory">
      <h2 id="ca-inventory" className="text-lg font-semibold text-[var(--navy)]">
        Contractor research inventory
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Label: Acquired CSLB public-data rows. {coverageLabel}. Search license, name, class, status,
        city, or ZIP. This is not a complete California contractor directory and not a ranking.
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {rowCount.toLocaleString("en-US")} acquired rows · mailing address withheld (REVIEW_REQUIRED)
      </p>

      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(q);
        }}
      >
        <label className="text-sm sm:col-span-2">
          License or name
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="License number or business name"
          />
        </label>
        <label className="text-sm">
          Classification
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
            value={classification}
            onChange={(e) => setClassification(e.target.value)}
            placeholder="B, C-10, C36"
          />
        </label>
        <label className="text-sm">
          Status
          <select
            className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Any source-native status</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          City
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </label>
        <label className="text-sm">
          ZIP
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-xl bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white"
            disabled={!file}
          >
            Search acquired rows
          </button>
        </div>
      </form>

      {!file && !error ? (
        <p className="mt-3 text-sm text-[var(--muted)]">Loading acquired CSLB public-data rows…</p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm">
          Inventory file unavailable ({error}). Use{" "}
          <a href={INSTANT} className="underline underline-offset-2" rel="noopener noreferrer" target="_blank">
            CSLB Instant License Check
          </a>
          .
        </p>
      ) : null}

      {submitted !== null && file ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm">
            Showing {results.length}
            {results.length === CA_SEARCH_LIMIT ? "+" : ""} matching acquired rows.
          </p>
          {results.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No acquired rows matched. Absence from this extract is not proof the license does not
              exist. Confirm on CSLB Instant License Check.
            </p>
          ) : (
            results.map((row) => <ResultRow key={row[0]} row={row} />)
          )}
        </div>
      ) : null}
    </section>
  );
}
