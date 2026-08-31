import { NextResponse } from "next/server";

import { getPayPalConfig, requestHasTrustedOrigin } from "@/lib/paypal/config";
import { capturePayPalOrder } from "@/lib/paypal/orders";
import { paymentRateLimited, paypalOrderId } from "@/lib/paypal/request";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const HEADERS = { "Cache-Control": "no-store, max-age=0" };

function response(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: HEADERS });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!requestHasTrustedOrigin(request)) {
    return response({ ok: false, code: "invalid_origin" }, 403);
  }
  if (paymentRateLimited(request, 20)) {
    return response({ ok: false, code: "rate_limited" }, 429);
  }
  if (!getPayPalConfig().checkoutEnabled) {
    return response({ ok: false, code: "paypal_not_configured" }, 503);
  }

  const orderId = paypalOrderId((await params).orderId);
  if (!orderId) return response({ ok: false, code: "invalid_order_id" }, 400);

  try {
    const result = await capturePayPalOrder(orderId);
    return response({ ok: true, orderId: result.orderId, status: result.status }, 200);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "PAYPAL_ORDER_NOT_FOUND") {
      return response({ ok: false, code: "order_not_found" }, 404);
    }
    console.error("[paypal] order capture failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return response({ ok: false, code: "capture_failed" }, 502);
  }
}

