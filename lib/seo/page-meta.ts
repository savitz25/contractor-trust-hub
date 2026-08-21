import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site";
import { SHARE_HUB, shareOgImageAbsoluteUrl } from "@/lib/seo/share-hub";

const DEFAULT_OG_IMAGE = shareOgImageAbsoluteUrl();
const SITE_NAME = SHARE_HUB.brand;

export type PageMetaInput = {
  title: string;
  description: string;
  /** Path starting with / (or "/" for home). Used for canonical + OG. */
  path: string;
  /** When true, discourage indexing (e.g. personalized plan results). */
  noIndex?: boolean;
  ogType?: "website" | "article" | "profile";
  images?: string[];
  ogAlt?: string;
};

/**
 * Consistent title, description, canonical, Open Graph, and Twitter tags.
 * Relative paths resolve via layout metadataBase → production domain.
 */
export function pageMetadata(input: PageMetaInput): Metadata {
  const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
  const images = input.images?.length ? input.images : [DEFAULT_OG_IMAGE];
  const pageUrl = absoluteUrl(path);
  const ogAlt = input.ogAlt || SHARE_HUB.ogAlt;

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url: pageUrl,
      type: input.ogType || "website",
      siteName: SITE_NAME,
      locale: "en_US",
      images: images.map((url) => ({
        url,
        width: SHARE_HUB.ogWidth,
        height: SHARE_HUB.ogHeight,
        alt: ogAlt,
      })),
    },
    twitter: {
      card: SHARE_HUB.twitterCard,
      title: input.title,
      description: input.description,
      images: images.map((url) => ({ url, alt: ogAlt })),
    },
    robots: input.noIndex
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}
