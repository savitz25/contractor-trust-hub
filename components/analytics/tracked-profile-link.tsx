"use client";

import React from "react";
import Link from "next/link";
import type { ComponentProps } from "react";
import { captureSearchResultOpened } from "@/lib/analytics/trusthub";

type Props = ComponentProps<typeof Link> & {
  surface: string;
  state?: string | null;
};

export function TrackedProfileLink({ surface, state, onClick, ...props }: Props) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        captureSearchResultOpened(surface, state);
        onClick?.(event);
      }}
    />
  );
}
