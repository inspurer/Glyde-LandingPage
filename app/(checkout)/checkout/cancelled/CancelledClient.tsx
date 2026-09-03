"use client";

import Link from "next/link";
import { useEffect } from "react";

import styles from "../checkout.module.css";

export function CancelledClient({ orderId }: { orderId: string | null }) {
  useEffect(() => {
    if (!orderId) return;
    void fetch(`/api/paypal/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: "POST",
      keepalive: true,
    }).catch(() => undefined);
  }, [orderId]);

  return (
    <main className={styles.statusPage}>
      <section className={styles.statusCard}>
        <div className={styles.statusIcon} aria-hidden="true">×</div>
        <h1>Payment cancelled</h1>
        <p>No confirmed charge was recorded. Your GLYDE reservation has not been placed.</p>
        <div className={styles.statusActions}>
          <Link className={styles.statusPrimary} href="/checkout" prefetch={false}>Return to checkout</Link>
          <Link className={styles.statusSecondary} href="/deposit">Back to the offer</Link>
        </div>
      </section>
    </main>
  );
}
