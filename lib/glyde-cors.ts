const TRUSTED_ORIGINS = new Set([
  "https://glydeclipper.com",
  "https://www.glydeclipper.com",
  "https://glydeclipper.online",
  "https://drhrvj-70.myshopify.com",
]);

const CORS_METHODS = "POST, OPTIONS";
const CORS_HEADERS = "Content-Type";

/**
 * Browser requests from the Shopify storefront are the only cross-origin
 * callers accepted by the GLYDE first-party APIs. Requests without an Origin
 * header remain available to same-origin/server-side callers.
 */
export function isTrustedGlydeOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin === null || TRUSTED_ORIGINS.has(origin);
}

export function glydeCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    Vary: "Origin",
  };

  if (origin && TRUSTED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = CORS_METHODS;
    headers["Access-Control-Allow-Headers"] = CORS_HEADERS;
    headers["Access-Control-Max-Age"] = "86400";
  }

  return headers;
}

export function glydeCorsPreflight(request: Request): Response {
  if (!isTrustedGlydeOrigin(request)) {
    return new Response(null, {
      status: 403,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        Vary: "Origin",
      },
    });
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "public, max-age=86400",
      ...glydeCorsHeaders(request),
    },
  });
}
