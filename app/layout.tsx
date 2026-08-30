import type { Metadata } from "next";
import { Figtree, Fraunces } from "next/font/google";
import { appDocumentTitle } from "@/lib/env";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: appDocumentTitle(),
    description: "Admin loyalty — members, points, and program settings.",
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
