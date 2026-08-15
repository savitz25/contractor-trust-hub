"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getLocalPassport,
  loadLocalWorkspace,
  upsertLocalPassport,
} from "@/lib/passport/local-workspace";
import {
  passportSummaryHtml,
  printHtmlDocument,
} from "@/lib/passport/export";
import type { HomePassport, MaterialRecord, WarrantyRecord } from "@/lib/passport/types";

function uid(p: string) {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function PassportDetailClient({ passportId }: { passportId: string }) {
  const [passport, setPassport] = useState<HomePassport | null>(null);
  const [warTitle, setWarTitle] = useState("");
  const [warExp, setWarExp] = useState("");
  const [matLabel, setMatLabel] = useState("");
  const [matCat, setMatCat] = useState("finish");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const p = getLocalPassport(passportId);
    setPassport(p);
    if (p) setNotes(p.notes || "");
  }, [passportId]);

  if (!passport) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="font-semibold">Passport not found on this device</p>
        <Link href="/passport" className="mt-2 inline-block text-sm font-semibold">
          All passports
        </Link>
      </div>
    );
  }

  const saveNotes = () => {
    const next = { ...passport, notes, updatedAt: new Date().toISOString() };
    upsertLocalPassport(next);
    setPassport(next);
    void fetch("/api/account/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: loadLocalWorkspace(), mode: "merge" }),
    }).catch(() => null);
  };

  const addWarranty = () => {
    if (!warTitle.trim()) return;
    const w: WarrantyRecord = {
      id: uid("war"),
      title: warTitle.trim(),
      category: "general",
      expiresAt: warExp || undefined,
      reminderOptIn: true,
      createdAt: new Date().toISOString(),
    };
    const next = {
      ...passport,
      warranties: [w, ...passport.warranties],
      updatedAt: new Date().toISOString(),
    };
    upsertLocalPassport(next);
    setPassport(next);
    setWarTitle("");
    setWarExp("");
  };

  const addMaterial = () => {
    if (!matLabel.trim()) return;
    const m: MaterialRecord = {
      id: uid("mat"),
      label: matLabel.trim(),
      category: matCat,
      createdAt: new Date().toISOString(),
    };
    const next = {
      ...passport,
      materials: [m, ...passport.materials],
      updatedAt: new Date().toISOString(),
    };
    upsertLocalPassport(next);
    setPassport(next);
    setMatLabel("");
  };

  const exportPdf = () => {
    printHtmlDocument(
      `Home Passport — ${passport.addressLabel}`,
      passportSummaryHtml(passport)
    );
  };

  return (
    <div className="space-y-6 pb-16">
      <Link href="/passport" className="text-sm text-[var(--muted)] no-underline">
        All passports
      </Link>

      <header className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Home Passport
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)] sm:text-3xl">
          {passport.addressLabel}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {[passport.city, passport.county, passport.zip].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportPdf}
            className="rounded-xl bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white"
          >
            Export passport summary (PDF)
          </button>
          <Link
            href="/account"
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold no-underline"
          >
            Sync to account
          </Link>
        </div>
      </header>

      {/* A overview notes */}
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Property overview
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-3 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
          placeholder="Notes about this property..."
        />
        <button
          type="button"
          onClick={saveNotes}
          className="mt-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold"
        >
          Save notes
        </button>
      </section>

      {/* B timeline */}
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Improvement timeline
        </h2>
        {passport.improvements.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No completed projects yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {passport.improvements.map((i) => (
              <li
                key={i.id}
                className="rounded-xl border border-[var(--border)] px-3 py-3 text-sm"
              >
                <p className="font-semibold text-[var(--text)]">{i.title}</p>
                <p className="text-xs text-[var(--muted)]">
                  {i.completedAt.slice(0, 10)} · {i.projectType.replace(/_/g, " ")}
                  {i.contractorName ? ` · ${i.contractorName}` : ""}
                  {i.amount != null ? ` · $${i.amount.toLocaleString()}` : ""}
                </p>
                {i.permitSummary ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">Permits: {i.permitSummary}</p>
                ) : null}
                {i.contractorSlug ? (
                  <Link
                    href={`/contractors/${encodeURIComponent(i.contractorSlug)}`}
                    className="mt-1 inline-block text-xs font-semibold text-[var(--navy)]"
                  >
                    Trust Report
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* C contractors */}
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Contractor history
        </h2>
        {passport.contractorSlugs.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">None linked yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {passport.contractorSlugs.map((slug) => (
              <li key={slug}>
                <Link
                  href={`/contractors/${encodeURIComponent(slug)}`}
                  className="text-sm font-semibold text-[var(--navy)]"
                >
                  {slug}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* D warranties */}
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Warranties &amp; manuals
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={warTitle}
            onChange={(e) => setWarTitle(e.target.value)}
            placeholder="Roof workmanship warranty"
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={warExp}
            onChange={(e) => setWarExp(e.target.value)}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={addWarranty}
          className="mt-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold"
        >
          Add warranty
        </button>
        <ul className="mt-3 space-y-2 text-sm">
          {passport.warranties.map((w) => (
            <li key={w.id} className="rounded-xl border border-[var(--border)] px-3 py-2">
              {w.title}
              {w.expiresAt ? (
                <span className="text-xs text-[var(--muted)]">
                  {" "}
                  · expires {w.expiresAt.slice(0, 10)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {/* E materials */}
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Materials &amp; finishes
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={matLabel}
            onChange={(e) => setMatLabel(e.target.value)}
            placeholder="e.g. SW Agreeable Gray, quartz Calacatta"
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
          />
          <select
            value={matCat}
            onChange={(e) => setMatCat(e.target.value)}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
          >
            <option value="paint">Paint</option>
            <option value="flooring">Flooring</option>
            <option value="roof">Roof</option>
            <option value="countertop">Countertop / cabinets</option>
            <option value="finish">Other finish</option>
          </select>
        </div>
        <button
          type="button"
          onClick={addMaterial}
          className="mt-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold"
        >
          Add material note
        </button>
        <ul className="mt-3 space-y-1 text-sm">
          {passport.materials.map((m) => (
            <li key={m.id}>
              · <span className="text-[var(--muted)]">{m.category}:</span> {m.label}
            </li>
          ))}
        </ul>
      </section>

      {/* F vault */}
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Documents vault
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Labels/notes from completed projects (v1). Keep original files in your own secure storage
          too.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {passport.documents.length === 0 ? (
            <li className="text-[var(--muted)]">No documents yet.</li>
          ) : (
            passport.documents.map((d) => (
              <li key={d.id} className="rounded-xl border border-[var(--border)] px-3 py-2">
                <span className="text-xs uppercase text-[var(--muted)]">{d.kind}</span>
                <p className="font-medium">{d.label}</p>
              </li>
            ))
          )}
        </ul>
      </section>

      <p className="text-[11px] leading-relaxed text-[var(--muted)]">
        Home Passport is a homeowner record system — not an official government property record,
        title report replacement, insurance policy system, or legal compliance certificate.
      </p>
    </div>
  );
}
