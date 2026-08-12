"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearPropertyContext, loadPropertyContext } from "@/lib/property/session";
import type { PropertyContext } from "@/lib/property/types";

export function PropertyContextChip() {
  const [ctx, setCtx] = useState<PropertyContext | null>(null);

  useEffect(() => {
    const sync = () => setCtx(loadPropertyContext());
    sync();
    window.addEventListener("cth-property-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cth-property-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!ctx) return null;

  return (
    <div className="border-b border-[var(--border)] bg-[var(--navy-soft)]/40">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <p className="text-xs text-[var(--text)]">
          <span className="font-semibold">Property context: </span>
          {ctx.normalizedAddress}
          {ctx.county ? ` · ${ctx.county}` : ""}
        </p>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <Link
            href={`/property/${encodeURIComponent(ctx.propertyId)}`}
            className="text-[var(--navy)] no-underline hover:underline"
          >
            View property
          </Link>
          <Link
            href={`/tools/permit-planner?zip=${ctx.zip}${ctx.county ? `&county=${encodeURIComponent(ctx.county)}` : ""}`}
            className="text-[var(--navy)] no-underline hover:underline"
          >
            Permit planner
          </Link>
          <button
            type="button"
            onClick={() => {
              clearPropertyContext();
              setCtx(null);
            }}
            className="text-[var(--muted)] hover:text-[var(--text)]"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
