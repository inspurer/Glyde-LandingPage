import type { Metadata, Viewport } from "next";

import { Analytics } from "@/components/Analytics";

const title = "Reserve GLYDE for $5 | Auto-Fade Clipper Prelaunch";
const description =
  "Reserve the GLYDE Auto-Fade Clipper for $5 to lock in the $169 prelaunch price, save $50 and receive priority access. Fully refundable before launch.";

export const metadata: Metadata = {
  metadataBase: new URL("https://glydeclipper.com"),
  title,
  description,
  alternates: { canonical: "https://glydeclipper.com/pages/deposit" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://glydeclipper.com/pages/deposit",
    siteName: "GLYDE",
    title,
    description,
    images: [
      {
        url: "https://glydeclipper.online/assets/deposit/product-01.png",
        width: 1200,
        height: 967,
        alt: "GLYDE Auto-Fade Clipper",
      },
    ],
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1c1d1e",
  colorScheme: "dark",
};

export default function DepositLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-US">
      <body style={{ margin: 0, background: "#1c1d1e", color: "#fff" }}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
