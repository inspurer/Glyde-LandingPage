import { paypalOrderId } from "@/lib/paypal/request";

import { CancelledClient } from "./CancelledClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CheckoutCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return <CancelledClient orderId={paypalOrderId((await searchParams).token)} />;
}
