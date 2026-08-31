import { NextResponse } from "next/server";

import { getPayPalConfig, requestHasTrustedOrigin } from "@/lib/paypal/config";
import { createPayPalOrder } from "@/lib/paypal/orders";
import { parseCheckoutOrderInput, paymentRateLimited, readSmallJson } from "@/lib/paypal/request";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const HEADERS = { "Cache-Control": "no-store, max-age=0" };

function response(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: HEADERS });
}

export async function POST(request: Request) {
  if (!requestHasTrustedOrigin(request)) {
    return response({ ok: false, code: "invalid_origin" }, 403);
  }
  if (paymentRateLimited(request, 10)) {
    return response({ ok: false, code: "rate_limited" }, 429);
  }

  const config = getPayPalConfig();
  if (!config.checkoutEnabled) {
    return response({ ok: false, code: "paypal_not_configured" }, 503);
  }
  if (!config.newOrdersEnabled) {
    return response({ ok: false, code: "checkout_paused" }, 503);
  }

  const checkoutInput = parseCheckoutOrderInput(await readSmallJson(request));
  if (!checkoutInput) {
    return response({ ok: false, code: "invalid_checkout_details" }, 400);
  }

  try {
    const result = await createPayPalOrder(checkoutInput);
    return response({ ok: true, id: result.orderId }, 201);
  } catch (error) {
    console.error("[paypal] order creation failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return response({ ok: false, code: "order_creation_failed" }, 502);
  }
}
