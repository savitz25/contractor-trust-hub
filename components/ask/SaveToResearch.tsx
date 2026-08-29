"use client";

import { useEffect, useState } from "react";
import { watchContractor, unwatchContractor, loadStore } from "@/lib/projects/store";

/** Reuses the existing Watch list (Saved Research). No new persistence system. */
export function SaveToResearch({
  slug,
  name,
  licenseKey,
  licenseStatus,
}: {
  slug: string;
  name: string;
  licenseKey?: string | null;
  licenseStatus?: string | null;
}) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(loadStore().watches.some((w) => w.slug === slug));
  }, [slug]);

  return (
    <button
      type="button"
      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)]"
      aria-pressed={saved}
      onClick={() => {
        if (saved) {
          unwatchContractor(slug);
          setSaved(false);
        } else {
          watchContractor({ slug, name, licenseKey, licenseStatus });
          setSaved(true);
        }
      }}
    >
      {saved ? "Saved to research" : "Save to research"}
    </button>
  );
}
