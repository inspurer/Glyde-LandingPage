import { NextResponse } from "next/server";

import { addSubscriber } from "@/lib/subscribers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const DEFAULT_STORE_DOMAIN = "drhrvj-70.myshopify.com";
const DEFAULT_API_VERSION = "2026-07";
const UPSTREAM_TIMEOUT_MS = 10_000;
const MAX_REQUEST_BODY_BYTES = 2_048;
const LANDING_PAGE_TAGS = ["newsletter", "GLYDE Landing Page"];
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

type SubscriptionResult =
  | "success"
  | "timeout"
  | "upstream_error"
  | "configuration_error";

type ShopifyConfig = {
  storeDomain: string;
  apiVersion: string;
  adminAccessToken: string;
};

type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "invalid" | "too_large" };

function jsonResponse(
  body: { ok: boolean; error?: string },
  status: number,
) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonBody(request: Request): Promise<JsonBodyResult> {
  if (!request.body) {
    return { ok: false, reason: "invalid" };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      byteLength += value.byteLength;
      if (byteLength > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "too_large" };
      }

      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "invalid" };
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

function hasNoUserErrors(value: unknown): value is Record<string, unknown> & {
  userErrors: unknown[];
} {
  return (
    isRecord(value) &&
    Array.isArray(value.userErrors) &&
    value.userErrors.length === 0
  );
}

function normalizeEmail(value: string): string | null {
  const email = value.trim();

  if (email.length < 3 || email.length > 254) {
    return null;
  }

  if (/[\u0000-\u001f\u007f\s]/.test(email)) {
    return null;
  }

  const atIndex = email.indexOf("@");
  if (atIndex <= 0 || atIndex !== email.lastIndexOf("@")) {
    return null;
  }

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    !/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(localPart)
  ) {
    return null;
  }

  if (domain.length > 253 || !domain.includes(".")) {
    return null;
  }

  const labels = domain.split(".");
  const validDomain = labels.every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label),
  );
  const topLevelDomain = labels.at(-1) ?? "";
  const validTopLevelDomain =
    /^[A-Za-z]{2,63}$/.test(topLevelDomain) ||
    /^xn--[A-Za-z0-9-]{2,59}$/i.test(topLevelDomain);

  if (!validDomain || !validTopLevelDomain) {
    return null;
  }

  return `${localPart}@${domain.toLowerCase()}`;
}

function getShopifyConfig(): ShopifyConfig | null {
  const storeDomain = (
    process.env.SHOPIFY_STORE_DOMAIN || DEFAULT_STORE_DOMAIN
  )
    .trim()
    .toLowerCase();
  const apiVersion = (
    process.env.SHOPIFY_API_VERSION || DEFAULT_API_VERSION
  ).trim();
  const rawToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim() ?? "";

  const storeLabel = storeDomain.slice(0, -".myshopify.com".length);
  const hasValidStoreDomain =
    storeDomain.endsWith(".myshopify.com") &&
    storeLabel.length > 0 &&
    storeLabel.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(storeLabel);
  const hasValidApiVersion = /^\d{4}-(?:01|04|07|10)$/.test(apiVersion);
  const hasValidToken =
    rawToken.length > 0 &&
    rawToken.length <= 512 &&
    !/[\u0000-\u001f\u007f]/.test(rawToken);

  if (
    !hasValidStoreDomain ||
    !hasValidApiVersion ||
    !hasValidToken
  ) {
    return null;
  }

  return {
    storeDomain,
    apiVersion,
    adminAccessToken: rawToken,
  };
}

async function postAdminGraphql(
  config: ShopifyConfig & { adminAccessToken: string },
  query: string,
  variables: Record<string, unknown>,
  signal: AbortSignal,
): Promise<Record<string, unknown> | null> {
  const response = await fetch(
    `https://${config.storeDomain}/admin/api/${config.apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": config.adminAccessToken,
      },
      body: JSON.stringify({ query, variables }),
      redirect: "error",
      cache: "no-store",
      signal,
    },
  );

  if (!response.ok) {
    if (response.body) {
      await response.body.cancel().catch(() => undefined);
    }
    return null;
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return null;
  }

  if (!isRecord(payload) || !isRecord(payload.data)) {
    return null;
  }

  if (
    "errors" in payload &&
    payload.errors !== undefined &&
    payload.errors !== null &&
    (!Array.isArray(payload.errors) || payload.errors.length > 0)
  ) {
    return null;
  }

  return payload.data;
}

async function subscribeWithAdminApi(
  email: string,
  config: ShopifyConfig & { adminAccessToken: string },
): Promise<SubscriptionResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upsertData = await postAdminGraphql(
      config,
      `
        mutation UpsertLandingPageCustomer(
          $identifier: CustomerSetIdentifiers!
          $input: CustomerSetInput!
        ) {
          customerSet(identifier: $identifier, input: $input) {
            customer {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        identifier: { email },
        input: { email },
      },
      controller.signal,
    );
    const customerSet = upsertData?.customerSet;

    if (!hasNoUserErrors(customerSet) || !isRecord(customerSet.customer)) {
      return "upstream_error";
    }

    const customerId = customerSet.customer.id;
    if (
      typeof customerId !== "string" ||
      !customerId.startsWith("gid://shopify/Customer/")
    ) {
      return "upstream_error";
    }

    const subscribeData = await postAdminGraphql(
      config,
      `
        mutation SubscribeLandingPageCustomer(
          $customerId: ID!
          $tags: [String!]!
          $consent: CustomerEmailMarketingConsentInput!
        ) {
          addLandingPageTags: tagsAdd(id: $customerId, tags: $tags) {
            node {
              id
            }
            userErrors {
              field
              message
            }
          }
          subscribeToEmailMarketing: customerEmailMarketingConsentUpdate(
            input: {
              customerId: $customerId
              emailMarketingConsent: $consent
            }
          ) {
            customer {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        customerId,
        tags: LANDING_PAGE_TAGS,
        consent: {
          consentUpdatedAt: new Date().toISOString(),
          marketingOptInLevel: "SINGLE_OPT_IN",
          marketingState: "SUBSCRIBED",
        },
      },
      controller.signal,
    );
    const tagsResult = subscribeData?.addLandingPageTags;
    const consentResult = subscribeData?.subscribeToEmailMarketing;

    if (
      !hasNoUserErrors(tagsResult) ||
      !hasNoUserErrors(consentResult) ||
      !isRecord(tagsResult.node) ||
      tagsResult.node.id !== customerId ||
      !isRecord(consentResult.customer) ||
      consentResult.customer.id !== customerId
    ) {
      return "upstream_error";
    }

    return "success";
  } catch {
    return controller.signal.aborted ? "timeout" : "upstream_error";
  } finally {
    clearTimeout(timeout);
  }
}

const ALLOWED_SOURCES = new Set(["hero", "footer"]);

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_REQUEST_BODY_BYTES
  ) {
    return jsonResponse({ ok: false, error: "Request body is too large." }, 413);
  }

  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    return jsonResponse(
      { ok: false, error: "Content-Type must be application/json." },
      415,
    );
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok && parsedBody.reason === "too_large") {
    return jsonResponse({ ok: false, error: "Request body is too large." }, 413);
  }

  if (!parsedBody.ok) {
    return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const body = parsedBody.value;

  if (!isRecord(body) || typeof body.email !== "string") {
    return jsonResponse(
      { ok: false, error: "A valid email address is required." },
      400,
    );
  }

  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return jsonResponse({ ok: true }, 200);
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return jsonResponse(
      { ok: false, error: "A valid email address is required." },
      422,
    );
  }

  const source =
    typeof body.source === "string" && ALLOWED_SOURCES.has(body.source) ? body.source : "unknown";

  // Shopify is optional here. This deployment owns the waitlist, so a signup
  // succeeds once it is stored locally; forwarding to Shopify is a best-effort
  // extra whose outcome is recorded per row rather than allowed to fail the
  // request. Reporting failure after the address is safely stored would only
  // prompt a resubmission that changes nothing.
  const config = getShopifyConfig();
  let shopifyStatus: SubscriptionResult | "not_configured" = "not_configured";

  if (config) {
    shopifyStatus = await subscribeWithAdminApi(email, config);
  }

  try {
    addSubscriber(email, source, shopifyStatus);
  } catch (error) {
    console.error("[subscribe] failed to store address", error);
    return jsonResponse(
      { ok: false, error: "The subscription service is unavailable." },
      503,
    );
  }

  return jsonResponse({ ok: true }, 200);
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: "Method not allowed." },
    {
      status: 405,
      headers: {
        ...NO_STORE_HEADERS,
        Allow: "POST",
      },
    },
  );
}
