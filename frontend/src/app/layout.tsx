import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

// Fonts are bundled from npm (no network access needed at build time): Inter for body text,
// DM Sans for headings and UI chrome — the same pairing Fireflies uses.
import "@fontsource-variable/inter";
import "@fontsource-variable/dm-sans";

import { AppProviders } from "@/components/providers/app-providers";
import { themeInitScript } from "@/components/providers/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Fireflies Clone", template: "%s - Fireflies Clone" },
  description: "AI meeting notes: transcripts, summaries and action items for your meetings.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
