# GLYDE landing page

Landing page for [glydeclipper.com](https://glydeclipper.com), built with Next.js, React, and TypeScript.

## Where the design lives

The Shopify theme in `theme/` is the source of truth for the landing page's appearance and behaviour. It received the 2026-08-13 rework of the results carousel, the Manual Mode length picker and the mobile waitlist form, none of which existed in the React implementation.

Rather than maintaining two copies of that logic, this app renders the same DOM as `theme/sections/glyde-landing.liquid` and loads the theme's own stylesheet and script unmodified:

```bash
npm run sync:theme
```

That copies `glyde-landing.css`, `glyde-landing.js` and every asset the stylesheet references with a relative `url()` into `public/theme/`. The files are served byte-identical to what Shopify serves — verify with `shasum -a 256 theme/assets/glyde-landing.css public/theme/glyde-landing.css`.

`public/theme/` is committed, because `.dockerignore` excludes `theme/` from the build context. Run `npm run sync:theme` and commit the result after changing the theme; `npm run dev` runs it automatically.

When editing `components/LandingPage.tsx`, keep class names, `data-` attributes and element order in step with the Liquid section. The script binds behaviour through those `data-` attributes and the stylesheet positions several elements absolutely, so a structural change can silently break the carousel or the picker.

## Local development

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Production container

```bash
docker compose up --build -d
docker compose ps
```

The multi-stage image contains only the Next.js standalone runtime and runs as the unprivileged `nextjs` user on port `3000`.

Production waitlist delivery requires a Shopify Admin API token. The endpoint only reports success after Shopify confirms the customer upsert, newsletter tag, and email-marketing consent update; a missing token returns `503` instead of showing a false success.

The container uses these runtime values:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `production` | Enables the optimized Next.js runtime. |
| `HOSTNAME` | `0.0.0.0` | Makes the standalone server reachable outside the container. |
| `PORT` | `3000` | Internal container port used by the server and health check. |
| `NEXT_TELEMETRY_DISABLED` | `1` | Disables Next.js telemetry. |
| `GLYDE_HOST_PORT` | `3000` | Optional host-side port used by Docker Compose. |
| `SHOPIFY_STORE_DOMAIN` | `drhrvj-70.myshopify.com` | Shopify store hostname used by the waitlist API. |
| `SHOPIFY_API_VERSION` | `2026-07` | Stable Shopify Admin GraphQL API version. |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | empty | Required production secret; requires `write_customers` and protected customer-data access. |

Copy `.env.example` to `.env` and set `SHOPIFY_ADMIN_ACCESS_TOKEN` in the deployment environment. Do not commit the token. With the token configured, `/api/subscribe` upserts the customer by email, sets email-marketing consent, and adds the `newsletter` and `GLYDE Landing Page` tags.

Before launch, submit a controlled email through the deployed form and verify in Shopify that the customer has both tags and the `SUBSCRIBED` / `SINGLE_OPT_IN` email-marketing state. The honeypot filters simple form bots, but the public `/api/subscribe` route must also be protected by rate limiting or bot protection at Cloudflare, the CDN, or the reverse proxy.

To publish the site on a different host port while keeping the container port unchanged:

```bash
GLYDE_HOST_PORT=8080 docker compose up --build -d
```

Stop it with:

```bash
docker compose down
```

## Preview deployment — glydeclipper.online

A preview of this app runs at [glydeclipper.online](https://glydeclipper.online) on `170.106.168.100` (Ubuntu 24.04). Server credentials live in `server.config`, which is gitignored because it holds a plaintext root password.

Docker publishes the app on `127.0.0.1:3000` only, and Caddy is the sole public entry point, terminating TLS with a Let's Encrypt certificate it obtains and renews automatically. `/etc/caddy/Caddyfile`:

```caddyfile
glydeclipper.online {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
```

Only the apex is listed — `www.glydeclipper.online` has no DNS record, and naming a host Caddy cannot validate fails certificate issuance. Caddy logs to journald (`journalctl -u caddy`).

To redeploy, upload the source and rebuild on the server — the image must be built there, since the server is `x86_64`:

```bash
npm run sync:theme
tar -czf /tmp/glyde-src.tgz app components lib scripts public \
  package.json package-lock.json next.config.ts tsconfig.json \
  eslint.config.mjs Dockerfile docker-compose.yml .dockerignore next-env.d.ts
scp /tmp/glyde-src.tgz root@170.106.168.100:/root/
ssh root@170.106.168.100 'rm -rf /opt/glyde && mkdir -p /opt/glyde \
  && tar -xzf /root/glyde-src.tgz -C /opt/glyde \
  && cd /opt/glyde && docker compose up --build -d'
```

### The preview must not be indexed

A public copy of the production landing page would compete with the real site in search results, so indexing is blocked in three places. Change all three together:

- `app/robots.ts` — `Disallow: /` for `*` plus every named search, AI and SEO crawler.
- `app/layout.tsx` — `robots: { index: false, follow: false }`, which emits `<meta name="robots" content="noindex, nofollow, nocache">`.
- `next.config.ts` — an `X-Robots-Tag: noindex, nofollow, …` response header.

robots.txt only asks crawlers not to fetch; a URL linked from elsewhere can still be indexed without ever being crawled. The meta tag and the header are what actually keep it out, and the header covers assets a crawler reaches directly.

The waitlist form posts to `/api/subscribe`, which requires `SHOPIFY_ADMIN_ACCESS_TOKEN`. That is not set on the preview, so submissions return `503` and the form shows an error. Set the token in `/opt/glyde/.env` if the preview needs a working signup.

## Deployment notes

- Route the landing page and its Next.js-owned paths to port `3000`: `/`, `/_next/*`, `/assets/*`, `/fonts/*`, `/api/subscribe`, `/terms`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/llms.txt`, and `/icon.png`.
- Keep Shopify commerce and policy paths on the existing Shopify storefront, especially `/pages/deposit`, `/policies/*`, `/products/*`, `/cart*`, `/checkout*`, and `/cdn/*`. Do not send every `glydeclipper.com` path to this container or the reservation/checkout flow will return `404`.
- Terminate TLS at the reverse proxy or hosting platform.
- Keep the canonical production hostname as `glydeclipper.com`; `robots.txt`, `sitemap.xml`, and the web manifest are generated by Next.js metadata routes.
- The image copies both `public/` and `.next/static/` alongside the traced standalone server, so local fonts and Figma assets are included at runtime.
