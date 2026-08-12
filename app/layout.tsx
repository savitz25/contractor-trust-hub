import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://contractortrusthub.com"),
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
  ],
  icons: {
    icon: [
      { url: "/brand/favicon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/favicon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/brand/contractor-trust-hub-mark.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Contractor Trust Hub",
    description: "Before you hire, verify. Florida contractor license evidence.",
    type: "website",
    images: [{ url: "/brand/contractor-trust-hub-logo-on-dark.svg" }],
  },
  twitter: {
    card: "summary",
    title: "Contractor Trust Hub",
    description: "Before you hire, verify.",
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
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
