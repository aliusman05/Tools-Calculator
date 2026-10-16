import type { Metadata, Viewport } from "next";
import { AdSenseScript } from "@/components/ads/AdSenseScript";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { ConsentDefaults } from "@/components/consent/ConsentDefaults";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { siteConfig } from "@/lib/site-config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} – Free Personal Finance Calculators`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: { siteName: siteConfig.name, locale: "en_US", type: "website" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased`}>
      <head>
        <ConsentDefaults />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="rounded-control bg-accent text-accent-foreground sr-only z-50 px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to main content
        </a>
        <Header />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
        <Footer />
        <ConsentBanner />
        <AdSenseScript />
      </body>
    </html>
  );
}
