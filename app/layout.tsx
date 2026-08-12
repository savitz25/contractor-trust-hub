import type { Metadata } from "next";
import { CompareBar } from "@/components/compare/CompareBar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SitewideJsonLd } from "@/components/seo/JsonLd";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Contractor Trust Hub — Before you hire, verify",
    template: "%s · Contractor Trust Hub",
  },
  description:
    "Independent Florida contractor verification using official DBPR licenses, Sunbiz entities, and board discipline. Not a marketplace — research before you hire.",
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
      "Independent Florida contractor verification using official DBPR licenses, Sunbiz entities, and board discipline.",
    type: "website",
    siteName: "Contractor Trust Hub",
    locale: "en_US",
    images: [{ url: "/brand/contractor-trust-hub-logo.svg", alt: "Contractor Trust Hub" }],
  },
  twitter: {
    card: "summary",
    title: "Contractor Trust Hub — Before you hire, verify",
    description: "Before you hire, verify. Florida contractor license evidence.",
    images: ["/brand/contractor-trust-hub-logo.svg"],
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
      <body className="flex min-h-screen flex-col antialiased">
        <SitewideJsonLd />
        <SiteHeader />
        <div className="flex-1 pb-24 sm:pb-20">{children}</div>
        <SiteFooter />
        <CompareBar />
      </body>
    </html>
  );
}
