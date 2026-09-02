import type { Metadata } from "next";
import Link from "next/link";
import styles from "./terms.module.css";

export const metadata: Metadata = {
  title: "Terms of Service | GLYDE",
  description: "Terms information for the GLYDE smart auto-fade clipper website and reservation flow.",
  alternates: { canonical: "/terms" },
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Primary navigation">
        <Link href="/" aria-label="Back to GLYDE home">GLYDE</Link>
        <Link className={styles.reserve} href="/deposit">
          Reserve for $5
        </Link>
      </nav>
      <article className={styles.content}>
        <p className={styles.eyebrow}>Legal</p>
        <h1>Terms of Service</h1>
        <p>
          GLYDE&apos;s complete website terms are being finalized for publication before product launch.
          The terms that apply to a reservation—including price, refund eligibility, and payment details—are
          presented for review in the official checkout flow before payment is submitted.
        </p>
        <p>
          For questions about a reservation or these terms, contact{" "}
          <a href="mailto:timchen@smarthairclipper.com">timchen@smarthairclipper.com</a>.
        </p>
        <div className={styles.actions}>
          <Link href="/deposit">Review reservation details</Link>
          <Link href="/">Return home</Link>
        </div>
      </article>
    </main>
  );
}
