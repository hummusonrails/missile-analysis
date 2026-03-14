import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "../lib/i18n";

const siteUrl = "https://sirenwise.com";

export const metadata: Metadata = {
  title: {
    default: "SirenWise — Israel Alert Intelligence",
    template: "%s | SirenWise",
  },
  description:
    "Interactive missile alert map with real-time data, analytics dashboards, and historical patterns for Israel. Shabbat vs weekday analysis, hourly trends, regional breakdowns, and more.",
  keywords: [
    "Israel alerts",
    "missile alerts",
    "rocket alerts",
    "tzeva adom",
    "red alert",
    "Israel map",
    "alert analytics",
    "Pikud HaOref",
    "Israel security",
    "alert patterns",
    "Shabbat alerts",
    "SirenWise",
  ],
  authors: [{ name: "Ben Greenberg", url: "https://www.hummusonrails.com" }],
  creator: "Ben Greenberg",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: "he_IL",
    url: siteUrl,
    siteName: "SirenWise",
    title: "SirenWise — Israel Alert Intelligence",
    description:
      "Interactive missile alert map with real-time analytics, Shabbat vs weekday patterns, hourly trends, and regional breakdowns.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SirenWise — Israel Alert Intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SirenWise — Israel Alert Intelligence",
    description:
      "Interactive missile alert map with real-time analytics and historical patterns for Israel.",
    creator: "@hummusonrails",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    "theme-color": "#0B0E14",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=JetBrains+Mono:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="bg-bg-primary text-text-primary font-sans antialiased">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
