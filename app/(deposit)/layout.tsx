import type { Metadata, Viewport } from "next";

import { Analytics } from "@/components/Analytics";

// Root layout for the deposit page. See app/(site)/layout.tsx for why each
// section has its own: glyde-deposit.css scopes every rule to
// `body.glyde-deposit-page`, so the class below is what activates the design.
const DEPOSIT_STYLESHEET = "/theme/glyde-deposit.css";

const title = "Reserve GLYDE for $3 | VIP Prelaunch Offer";
const description =
  "Reserve GLYDE for $3 to lock in VIP prelaunch access, an $80 launch discount and a fully refundable reservation.";

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
  themeColor: "#085aff",
  colorScheme: "light",
};

export default function DepositLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-US">
      <head>
        <link rel="stylesheet" href={DEPOSIT_STYLESHEET} />
      </head>
      <body className="glyde-deposit-page">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
