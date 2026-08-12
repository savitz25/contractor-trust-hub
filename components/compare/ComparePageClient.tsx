"use client";

import { useEffect } from "react";
import { writeCompareSlugs } from "./compare-store";

/** Keep localStorage in sync when opening a compare URL. */
export function ComparePageClient({ slugs }: { slugs: string[] }) {
  useEffect(() => {
    if (slugs.length) writeCompareSlugs(slugs);
  }, [slugs]);
  return null;
}
