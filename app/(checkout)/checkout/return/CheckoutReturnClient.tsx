"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { trackEvent } from "@/components/Analytics";

import styles from "../checkout.module.css";

export function CheckoutReturnClient({ orderId }: { orderId: string | null }) {
  const started = useRef(false);
  const router = useRouter();
  const [error, setError] = useState(!orderId);

  useEffect(() => {
    if (!orderId || started.current) return;
    started.current = true;

    const capture = async () => {
      try {
        const response = await fetch(
          `/api/paypal/orders/${encodeURIComponent(orderId)}/capture`,
          { method: "POST" },
        );
        const result = (await response.json()) as { ok?: boolean; status?: string };
        if (!response.ok || !result.ok) throw new Error("CAPTURE_FAILED");
        trackEvent("checkout_payment_captured", { label: result.status ?? "return" });
        router.replace(`/checkout/success?order=${encodeURIComponent(orderId)}`);
      } catch {
        setError(true);
        trackEvent("checkout_order_error", { label: "return_capture" });
      }
    };

    void capture();
  }, [orderId, router]);

  return (
    <main className={styles.statusPage}>
      <section className={styles.statusCard} aria-live="polite">
        {error ? (
          <>
            <div className={styles.statusIcon} aria-hidden="true">!</div>
            <h1>We couldn&apos;t confirm the payment</h1>
            <p>
              Do not retry immediately if PayPal shows a charge. Contact support so we can reconcile
              the transaction safely.
            </p>
            <div className={styles.statusActions}>
              <Link className={styles.statusPrimary} href="/checkout" prefetch={false}>Return to checkout</Link>
              <a className={styles.statusSecondary} href="mailto:timchen@smarthairclipper.com">Contact support</a>
            </div>
          </>
        ) : (
          <>
            <div className={styles.statusSpinner} aria-hidden="true" />
            <h1>Confirming your payment</h1>
            <p>Please keep this page open while PayPal confirms your reservation.</p>
          </>
        )}
      </section>
    </main>
  );
}
