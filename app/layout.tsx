import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { CompareBar } from "@/components/compare/CompareBar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SaveWorkPrompt } from "@/components/account/SaveWorkPrompt";
import { JourneyContextChip } from "@/components/funnel/JourneyContextChip";
import { PropertyContextChip } from "@/components/property/PropertyContextChip";
import { SitewideJsonLd } from "@/components/seo/JsonLd";
import { TH_CHASSIS_VERSION } from "@/lib/design/trusthub-visual-standard";
import { ASK_NETWORK_STANDARD_VERSION } from "@/lib/network/standard-version";
import {
  SHARE_HUB,
  resolveShareOrigin,
  shareOgImageAbsoluteUrl,
} from "@/lib/seo/share-hub";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
  adjustFontFallback: true,
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(resolveShareOrigin()),
  alternates: { canonical: `${resolveShareOrigin()}/` },
  title: {
    default: "Contractor Trust Hub — Before you hire, verify",
    template: "%s · Contractor Trust Hub",
  },
  description:
    "Independent contractor license and registration research with official board evidence and state-specific depth. Not a marketplace — research before you hire.",
  keywords: [
    "Florida contractor license",
    "verify contractor",
    "DBPR license lookup",
    "Sunbiz contractor",
    "before you hire verify",
    "contractor trust report",
    "Florida roofing cost calculator",
  ],
  authors: [{ name: "Contractor Trust Hub" }],
  creator: "Contractor Trust Hub",
  publisher: "Contractor Trust Hub",
  icons: {
    icon: [
      { url: "/brand/favicon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/favicon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/brand/contractor-trust-hub-mark.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Contractor Trust Hub — Before you hire, verify",
    description:
      "Independent contractor license and registration research with official board evidence and state-specific depth.",
    type: "website",
    siteName: SHARE_HUB.brand,
    url: resolveShareOrigin(),
    locale: "en_US",
    images: [
      {
        url: shareOgImageAbsoluteUrl(),
        width: SHARE_HUB.ogWidth,
        height: SHARE_HUB.ogHeight,
        alt: SHARE_HUB.ogAlt,
      },
    ],
  },
  twitter: {
    card: SHARE_HUB.twitterCard,
    title: "Contractor Trust Hub — Before you hire, verify",
    description: "Before you hire, verify. Official license evidence with state-specific depth.",
    images: [{ url: shareOgImageAbsoluteUrl(), alt: SHARE_HUB.ogAlt }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} flex min-h-screen flex-col antialiased`}
        data-hub="contractor"
        data-network-standard={ASK_NETWORK_STANDARD_VERSION}
        data-th-chassis={TH_CHASSIS_VERSION}
      >
        <SitewideJsonLd />
        <div className="print:hidden">
          <SiteHeader />
          <SaveWorkPrompt />
          <JourneyContextChip />
          <PropertyContextChip />
        </div>
        <div id="main-content" className="flex-1 pb-24 sm:pb-20 print:pb-0" tabIndex={-1}>
          {children}
        </div>
        <div className="print:hidden">
          <SiteFooter />
          <CompareBar />
        </div>
      </body>
    </html>
  );
}
