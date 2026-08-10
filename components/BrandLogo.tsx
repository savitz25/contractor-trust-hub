import type { CSSProperties } from "react";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  /** Horizontal wordmark (default) or square mark only */
  variant?: "wordmark" | "mark";
  /**
   * onDark (default): light hub + TRUST HUB for dark headers.
   * onLight: brand navy for light / marketing surfaces.
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
  surface = "onDark",
  height = 40,
}: BrandLogoProps) {
  const sharedClass = ["block", "h-auto", "max-w-full", "bg-transparent", className]
    .filter(Boolean)
    .join(" ");

  if (variant === "mark") {
    return (
      <img
        src="/brand/contractor-trust-hub-mark.svg"
        alt="Contractor Trust Hub"
        width={height}
        height={height}
        className={sharedClass}
        style={{ ...transparent, height, width: height }}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
      />
    );
  }

  // True-alpha PNGs processed from:
  // moch up design/contractor trust hub logo design.png
  // Aspect ~1416×361 ≈ 3.92:1
  const src =
    surface === "onLight"
      ? "/brand/contractor-trust-hub-logo.png"
      : "/brand/contractor-trust-hub-logo-on-dark.png";

  const width = Math.round(height * (1416 / 361));

  return (
    <img
      src={src}
      alt="Contractor Trust Hub"
      width={width}
      height={height}
      className={sharedClass}
      style={{ ...transparent, height, width: "auto" }}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
