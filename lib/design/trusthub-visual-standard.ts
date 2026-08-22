/**
 * TRUSTHUB_VISUAL_STANDARD_V1 — Contractor repo-local tokens.
 */

import type { NetworkHubId } from "@/lib/network/registry";

export {
  TH_MARK_CANONICAL_RULE,
  TH_MARK_HUB_STATUS,
  TH_MARK_BRACKET_STROKE_RATIO,
  TH_MARK_OUTER_DOT_R_RATIO,
  TH_MARK_CENTER_DOT_R_RATIO,
  TH_MARK_DOT_SPACING_RATIO,
  TH_MARK_VIEWBOX,
} from "@/lib/design/trusthub-mark-geometry";

export const TH_CHASSIS_VERSION = "2026.08.21-visual-v1";
export const TH_MARK_GEOMETRY_VERSION = "2026.08-visual-mark-geometry-v1";

export const TH_SHELL_MAX = 1200;
export const TH_GUTTER_DESKTOP = 24;
export const TH_GUTTER_MOBILE = 16;

export const TH_HEADER = { desktop: 69, tablet: 65, mobile: 57 } as const;
export const TH_LOGO_SLOT = { desktop: 36, tablet: 33, mobile: 30 } as const;

export const TH_CONTROL = 44;
export const TH_CONTROL_HERO = 48;
export const TH_RADIUS_CONTROL = 12;
export const TH_RADIUS_CARD = 16;

export const TH_HUB_ACCENT: Record<NetworkHubId, string> = {
  ask: "#4F46E5",
  move: "#FF5A1F",
  lender: "#0D9488",
  insurance: "#0284C7",
  contractor: "#F5C518",
  senior: "#681860",
  investor: "#0F766E",
};
