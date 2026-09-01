import type { Metadata, Viewport } from "next";
import Script from "next/script";

import { Analytics } from "@/components/Analytics";

// One of several root layouts. The landing, deposit and admin sections each
// render their own <html>/<body> because the theme's two stylesheets are
// mutually exclusive designs: the landing sheet styles a bare `body` dark,
// while the deposit sheet scopes everything to `body.glyde-deposit-page` and
// paints it white. Loading both would leave whichever came last to win.
//
// The landing page's appearance and behaviour come from the Shopify theme's own
// stylesheet and script, copied verbatim into public/theme/ by
// `npm run sync:theme`. They are served as plain static files rather than run
// through the bundler for two reasons: the stylesheet resolves its fonts and
// background SVGs with relative URLs that only work when it sits beside them,
// and keeping both files byte-identical to the theme is what guarantees this
// deployment matches the Shopify draft.
//
// The stylesheet declares its own @font-face rules, a full reset, :root tokens
// and body styles, so it fully replaces the previous globals.css + next/font
// setup. Loading Montserrat a second time through next/font would only
// duplicate ~1.5MB of TTF.
const THEME_STYLESHEET = "/theme/glyde-landing.css";
const THEME_SCRIPT = "/theme/glyde-landing.js";
const HERO_STYLESHEET = "/hero.css";
const SECTIONS_STYLESHEET = "/sections.css";
const LANDING_V3_STYLESHEET = "/landing-v3.css";

const title = "GLYDE Smart Auto-Fade Clipper | Perfect Fades at Home";
const description =
  "Meet GLYDE, the smart auto-fade hair clipper with guided cuts, real-time sensing and adjustable blade control for consistent fades at home.";

export const metadata: Metadata = {
  metadataBase: new URL("https://glydeclipper.com"),
  title,
  description,
  applicationName: "GLYDE",
  authors: [{ name: "Kuaiku Innovation" }],
  creator: "Kuaiku Innovation",
  publisher: "Kuaiku Innovation",
  category: "Personal Care",
  keywords: [
    "smart hair clipper",
    "auto-fade clipper",
    "home haircut",
    "fade haircut tool",
    "guided haircut",
    "GLYDE clipper",
  ],
  // This deployment is a preview of the production storefront, so it points at
  // the canonical page rather than claiming to be it.
  alternates: { canonical: "https://glydeclipper.com/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://glydeclipper.com/",
    siteName: "GLYDE",
    title,
    description,
    images: [
      {
        url: "/assets/figma/hero-photo.png",
        width: 2048,
        height: 1152,
        alt: "A man using the GLYDE smart auto-fade clipper at home",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/assets/figma/hero-photo.png"],
  },
  // Preview deployment: keep it out of every index. robots.txt only asks
  // crawlers not to fetch — a page linked from elsewhere can still be indexed
  // without ever being crawled. These directives, plus the X-Robots-Tag header
  // in next.config.ts, are what actually prevent that.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1c1d1e",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-US">
      <head>
        <link rel="stylesheet" href={THEME_STYLESHEET} />
        {/* Loaded after the theme sheet. The hero was rebuilt from Figma node
            433-64 and no longer matches the theme's `.hero*` rules, so it
            carries its own namespaced stylesheet rather than overriding them. */}
        <link rel="stylesheet" href={HERO_STYLESHEET} />
        <link rel="stylesheet" href={SECTIONS_STYLESHEET} />
        <link rel="stylesheet" href={LANDING_V3_STYLESHEET} />
        <link rel="preload" as="image" href="/media/hero-poster.jpg" media="(min-width: 901px)" />
        <link rel="preload" as="image" href="/assets/figma/hero-photo.png" media="(max-width: 900px)" />
      </head>
      <body>
        {children}
        {/* Runs after hydration so it never fights React for the DOM. The theme
            script self-starts when the document is already parsed. */}
        <Script src={THEME_SCRIPT} strategy="afterInteractive" />
        <Analytics />
      </body>
    </html>
  );
}
