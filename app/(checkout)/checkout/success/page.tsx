import Link from "next/link";

import { CHECKOUT_PRODUCT } from "@/lib/checkout";
import { getPaymentOrderByPayPalId } from "@/lib/payments";
import { paypalOrderId } from "@/lib/paypal/request";

import styles from "../checkout.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function shortOrderId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 7)}…${id.slice(-5)}` : id;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const orderId = paypalOrderId((await searchParams).order);
  const order = orderId ? getPaymentOrderByPayPalId(orderId) : null;
  const completed = order?.status === "completed";
  const pending = order?.status === "capture_pending";

  return (
    <main className={styles.statusPage}>
      <section className={styles.statusCard}>
        <div className={styles.statusIcon} aria-hidden="true">{completed ? "✓" : pending ? "…" : "!"}</div>
        <h1>
          {completed
            ? "Your reservation is confirmed"
            : pending
              ? "Your payment is processing"
              : "Payment not confirmed"}
        </h1>
        <p>
          {completed
            ? "Thank you for reserving GLYDE VIP prelaunch access. Keep your PayPal receipt for your records."
            : pending
              ? "PayPal is still processing the payment. We will use its final status as the authoritative result."
              : "We could not find a completed GLYDE reservation for this link. No success is being claimed."}
        </p>
        {orderId && order ? (
          <p className={styles.statusMeta}>
            {CHECKOUT_PRODUCT.currency} ${CHECKOUT_PRODUCT.amount} · Order {shortOrderId(orderId)}
          </p>
        ) : null}
        <div className={styles.statusActions}>
          <Link className={styles.statusPrimary} href="/">Return to GLYDE</Link>
          {!completed ? (
            <a className={styles.statusSecondary} href="mailto:timchen@smarthairclipper.com">Contact support</a>
          ) : null}
        </div>
      </section>
    </main>
  );
}

