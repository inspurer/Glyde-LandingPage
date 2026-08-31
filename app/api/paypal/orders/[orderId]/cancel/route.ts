import { NextResponse } from "next/server";

import { markPaymentStateByOrderId } from "@/lib/payments";
import { getPayPalConfig, requestHasTrustedOrigin } from "@/lib/paypal/config";
import { paymentRateLimited, paypalOrderId } from "@/lib/paypal/request";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const HEADERS = { "Cache-Control": "no-store, max-age=0" };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!requestHasTrustedOrigin(request)) {
    return NextResponse.json({ ok: false, code: "invalid_origin" }, { status: 403, headers: HEADERS });
  }
  if (paymentRateLimited(request, 20)) {
    return NextResponse.json({ ok: false, code: "rate_limited" }, { status: 429, headers: HEADERS });
  }
  if (!getPayPalConfig().checkoutEnabled) {
    return NextResponse.json(
      { ok: false, code: "paypal_not_configured" },
      { status: 503, headers: HEADERS },
    );
  }

  const orderId = paypalOrderId((await params).orderId);
  if (!orderId) {
    return NextResponse.json({ ok: false, code: "invalid_order_id" }, { status: 400, headers: HEADERS });
  }

  markPaymentStateByOrderId(orderId, "cancelled", "CANCELLED_BY_BUYER");
  return new NextResponse(null, { status: 204, headers: HEADERS });
}

