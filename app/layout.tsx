import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contractor Trust Hub — Before you hire, verify",
  description:
    "Independent, evidence-backed contractor license research. Florida DBPR construction licenses, discipline, and transparent sourcing.",
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
    description: "Before you hire, verify.",
    type: "website",
    images: [{ url: "/brand/contractor-trust-hub-logo.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
