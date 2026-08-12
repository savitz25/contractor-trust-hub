"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listLocalPassports } from "@/lib/passport/local-workspace";
import type { HomePassport } from "@/lib/passport/types";

export function PassportListClient() {
  const [passports, setPassports] = useState<HomePassport[]>([]);

  useEffect(() => {
    setPassports(listLocalPassports());
    const sync = () => setPassports(listLocalPassports());
    window.addEventListener("cth-workspace-change", sync);
    return () => window.removeEventListener("cth-workspace-change", sync);
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Home Passport
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)] sm:text-3xl">
          Your long-term home records
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          Property-centered history of improvements, contractors, warranties, and documents. A
          homeowner record system — not a government title report, insurance system, or legal
          certificate. Official sources and original documents control.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/projects"
            className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white no-underline"
          >
            Complete a project to add history
          </Link>
          <Link
            href="/account"
            className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold no-underline"
          >
            Save / sign in for durable storage
          </Link>
          <Link
            href="/property"
            className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold no-underline"
          >
            Check my address
          </Link>
        </div>
      </div>

      {passports.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border)] px-5 py-10 text-center">
          <p className="font-medium text-[var(--text)]">No passports yet</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Mark a project complete and choose “Save to Home Passport,” or create a property record
            after research.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {passports.map((p) => (
            <li key={p.id}>
              <Link
                href={`/passport/${encodeURIComponent(p.id)}`}
                className="block rounded-2xl border border-[var(--border)] bg-white px-4 py-4 no-underline shadow-[var(--shadow-sm)] hover:border-[var(--navy)]/25"
              >
                <p className="font-semibold text-[var(--text)]">{p.addressLabel}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {p.improvements.length} improvement(s) · {p.warranties.length} warranty(ies) ·{" "}
                  {p.documents.length} document note(s)
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
