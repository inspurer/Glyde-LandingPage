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

**Everything from the hero down to the testimonials is now the exception.** The hero was rebuilt from Figma node `433-64` (video background, right-aligned headline, eight press logos) and no longer corresponds to anything in the Shopify theme. It lives in `public/hero.css` under a `heroV2*` namespace so it cannot collide with the theme's `.hero*` rules, and the theme's own hero is now dead code there. **The Shopify draft theme `194188083483` still has the old hero** — that divergence is deliberate and has to be closed before the theme is published:

- port the new hero markup into `theme/sections/glyde-landing.liquid`
- fold `public/hero.css` into `theme/assets/glyde-landing.css`
- upload `public/media/hero.*` and `public/assets/press/*` to Shopify Files
- delete the theme's now-unused `.hero*` rules and `hero-photo.png` / `hero-form.svg`
- delete the `Built Different` / "GLYDE Handles The Hard Parts" section from the Liquid, along with its `.features*` rules and `feature-person.png` / `feature-device.png` — Figma node `434-3` greys it out and marks it 隐藏, but the intent is removal, and it is already gone from this app
- port the five sections rebuilt from Figma node `497-283` (results, auto-fade, smart mode, manual mode, design & craft, testimonials) out of `public/sections.css` and `components/sections/`, and upload their media

## The rebuilt sections (Figma 497-283)

Everything between the hero and the FAQ was rebuilt from the `8.17修改` frame (1920×8997), committed at `referer/figma/page-497-283.png` (1x, for measuring) and `@2x.png` (for extracting artwork). The FAQ is deliberately untouched — the design revises its copy, but that revision is not in scope.

Geometry is measured, not estimated. Everything is expressed as `calc(N / 1920 * 100vw)` so it resolves to the measured value at 1920 and scales proportionally below that. Verified positions at 1920:

| | design | rendered |
| --- | --- | --- |
| results cards ×5 | 375×667 from x101, gap 21 | exact |
| results heading centres | eyebrow x1160.5, title x701.5 | 1161 / 701 |
| auto-fade video | 1759×823 centred, radius 24 | exact |
| smart cards ×4 | 420×520 from x78, gap 21 | ≤3px |
| manual title / device / wheel | x89 / x800–1191 / right 1724 | exact |
| craft tabs ×3 | 311×87 from x252, gap 57 | exact |
| craft cards ×5 | 352×466 from x82, gap 21 | ≤4px |
| testimonial cards ×4 | 351×364 from x228, centred | ≤2px |

Two things the design does that a naive reading misses: the results heading is **not** a centred stack (each line is offset by its own measured amount), and the smart-mode lead is **two separate runs** (a kicker ending at x1758 and a sentence left-aligned at x920), which no single alignment produces.

### Media

Four clips, all re-encoded without audio (browsers refuse to autoplay a video that has sound) to MP4 + WebM with posters. `components/sections/LoopingVideo.tsx` gates playback on an IntersectionObserver, so five background videos on one page do not all decode at once.

The clip-to-card pairing was confirmed by matching a frame from each video against the design's own card artwork — structural correlation put 佩戴发带 on card 02, 上推 on 03 and 整体效果 on 04, each its own best match — rather than trusting the filenames.

### The manual-mode wheel

Nine stops, 0.1–0.9, seven visible at a time, which is what falls out of the design's own geometry: neighbours sit 126 / 219.5 / 281px from the centre at scale .75 / .55 / .3. Those constants match the picker the Shopify theme already ships, so the design and that component evidently share a source.

The centre image dissolves with the selection. The nine frames are cropped to the design's device box — the crop window was found by template-matching the design's rendered device against the source footage — and carry `mix-blend-mode: lighten`, because sampling the design shows page background everywhere except the clipper itself: there is no photo box, and lighten reproduces that without needing an alpha channel.

Two things about it are load-bearing on touch, and both were once wrong:

- **`.s2Wheel` must not carry `touch-action: pan-y`.** That value hands vertical gestures to the browser for page scrolling, which is the exact gesture the picker needs: the first `touchmove` fired `pointercancel`, the page scrolled underneath, and the value never changed. It is `touch-action: none` with a `pinch-zoom` second declaration, so browsers that know the keyword still let the page be magnified over the wheel.
- **The option offsets scale by `--wheel-unit`, not by viewport width.** Desktop defines it as `100vw / 1920`, so the measured 126 / 219.5 / 281 offsets land exactly. A phone cannot use that formula — 281 units of a 390px viewport is 57px, which stacked all nine digits into a 140px pile — so the mobile rule reties it to the wheel's own height (`min(80vw, 400px) / 581`), keeping the design's proportions at whatever height the box gets.

The device image **dissolves** rather than swaps, driven by the same fractional position. The frame below the position stays fully opaque and only the one above fades in, by exactly the distance travelled — stacking two half-transparent frames instead would dim the composite through the middle of every transition. `mix-blend-mode: lighten` lives on the container, not on each frame: per-frame, the two images in a dissolve each lighten the page independently and you see their union, both blade lengths at once as a hard double image, which is what the old swap flickered with. The transition is suspended while dragging, since the position is already continuous there, and returns for the snap and for keyboard, tap and scroll-wheel jumps.

Drag distance per stop is derived from the rendered height (`42 / 581`, floored at 30px) rather than hard-coded, so the phone wheel is not three times as sensitive as the desktop one. Tapping a digit selects it: the options are `pointer-events: none` so they never interrupt a drag, so the wheel resolves a tap itself by picking the nearest visible option to the `pointerdown` position.

### Design & Craft — one row, three bookmarks

Twelve 352×466 cards in a single row, not three sets. The tabs are positions in that row four cards apart: Interaction parks card 1 at the left edge, Philosophy card 5, Colors card 9. Arrowing or swiping past a boundary moves the selected tab with it, because the tab describes where you are.

Desktop moves the track with a transform and its viewport never scrolls; the phone drops that transform and scrolls natively. One handler does both, and whichever does not apply is a no-op — plus a scroll listener on the phone so a swipe updates the selected tab.

Artwork is exported from Figma at 2x (704×932 per card) and re-encoded to WebP, 352KB for all twelve, in `public/assets/v2/craft-01..12.webp`. Unlike the first batch these carry no baked-in caption, so nothing has to be painted out. The order was checked rather than trusted: each of the first five matches its card in the page export with a mean grey difference of 5-8 where the nearest other card scores 28-41, a four-to-sixfold margin.

### Mobile

Below 900px each section re-flows; the phone-specific corrections worth knowing about:

- The hero's waitlist form **stacks** below 560px. Side by side, "Get Early Access" at 700 weight takes 198px of a 328px pill and left the field 89px of usable width for a placeholder needing 133px, so the hint clipped mid-word. Hero only — the footer form is `.footerFormShell`, which the theme already re-proportions for phones; stacking that one too added ~62px to a `.finalCta` whose height is fixed and whose `.footer` is absolutely positioned, and the copyright line collided with the social icons.
- All four card carousels set `overscroll-behavior-x: contain`. Without it a flick past the last card chains to the page, which on iOS and Android is the back-navigation gesture.
- `.s2ManualIntro` is `display: contents` on mobile so the heading and copy become grid items. As a plain wrapper it was itself the single grid item, so the copy rendered above the device and the row the grid reserved for it stayed empty.
- Press, header, footer and social links carry 44px minimums. The press marks are 15–18px tall, so the links around them were a third of the height a fingertip needs.

### Results — the five Shorts

The five cards hold Shorts from GLYDE's own YouTube channel. Their 9:16 frame matches the design's 375×667 card to within half a percent, so the artwork fills the card with no crop and no letterbox.

Each card is a **facade, not an embed**: a self-hosted poster with a play control, which mounts the real player only on click, and only one at a time. Five live iframes would pull several megabytes of YouTube's player on first paint and set third-party cookies for every visitor who never presses play — on a page whose own analytics are deliberately first-party. Verified: zero requests to `youtube.com`, `ytimg.com` or `googlevideo.com` before the first click.

**The player points at `youtube.com`, not `youtube-nocookie.com`.** Some networks are shown "sign in to confirm you're not a bot" instead of the video, and on the nocookie host signing in cannot help at all: it is a separate registrable domain, so the session cookie on `.youtube.com` is never sent to it — verified, the nocookie host sets no cookies on load. Picking that host for privacy had quietly removed the only remedy the gate offers. Even on `youtube.com` it depends on the browser letting the frame reach its own cookies, which third-party cookie blocking prevents, and nothing on this side can change that.

**The player carries `autoplay=1`, so the poster's click is the only one needed.** That click is a user gesture on this document and the iframe's `allow` attribute delegates autoplay to the frame, which is what lets a player mounted on click start with sound. YouTube answers a player that starts without a gesture of its own with "sign in to confirm you're not a bot", and the video never plays. Measured on the live origin, five configurations side by side: `autoplay=1` shows the gate the instant the frame loads, on both `youtube.com` and the nocookie host, as does `autoplay=1&mute=1` and driving an otherwise-idle player with a postMessage `playVideo` command. Loaded idle, all five render the video's own first frame and title.

That is **not** the same as playback working, and reading it that way was a mistake worth not repeating: pressing the player's own control on a blocked network produces the same gate. Autoplay does not cause the block, it only brings it forward, so dropping it bought nothing but a second click for everyone who *can* play. Verify playback by dispatching a real `Input.dispatchMouseEvent` onto the player and screenshotting the result; a rendered poster proves nothing.

Self-hosting these five the way the rest of the page's video works would remove both the second click and the dependency on YouTube being willing to serve the visitor's network at all — which it is not, from mainland China. That needs the five source files; nothing in `glyde-landing-materia` covers them.

Posters come from each video's `oar2.jpg`, which is the only variant that returns the true vertical original (1080×1920); `hqdefault`/`maxresdefault` return a 4:3 or 16:9 letterbox of a vertical video, and `oardefault` 404s on some of them. They are re-encoded to WebP at 720×1280 in `public/assets/v2/result-*.webp`, ~284KB for all five. Playback goes to `youtube-nocookie.com`, and pressing play emits a first-party `video_play` event.

To swap a video, change its entry in `components/sections/ResultsSection.tsx` and re-fetch the poster:

```bash
curl -s "https://i.ytimg.com/vi/<ID>/oar2.jpg" -o /tmp/p.jpg
cwebp -q 82 -resize 720 1280 /tmp/p.jpg -o public/assets/v2/result-0N-<ID>.webp
```

### Known gaps

- The craft card artwork had its captions baked in by the export. They are painted out (vertical interpolation across the caption band) so the caption can be real text; originals are in the scratch copy if a clean re-export is ever wanted.
- **Mobile is an adaptation, not a Figma frame.** The file has a separate 移动端 board that was not part of this task.

### Verifying a change

`scripts/shoot.mjs` and `scripts/probe.mjs` drive headless Chrome over CDP, because neither the browser extension nor Chrome's `--screenshot` flag can set an exact viewport for a page whose hero is `100svh`.

```bash
node scripts/shoot.mjs http://127.0.0.1:3000/ out.png 1920 1080        # full page
node scripts/shoot.mjs http://127.0.0.1:3000/ out.png 1920 1080 4520   # viewport at a scroll offset
node scripts/probe.mjs http://127.0.0.1:3000/ query.js 1920 1080       # evaluate JS, print JSON
node scripts/touch-audit.mjs http://127.0.0.1:3000/ probe.js 390 844 3 # phone viewport, real touch events
```

Use `touch-audit.mjs` for anything a finger does. It turns on touch emulation and dispatches real `Input.dispatchTouchEvent` sequences, which is the only way `touch-action` and `pointercancel` enter the picture at all — the wheel bug above was invisible to a mouse-driven probe, which drove it perfectly. Its probe file is a function body receiving `evaluate`, `touchDrag`, `send`, `sessionId`, `viewport` and `sleep`.

It asserts its own viewport before reporting and refuses to print if the page does not match the requested size. That check exists because an unverified viewport is worse than no measurement: a bad invocation once produced four plausible-looking reports at four different widths that were all taken at the same wrong one.

When invoking it from a loop, note that **zsh does not word-split unquoted expansions** — `set -- $wh` leaves `$1` as the whole `"390 844"` string. Split explicitly (`w="${wh%x*}"; h="${wh#*x}"`).

Prefer the scroll-offset form when checking a carousel: `captureBeyondViewport` re-lays-out the page and has been seen to paint a clipped, transformed track 101px off from where the DOM actually puts it.

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
rsync -az --delete --exclude='.env' \
  app components lib scripts public \
  package.json package-lock.json next.config.ts tsconfig.json \
  eslint.config.mjs Dockerfile docker-compose.yml .dockerignore next-env.d.ts \
  root@170.106.168.100:/opt/glyde/
ssh root@170.106.168.100 'cd /opt/glyde && docker compose up --build -d'
```

**rsync, not the tar-and-scp this used to be.** The tarball is 31MB and this link dropped it twice mid-transfer — once at 26MB, once at 3MB — each time leaving a truncated file that would have extracted into a half-populated tree. The diff is normally a couple of megabytes. Updating in place also means `/opt/glyde/.env` is never removed, so `ADMIN_TOKEN` survives on its own rather than needing to be backed up and restored around a wipe; `--exclude` keeps `--delete` off it. Without that token `docker compose` substitutes an empty value and `/admin` refuses to sign anyone in. Signups are safe regardless — they live in the named `glyde-data` volume, not in `/opt/glyde`.

The first `--delete` run also cleared 176 `._*` AppleDouble files that BSD tar had been depositing on every previous deploy.

Confirm the container was actually replaced rather than left running, by comparing `docker inspect -f '{{.Created}}' glyde-landing-page` before and after: the old container stays healthy throughout a `docker compose up --build`, so a health check proves nothing. Then verify against the live URL, not the build log — fetch the stylesheet and grep it for whatever the change introduced.

Server access is password-only (`server.config`); key auth is not set up, so `ssh -o BatchMode=yes` fails. Rotating that password and moving to keys is still worth doing.

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
