import type { CSSProperties } from "react";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  /** Horizontal wordmark (default) or square mark only */
  variant?: "wordmark" | "mark";
  /**
   * onLight (default): navy wordmark for light network UI.
   * onDark: light mark for rare dark surfaces.
   */
  surface?: "onDark" | "onLight";
  height?: number;
};

const transparent: CSSProperties = {
  background: "transparent",
  backgroundColor: "transparent",
  display: "block",
};

/**
 * Official wordmark from the design mockup, white-plate keyed to true alpha.
 * Prefer PNG for visual fidelity; SVG mark for square/favicon use.
 */
export function BrandLogo({
  className = "",
  priority = false,
  variant = "wordmark",
  surface = "onLight",
  height = 40,
}: BrandLogoProps) {
  const sharedClass = ["block", "shrink-0", "bg-transparent", className]
    .filter(Boolean)
    .join(" ");

  if (variant === "mark") {
    return (
      <img
        src="/brand/contractor-trust-hub-mark.svg"
        alt="Contractor Trust Hub"
        width={height}
        height={height}
        data-brand-logo=""
        className={sharedClass}
        style={{ ...transparent, height, width: height, maxWidth: "none" }}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
      />
    );
  }

  // Prefer SVG for true transparency on dark UI chrome.
  const src =
    surface === "onLight"
      ? "/brand/contractor-trust-hub-logo.svg"
      : "/brand/contractor-trust-hub-logo-on-dark.svg";

  const width = Math.round(height * (900 / 220));

  return (
    <img
      src={src}
      alt="Contractor Trust Hub"
      width={width}
      height={height}
      data-brand-logo=""
      className={sharedClass}
      style={{ ...transparent, height, width, maxWidth: "none" }}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
