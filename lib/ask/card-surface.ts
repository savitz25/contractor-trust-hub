/**
 * ATH-SEARCH-UX-001 / D1: the whole name-candidate card opens the profile.
 *
 * The header anchor stays the one tab stop and the one navigation. An ordinary primary click or tap on the
 * rest of the card (blank padding, the resting facts, action-row whitespace) is forwarded to that anchor.
 * Controls, open disclosure content, text selections, modified clicks and rows without a public profile
 * never activate. Plain DOM logic with no React so a browser fixture can load the same code.
 */

export const CARD_SURFACE_ATTR = "data-card-surface";
export const CARD_SURFACE_PROFILE = "profile";
export const PROFILE_LINK_SELECTOR = 'a[data-search-action="profile"]';

const INTERACTIVE_SELECTOR = "a, button, input, select, textarea, label, summary, [role='button'], [contenteditable='true']";

export type CardSurfaceDecision =
  | "activate"
  | "prevented"
  | "secondary-button"
  | "modified"
  | "interactive"
  | "disclosure"
  | "selection"
  | "no-profile";

export type CardSurfaceClickFacts = {
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  /** The click target's ancestry, innermost first: matches for the interactive and details checks. */
  targetIsInteractive: boolean;
  targetInsideDisclosure: boolean;
  selectionText: string;
  hasProfileLink: boolean;
};

/** Pure decision so the rule is unit-testable without a DOM. */
export function decideCardSurfaceActivation(facts: CardSurfaceClickFacts): CardSurfaceDecision {
  if (facts.defaultPrevented) return "prevented";
  if (facts.button !== 0) return "secondary-button";
  if (facts.ctrlKey || facts.metaKey || facts.shiftKey || facts.altKey) return "modified";
  if (facts.targetIsInteractive) return "interactive";
  if (facts.targetInsideDisclosure) return "disclosure";
  if (facts.selectionText.trim().length > 0) return "selection";
  if (!facts.hasProfileLink) return "no-profile";
  return "activate";
}

export function profileLinkFor(card: Element): HTMLAnchorElement | null {
  return card.querySelector<HTMLAnchorElement>(PROFILE_LINK_SELECTOR);
}

export function clickFactsFor(event: MouseEvent, card: Element): CardSurfaceClickFacts {
  const target = event.target instanceof Element ? event.target : null;
  const selection = typeof window !== "undefined" ? window.getSelection() : null;
  return {
    button: event.button,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    defaultPrevented: event.defaultPrevented,
    targetIsInteractive: target ? target.closest(INTERACTIVE_SELECTOR) !== null : false,
    // Only an open disclosure's content is protected; the row of a closed one is ordinary card surface.
    targetInsideDisclosure: target ? target.closest("details[open]") !== null : false,
    selectionText: selection ? selection.toString() : "",
    hasProfileLink: profileLinkFor(card) !== null,
  };
}

/**
 * Forward a qualifying surface click to the card's profile anchor. One synthetic click on the anchor is the
 * only navigation and the only profile analytics event; the surface click itself is never counted because it
 * has no `a`, `button` or `summary` ancestor.
 */
export function handleCardSurfaceClick(event: MouseEvent, card: Element): CardSurfaceDecision {
  const decision = decideCardSurfaceActivation(clickFactsFor(event, card));
  if (decision !== "activate") return decision;
  const link = profileLinkFor(card);
  if (!link) return "no-profile";
  event.preventDefault();
  link.click();
  return decision;
}

/** Fixture and progressive-enhancement wiring: one listener per profile card. */
export function bindCardSurfaces(root: ParentNode): number {
  const cards = root.querySelectorAll<HTMLElement>(`[${CARD_SURFACE_ATTR}="${CARD_SURFACE_PROFILE}"]`);
  cards.forEach((card) => {
    card.addEventListener("click", (event) => {
      handleCardSurfaceClick(event, card);
    });
  });
  return cards.length;
}
