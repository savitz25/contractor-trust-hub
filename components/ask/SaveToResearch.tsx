"use client";

import React, { useEffect, useState } from "react";
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
      className="cth-result-secondary"
      data-search-action="save"
      aria-pressed={saved}
      onClick={() => {
        if (saved) unwatchContractor(slug);
        else watchContractor({ slug, name, licenseKey, licenseStatus });
        setSaved(loadStore().watches.some((w) => w.slug === slug));
      }}
    >
      {saved ? "Saved to research" : "Save to research"}
    </button>
  );
}
