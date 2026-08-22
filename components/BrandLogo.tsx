import type { CSSProperties } from "react";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  /** Horizontal wordmark (default) or square mark only */
  variant?: "wordmark" | "mark";
  /**
   * compact: network header lockup (no slogan) — 36/33/30 optical slot.
   * full: official lockup with BEFORE YOU HIRE, VERIFY.
   */
  lockup?: "compact" | "full";
  /**
   * onLight (default): navy TRUST HUB for light surfaces.
   * onDark: lifted hub/text for dark surfaces.
   */
  surface?: "onDark" | "onLight";
  height?: number;
};

const transparent: CSSProperties = {
  background: "transparent",
  backgroundColor: "transparent",
  display: "block",
};

/** Compact header aspect (viewBox 236×36). */
const COMPACT_ASPECT = 236 / 36;
/** Full official lockup aspect (viewBox 360×88). */
const FULL_ASPECT = 360 / 88;

/**
 * Contractor Trust Hub brand mark / wordmark.
 * Canonical thin TrustHub brackets (CONTRACTOR-BRAND-001). SVG preferred for chrome.
 */
export function BrandLogo({
  className = "",
  priority = false,
  variant = "wordmark",
  lockup = "compact",
  surface = "onLight",
  height = 40,
}: BrandLogoProps) {
  const sharedClass = ["block", "shrink-0", "bg-transparent", className]
    .filter(Boolean)
    .join(" ");

  if (variant === "mark") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/brand/contractor-trust-hub-mark.svg"
        alt="Contractor Trust Hub"
        width={height}
        height={height}
        data-brand-logo=""
        data-brand-mark="canonical"
        className={sharedClass}
        style={{ ...transparent, height, width: height, maxWidth: "none" }}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
      />
    );
  }

  const isFull = lockup === "full";
  const src =
    surface === "onLight"
      ? isFull
        ? "/brand/contractor-trust-hub-logo.svg"
        : "/brand/contractor-trust-hub-logo-compact.svg"
      : isFull
        ? "/brand/contractor-trust-hub-logo-on-dark.svg"
        : "/brand/contractor-trust-hub-logo-compact-on-dark.svg";

  const aspect = isFull ? FULL_ASPECT : COMPACT_ASPECT;
  const width = Math.round(height * aspect);
  const headerSlot = sharedClass.split(/\s+/).includes("th-header-logo") && !isFull;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Contractor Trust Hub"
      width={width}
      height={height}
      data-brand-logo=""
      data-brand-lockup={lockup}
      className={sharedClass}
      style={
        headerSlot
          ? {
              ...transparent,
              height: "var(--th-logo-slot-height)",
              width: "auto",
              maxWidth: "none",
            }
          : { ...transparent, height, width, maxWidth: "none" }
      }
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
