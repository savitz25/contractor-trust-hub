import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  /** Horizontal wordmark (default) or square mark only */
  variant?: "wordmark" | "mark";
  height?: number;
};

export function BrandLogo({
  className,
  priority = false,
  variant = "wordmark",
  height = 40,
}: BrandLogoProps) {
  if (variant === "mark") {
    const size = height;
    return (
      <Image
        src="/brand/contractor-trust-hub-mark.svg"
        alt="Contractor Trust Hub"
        width={size}
        height={size}
        className={className}
        priority={priority}
      />
    );
  }

  // Official horizontal wordmark (transparent PNG from brand design)
  // Source asset is wide; ~3.8:1 works well for header use.
  const width = Math.round(height * 3.8);
  return (
    <Image
      src="/brand/contractor-trust-hub-logo.png"
      alt="Contractor Trust Hub"
      width={width}
      height={height}
      className={className}
      priority={priority}
      style={{ height, width: "auto" }}
    />
  );
}
