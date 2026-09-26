"use client";

import React from "react";
import { CARD_SURFACE_ATTR, CARD_SURFACE_PROFILE, handleCardSurfaceClick } from "@/lib/ask/card-surface";

/**
 * The card element. With a public profile, ordinary clicks and taps on the card surface forward to the
 * header profile anchor (see lib/ask/card-surface.ts); without one, the article is inert.
 */
export function AskResultCardSurface({ hasProfile, children }: { hasProfile: boolean; children: React.ReactNode }) {
  const surfaceProps = hasProfile
    ? {
        [CARD_SURFACE_ATTR]: CARD_SURFACE_PROFILE,
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          handleCardSurfaceClick(event.nativeEvent, event.currentTarget);
        },
      }
    : {};
  return (
    <article className="cth-result-card" data-testid="ask-result-card" {...surfaceProps}>
      {children}
    </article>
  );
}
