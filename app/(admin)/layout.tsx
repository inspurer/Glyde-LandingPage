import type { Metadata, Viewport } from "next";

// Root layout for the admin section. See app/(site)/layout.tsx for why each
// section has its own. The admin UI is not part of the Figma design, so it
// carries its own small stylesheet instead of either theme sheet.

export const metadata: Metadata = {
  title: "GLYDE waitlist admin",
  // Belt and braces on top of the site-wide X-Robots-Tag header: this page must
  // never appear anywhere, indexed or archived.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-US">
      <body>{children}</body>
    </html>
  );
}
