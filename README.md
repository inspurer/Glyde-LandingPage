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

**The hero and the removed "Built Different" section are the exceptions.** The hero was rebuilt from Figma node `433-64` (video background, right-aligned headline, eight press logos) and no longer corresponds to anything in the Shopify theme. It lives in `public/hero.css` under a `heroV2*` namespace so it cannot collide with the theme's `.hero*` rules, and the theme's own hero is now dead code there. **The Shopify draft theme `194188083483` still has the old hero** — that divergence is deliberate and has to be closed before the theme is published:

- port the new hero markup into `theme/sections/glyde-landing.liquid`
- fold `public/hero.css` into `theme/assets/glyde-landing.css`
- upload `public/media/hero.*` and `public/assets/press/*` to Shopify Files
- delete the theme's now-unused `.hero*` rules and `hero-photo.png` / `hero-form.svg`
- delete the `Built Different` / "GLYDE Handles The Hard Parts" section from the Liquid, along with its `.features*` rules and `feature-person.png` / `feature-device.png` — Figma node `434-3` greys it out and marks it 隐藏, but the intent is removal, and it is already gone from this app

Everything below the hero is still byte-shared with the theme. When editing those sections in `components/LandingPage.tsx`, keep class names, `data-` attributes and element order in step with the Liquid section. The script binds behaviour through those `data-` attributes and the stylesheet positions several elements absolutely, so a structural change can silently break the carousel or the picker.

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

## Waitlist and admin

There is no Shopify storefront in front of this deployment, so its native customer form is unavailable and this app owns the waitlist end to end:

1. Either form posts to `/api/subscribe`.
2. The address is validated, then stored in SQLite (`node:sqlite`, no added dependency) under `GLYDE_DATA_DIR` — the `glyde-data` Docker volume, so signups survive a rebuild.
3. The browser is sent to `/deposit`, this app's port of the Shopify deposit page, which is where the theme's `return_to: '/pages/deposit'` would have landed.

Storing locally is what makes a signup succeed. If `SHOPIFY_ADMIN_ACCESS_TOKEN` is set, the address is also forwarded to Shopify, but that is best-effort: the outcome is recorded per row and shown in the admin table rather than allowed to fail the request. Reporting failure after an address is safely stored would only prompt a resubmission that changes nothing.

Re-submitting a known address reports success and leaves the original timestamp alone. The honeypot field returns success without storing anything.

`/admin` lists collected addresses, 25 per page, newest first. It needs `ADMIN_TOKEN` (at least 16 characters — the page refuses to sign anyone in with a shorter one rather than pretend to be protected). Entering it sets an HMAC-signed, `httpOnly` cookie that expires after 12 hours; the token itself is never stored in the browser, so rotating `ADMIN_TOKEN` invalidates every existing session. Failed attempts are throttled per IP.

On the server the token lives in `/opt/glyde/.env` (mode `600`), which Docker Compose reads automatically.

```bash
# rotate the admin token
ssh root@170.106.168.100 \
  "printf 'ADMIN_TOKEN=%s\n' \"\$(openssl rand -base64 24)\" > /opt/glyde/.env \
   && chmod 600 /opt/glyde/.env && cd /opt/glyde && docker compose up -d"
```

To read the database directly:

```bash
ssh root@170.106.168.100 \
  "docker exec glyde-landing-page node -e \"const{DatabaseSync}=require('node:sqlite');console.table(new DatabaseSync('/data/waitlist.db').prepare('select * from subscribers order by id desc limit 20').all())\""
```

## The hero video

`public/media/hero.{mp4,webm}` is encoded from the 4K master Figma holds for that frame (`1_00099456.mp4`, 3840×2160) rather than the pre-compressed 1080p copy, so the downscale happens once instead of twice. Both are 1920×1080 with **no audio track**: browsers refuse to autoplay a video that has sound, so an unmuted hero video would simply never start. 8MB of source becomes 3.6MB of H.264 and 2.3MB of VP9, plus a 49KB poster.

`components/HeroVideo.tsx` keeps no state. The poster sits behind the video and the `<video>` shows its own poster until playback begins, so reduced motion, a refused autoplay on iOS Low Power Mode, and an unsupported codec all land on the same still frame without the component tracking which happened.

Re-encode with:

```bash
ffmpeg -i <4k-source> -an -vf "scale=1920:1080:flags=lanczos" \
  -c:v libx264 -profile:v high -crf 25 -preset slow -pix_fmt yuv420p \
  -movflags +faststart public/media/hero.mp4
```

### Press logos

`public/assets/press/*.png` were keyed out of a 3× export of the Figma frame: the marks are pure white over dark footage, so alpha comes from whiteness gated on saturation, which rejects the video showing through. They are laid out by **width** (each outlet's measured design width, carried as `--press-w`), not by a shared height — forcing one height scales each mark by however much its own artwork was trimmed and the row drifts wider than the design.

## Analytics

`components/Analytics.tsx` is mounted in the landing and deposit layouts (never in the admin) and reports behaviour to `/api/events`. It captures:

| Event | When |
| --- | --- |
| `session_start` | first page of a session, with screen size and language |
| `page_view` | every page, with viewport, title and any `utm_*` parameters |
| `click` | any link, button, `<summary>`, `[role=option]` or `[data-track]`, labelled by `data-track` → `aria-label` → trimmed text |
| `outbound_click` | a link whose host is not this one |
| `scroll_depth` | first time 25 / 50 / 75 / 100% is reached |
| `section_view` | a `<section>` becomes 40% visible, labelled by its `aria-labelledby` |
| `engagement` | on page-hide, with visible seconds and deepest scroll |
| `waitlist_submit` / `waitlist_success` / `waitlist_error` | the signup form |

Add a domain event from anywhere with `trackEvent("name", { label, value, props })`.

Events are queued and flushed every 5s, at 10 queued, and on page-hide. The page-hide flush uses `navigator.sendBeacon`, because a normal `fetch` is cancelled when the document goes away — which is exactly when the engagement event is worth having. That is also why the signup redirect is a full `location.assign` rather than a client-side push.

### What is deliberately not collected

No cookies, no third-party script, no fingerprinting. The server stores **no IP address and no user-agent string**. A visitor is identified only by a random id this site generates and keeps in its own `localStorage`, so the data cannot follow anyone off this host; the session id lives in `sessionStorage` and rolls over after 30 minutes of inactivity. Referrers are reduced to a bare hostname server-side before they are written, so a referring URL's query string is never stored.

Ingest is rate-limited to 60 requests per minute per IP, caps a batch at 50 events and a body at 32KB, and validates the client-generated ids against the format it issues before they become a grouping key.

### Dashboard

`/admin` shows visitors, sessions, page views, signups, conversion (signups per session) and events per session over 7/14/30/90 days, a daily-visitor trend, and breakdowns by event, page, clicked element, device and referrer. `/admin/events` is the raw feed, filterable by event name, 50 per page.

Charts are inline SVG with no charting dependency: single series throughout, so there is no legend and no categorical palette — one hue carries magnitude. The series colour is the brand blue `#085aff`, checked against the white card surface with the data-viz validator (lightness band, chroma floor, ≥3:1 contrast). Light mode only; the admin is a single-surface internal tool.

### The deposit page

`app/(deposit)/deposit/page.tsx` is a port of `theme/sections/glyde-deposit.liquid`, using the theme's own `glyde-deposit.css`. Two things could not carry over: the Shopify version adds a $3 product to the cart through `<product-form>`, so "Reserve Now" links to the real storefront where the reservation can actually be paid, and the header cart icon is dropped rather than left as a control that does nothing.

The landing and deposit designs are mutually exclusive stylesheets — the landing sheet styles a bare `body` dark, the deposit sheet scopes everything to `body.glyde-deposit-page` and paints it white. Each section therefore has its own root layout under `app/(site)`, `app/(deposit)` and `app/(admin)`; there is deliberately no `app/layout.tsx`.

## Deployment notes

- Route the landing page and its Next.js-owned paths to port `3000`: `/`, `/_next/*`, `/assets/*`, `/fonts/*`, `/api/subscribe`, `/terms`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/llms.txt`, and `/icon.png`.
- Keep Shopify commerce and policy paths on the existing Shopify storefront, especially `/pages/deposit`, `/policies/*`, `/products/*`, `/cart*`, `/checkout*`, and `/cdn/*`. Do not send every `glydeclipper.com` path to this container or the reservation/checkout flow will return `404`.
- Terminate TLS at the reverse proxy or hosting platform.
- Keep the canonical production hostname as `glydeclipper.com`; `robots.txt`, `sitemap.xml`, and the web manifest are generated by Next.js metadata routes.
- The image copies both `public/` and `.next/static/` alongside the traced standalone server, so local fonts and Figma assets are included at runtime.
