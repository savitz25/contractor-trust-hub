"use client";

import React, { useEffect } from "react";
import { captureProfileViewed } from "@/lib/analytics/trusthub";

export function ProfileViewed({ slug, state }: { slug: string; state?: string | null }) {
  useEffect(() => {
    captureProfileViewed(slug, state);
  }, [slug, state]);
  return null;
}
