import { paypalOrderId } from "@/lib/paypal/request";

import { CheckoutReturnClient } from "./CheckoutReturnClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = paypalOrderId((await searchParams).token);
  return <CheckoutReturnClient orderId={token} />;
}

