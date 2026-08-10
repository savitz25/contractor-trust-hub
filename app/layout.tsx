import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contractor Trust Hub — Before you hire, verify",
  description:
    "Independent, evidence-backed contractor license research. Florida DBPR construction licenses, discipline, and transparent sourcing.",
  openGraph: {
    title: "Contractor Trust Hub",
    description: "Before you hire, verify.",
    type: "website",
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
