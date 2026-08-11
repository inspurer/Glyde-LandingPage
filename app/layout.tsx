import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const montserrat = localFont({
  variable: "--font-montserrat",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
  src: [
    { path: "../public/fonts/Montserrat-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/Montserrat-Medium.ttf", weight: "500", style: "normal" },
    { path: "../public/fonts/Montserrat-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../public/fonts/Montserrat-Bold.ttf", weight: "700", style: "normal" },
    { path: "../public/fonts/Montserrat-Italic-Variable.ttf", weight: "100 900", style: "italic" },
  ],
});

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
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
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
    <html lang="en-US" className={montserrat.variable}>
      <body>{children}</body>
    </html>
  );
}
