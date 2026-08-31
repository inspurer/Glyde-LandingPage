import type { Metadata, Viewport } from "next";

import { Analytics } from "@/components/Analytics";

import styles from "./checkout/checkout.module.css";

const title = "Checkout - GLYDE";
const description =
  "Secure the GLYDE VIP prelaunch offer with a fully refundable $3 reservation deposit.";

export const metadata: Metadata = {
  metadataBase: new URL("https://glydeclipper.online"),
  title,
  description,
  alternates: { canonical: "https://glydeclipper.online/checkout" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://glydeclipper.online/checkout",
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
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function CheckoutLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-US">
      <body className={styles.body}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}

