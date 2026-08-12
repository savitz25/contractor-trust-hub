import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site";

const DEFAULT_OG_IMAGE = "/brand/contractor-trust-hub-logo.svg";
const SITE_NAME = "Contractor Trust Hub";

export type PageMetaInput = {
  title: string;
  description: string;
  /** Path starting with / (or "/" for home). Used for canonical + OG. */
  path: string;
  /** When true, discourage indexing (e.g. personalized plan results). */
  noIndex?: boolean;
  ogType?: "website" | "article" | "profile";
  images?: string[];
};

/**
 * Consistent title, description, canonical, Open Graph, and Twitter tags.
 * Relative paths resolve via layout metadataBase → production domain.
 */
export function pageMetadata(input: PageMetaInput): Metadata {
  const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
  const images = input.images?.length ? input.images : [DEFAULT_OG_IMAGE];
  const pageUrl = absoluteUrl(path);

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: path === "/" ? "/" : path,
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url: pageUrl,
      type: input.ogType || "website",
      siteName: SITE_NAME,
      locale: "en_US",
      images: images.map((url) => ({ url })),
    },
    twitter: {
      card: "summary",
      title: input.title,
      description: input.description,
      images,
    },
    robots: input.noIndex
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}
