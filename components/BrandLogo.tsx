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
};

/**
 * Brand wordmark / mark with true SVG transparency.
 * Never use the legacy RGB PNG in UI — it had a baked white plate.
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

  const src =
    surface === "onLight"
      ? "/brand/contractor-trust-hub-logo.svg"
      : "/brand/contractor-trust-hub-logo-on-dark.svg";

  // viewBox 900×220 → aspect ≈ 4.09:1
  const width = Math.round(height * (900 / 220));

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
