"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { researchProperty } from "@/lib/property/resolve";
import {
  propertyContextFromResult,
  propertyResultHref,
  savePropertyContext,
} from "@/lib/property/session";

export function AddressLookupForm({
  compact,
  initialZip,
  initialCity,
}: {
  compact?: boolean;
  initialZip?: string;
  initialCity?: string;
}) {
  const router = useRouter();
  const [street, setStreet] = useState("");
  const [unit, setUnit] = useState("");
  const [city, setCity] = useState(initialCity || "");
  const [zip, setZip] = useState(initialZip || "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = researchProperty({
        street,
        unit: unit || undefined,
        city: city || undefined,
        zip,
        state: "FL",
      });
      if (result.resolveStatus === "unresolved") {
        setError(result.resolveMessage);
        setBusy(false);
        return;
      }
      const ctx = propertyContextFromResult(result);
      if (ctx) savePropertyContext(ctx);
      router.push(propertyResultHref(result));
    } catch {
      setError("Could not research this address. Try again.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={compact ? "space-y-3" : "space-y-4"}>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          Street address
        </span>
        <input
          required
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          placeholder="100 Ocean Drive"
          className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-base text-[var(--text)] sm:text-sm"
          autoComplete="street-address"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Unit (optional)
          </span>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Apt 2"
            className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            City
          </span>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Miami Beach"
            className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm"
            autoComplete="address-level2"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            ZIP (Florida)
          </span>
          <input
            required
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
            placeholder="33139"
            inputMode="numeric"
            className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm"
            autoComplete="postal-code"
          />
        </label>
      </div>
      {error ? (
        <p className="text-sm text-rose-800" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-[var(--navy)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
      >
        {busy ? "Researching…" : "Check this address"}
      </button>
      <p className="text-[11px] leading-relaxed text-[var(--muted)]">
        Florida-first. Results depend on jurisdiction coverage — empty permit lists are common and
        do not prove a clean history. Try pilot sample: 100 Ocean Drive, Miami Beach, 33139.
      </p>
    </form>
  );
}
