import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const theme = join(root, "theme");
const errors = [];

async function read(relativePath) {
  return readFile(join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function parseThemeJson(source) {
  return JSON.parse(source.replace(/^\/\*[\s\S]*?\*\/\s*/, ""));
}

const liquidFiles = [
  "theme/layout/theme.liquid",
  "theme/sections/glyde-landing-v3.liquid",
  "theme/snippets/glyde-v3-waitlist.liquid",
  "theme/sections/glyde-deposit-v3.liquid",
  "theme/snippets/glyde-structured-data.liquid",
];
const cssFiles = [
  "theme/assets/glyde-landing.css",
  "theme/assets/glyde-v3-hero.css",
  "theme/assets/glyde-v3-sections.css",
  "theme/assets/glyde-v3-overrides.css",
  "theme/assets/glyde-deposit-v3.css",
];
const javascriptFiles = [
  "theme/assets/glyde-landing-v3.js",
  "theme/assets/glyde-deposit-v3.js",
  "theme/assets/glyde-analytics-v3.js",
];

const requiredAssets = new Set();
for (const file of liquidFiles) {
  const source = await read(file);
  for (const match of source.matchAll(/['"]([^'"]+)['"]\s*\|\s*asset_url/g)) {
    requiredAssets.add(match[1]);
  }
}
for (const file of cssFiles) {
  const source = await read(file);
  for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    const url = match[1].trim();
    if (!/^(?:data:|https?:|\/\/|#)/i.test(url)) requiredAssets.add(url);
  }
}
for (const file of javascriptFiles) {
  const source = await read(file);
  for (const match of source.matchAll(/['"]([^'"]+)['"]\s*\|\s*asset_url/g)) {
    requiredAssets.add(match[1]);
  }
}

for (const asset of requiredAssets) {
  try {
    await access(join(theme, "assets", asset));
  } catch {
    errors.push(`Missing active theme asset: ${asset}`);
  }
}

const indexTemplate = parseThemeJson(await read("theme/templates/index.json"));
const depositTemplate = parseThemeJson(await read("theme/templates/page.deposit.json"));
const depositV3Template = parseThemeJson(await read("theme/templates/page.deposit-v3.json"));
assert(indexTemplate.sections?.glyde_landing_v3?.type === "glyde-landing-v3", "Homepage template is not v3.");
assert(depositTemplate.sections?.main?.type === "glyde-deposit-v3", "Deposit template is not v3.");
assert(depositV3Template.sections?.main?.type === "glyde-deposit-v3", "Deposit-v3 template is not v3.");

const layout = await read("theme/layout/theme.liquid");
const deposit = await read("theme/sections/glyde-deposit-v3.liquid");
const landing = await read("theme/sections/glyde-landing-v3.liquid");
const waitlist = await read("theme/snippets/glyde-v3-waitlist.liquid");
const analytics = await read("theme/assets/glyde-analytics-v3.js");
const interactions = await read("theme/assets/glyde-landing-v3.js");
const landingCss = await read("theme/assets/glyde-landing.css");
const settingsRaw = await read("theme/config/settings_data.json");
const settings = parseThemeJson(settingsRaw);

assert(layout.includes("GTM-TP33P29Q"), "GTM container was not migrated.");
assert(layout.includes("1176292317946919"), "Meta Pixel was not migrated.");
assert(
  layout.includes(",interactive-widget=resizes-visual{% endif %}"),
  "The Shopify landing viewport must match the keyboard behavior of the Next.js site.",
);
assert(layout.includes("{{ content_for_header }}"), "Shopify app pixels cannot load without content_for_header.");
assert(layout.includes("glyde-landing-v3.js") && !layout.includes("<script src=\"{{ 'glyde-landing.js'"), "Homepage script loading is not isolated to v3.");
assert(layout.includes("glyde-analytics-v3.js"), "First-party storefront analytics is not loaded.");
assert(
  layout.includes("request.page_type == 'product' and product.handle == 'glyde-vip-prelaunch-reservation-online'"),
  "The public $5 product route is not isolated from the legacy product template.",
);
assert(
  !layout.includes("if template.suffix == 'deposit-v3'\n      assign is_glyde_deposit = true"),
  "An arbitrary deposit-v3 suffix can activate the custom Deposit layout.",
);
assert(
  layout.includes("assign glyde_canonical_url = shop.url | append: '/pages/deposit'") &&
    layout.includes('<meta name="robots" content="noindex,follow">'),
  "The duplicate $5 product route is not canonicalized/noindexed to /pages/deposit.",
);
assert(analytics.includes("https://glydeclipper.online/api/events"), "Analytics ingest endpoint is not configured.");
assert(interactions.includes("https://glydeclipper.online/api/subscribe"), "Waitlist ingest endpoint is not configured.");
assert(interactions.includes("shopify-fallback"), "Shopify-native waitlist fallback is missing.");
assert(
  interactions.includes("Shopify?.captcha?.protect") &&
    interactions.includes("protect(form, dispatchNativeSubmit)") &&
    !interactions.includes("requestCaptchaProtection"),
  "Pre-bound Shopify hCaptcha or its native fallback handoff is missing.",
);
assert(
  waitlist.includes("{% form 'customer'") &&
    waitlist.includes("data-shopify-captcha: 'true'") &&
    !waitlist.includes("data-nocaptcha"),
  "The Shopify customer form must pre-bind hCaptcha before mobile focus.",
);
assert(
  !waitlist.includes("shopify.online_store.spam_detection.disclaimer_html") &&
    !waitlist.includes('data-spam-detection-disclaimer'),
  "The waitlist must not render an inline hCaptcha disclosure outside the Figma design.",
);
assert(
  !landingCss.includes(".waitlistForm > [data-spam-detection-disclaimer]"),
  "Obsolete inline hCaptcha disclosure styling is still present.",
);

const appBlockTypes = Object.values(settings.current?.blocks || {}).map((block) => block.type || "");
assert(appBlockTypes.some((type) => type.includes("gempages-builder")), "GemPages app embed setting was not migrated.");
assert(appBlockTypes.some((type) => type.includes("microsoft-clarity")), "Microsoft Clarity app embed setting was not migrated.");
assert(settings.current?.social_facebook_link, "Facebook theme setting was not migrated.");
assert(settings.current?.social_instagram_link, "Instagram theme setting was not migrated.");
assert(settings.current?.social_youtube_link, "YouTube theme setting was not migrated.");

assert(deposit.includes("glyde-vip-prelaunch-reservation-online"), "The $5 product handle is missing.");
assert(deposit.includes("53870139375899"), "The $5 variant id is missing.");
assert(deposit.includes("deposit_variant.price == 500"), "The $5 price guard is missing.");
assert(!deposit.includes("reserve-your-special-discount") && !deposit.includes("51438752923931"), "Deposit v3 references the retired $3 product.");
assert(
  deposit.includes('"templates": ["page", "product"]'),
  "Deposit v3 must support the exact product route rendered by theme.liquid.",
);
assert(landing.includes("assign reserve_url = '/pages/deposit'"), "Landing reservation destination is not fail-closed to /pages/deposit.");
assert(!landing.includes('"id": "reserve_url"'), "Landing exposes an unsafe editable reservation destination.");
assert(
  /<ul class="finalTrust"[^>]*><li>/.test(landing) &&
    (landing.match(/<\/li><li>/g) || []).length >= 2,
  "Final trust items contain Liquid whitespace that breaks the preformatted desktop row.",
);

const sourceHero = await read("public/hero.css");
const sourceSections = await read("public/sections.css");
const sourceOverrides = await read("public/landing-v3.css");
const featureShowcase = await read("components/sections/FeatureShowcaseSection.tsx");
const checkoutCss = await read("app/(checkout)/checkout/checkout.module.css");
const nextHeroVideo = await read("components/HeroVideo.tsx");
const themeHero = await read("theme/assets/glyde-v3-hero.css");
const themeSections = await read("theme/assets/glyde-v3-sections.css");
const themeOverrides = await read("theme/assets/glyde-v3-overrides.css");
assert(sourceHero === themeHero, "Shopify hero CSS diverges from the Next.js baseline.");
assert(sourceSections === themeSections, "Shopify section CSS diverges from the Next.js baseline.");
assert(
  sourceOverrides.replaceAll("/assets/v3/", "v3-").replaceAll("/theme/footer-form.svg", "footer-form.svg") === themeOverrides,
  "Shopify override CSS diverges from the URL-rewritten Next.js baseline.",
);
const mobileVideoOverride = sourceOverrides.slice(
  sourceOverrides.indexOf("Keep the mobile Figma still as the loading/failure fallback"),
);
assert(
  mobileVideoOverride.includes(".heroV2Video {") &&
    mobileVideoOverride.includes("z-index: 3;") &&
    mobileVideoOverride.includes("display: block;") &&
    mobileVideoOverride.includes('.heroV2Video[data-glyde-playing="true"]') &&
    mobileVideoOverride.includes("opacity: 1;") &&
    mobileVideoOverride.includes("(prefers-reduced-motion: reduce)") &&
    mobileVideoOverride.includes("display: none;"),
  "The shared mobile hero video visibility or reduced-motion fallback is missing.",
);
assert(
  nextHeroVideo.indexOf('/media/hero.mp4') < nextHeroVideo.indexOf('/media/hero.webm') &&
    landing.indexOf("media-hero.mp4") < landing.indexOf("media-hero.webm"),
  "The iOS-compatible H.264 hero source must precede the WebM fallback on both sites.",
);
assert(
  nextHeroVideo.includes('video.dataset.glydePlaying = "true"') &&
    nextHeroVideo.includes("video.defaultMuted = true") &&
    nextHeroVideo.includes('video.addEventListener("pause", recoverUnexpectedPause)') &&
    nextHeroVideo.includes('window.addEventListener("pageshow", syncPlayback)') &&
    interactions.includes('video.dataset.glydePlaying = "true"') &&
    interactions.includes("video.defaultMuted = true") &&
    interactions.includes('controller.on(video, "pause", recoverUnexpectedPause)') &&
    interactions.includes('controller.on(window, "pageshow", syncPlayback)'),
  "The shared hero first-frame fallback or unexpected-pause recovery is missing.",
);
assert(
  nextHeroVideo.includes('preload="auto"') && landing.includes('preload="auto"'),
  "Both hero implementations must buffer the short loop consistently.",
);
assert(
  sourceOverrides.includes("object-position: 29% center") &&
    sourceOverrides.includes("top: calc(1177 / 1080 * 100vw)") &&
    sourceOverrides.includes("height: calc(350 / 1080 * 100vw)") &&
    sourceOverrides.includes("#01050b 21.944%"),
  "The mobile hero crop or Figma 733:13 black overlay is missing.",
);
assert(
  sourceOverrides.includes(".finalTrust li::before") &&
    sourceOverrides.includes("content: none") &&
    sourceOverrides.includes('opacity: 0.72'),
  "The single Figma trust bullets or Results play affordances are missing.",
);
assert(
  (landing.match(/<article class="s2QuoteCard">/g) || []).length === 4 &&
    landing.includes('class="s2QuotesGrid" role="region" aria-label="Customer reviews" tabindex="0"'),
  "The Shopify landing must expose all four reviews in an accessible testimonial rail.",
);
assert(
  !sourceOverrides.includes(".s2QuoteCard:nth-child(n + 4)") &&
    sourceOverrides.includes("padding-right: calc(60 / 1080 * 100vw)") &&
    sourceOverrides.includes("scroll-padding-right: calc(60 / 1080 * 100vw)") &&
    sourceOverrides.includes("-webkit-overflow-scrolling: touch") &&
    sourceOverrides.includes("touch-action: pan-x pan-y"),
  "The fourth mobile testimonial is hidden or the native swipe rail is incomplete.",
);
assert(
  ["guided", "cable", "hand", "colors"].every((name) =>
    featureShowcase.includes(`/assets/v3/feature-${name}.png`) &&
    landing.includes(`'v3-feature-${name}.png' | asset_url`)
  ) &&
    !featureShowcase.includes("feature-desktop-") &&
    !landing.includes("v3-feature-desktop-"),
  "Design & Craft must use text-free artwork with a separate semantic copy layer.",
);
assert(
  sourceOverrides.includes(".featureShowcaseCopy h2 {") &&
    sourceOverrides.includes("font-weight: 700;") &&
    sourceOverrides.includes(".featureShowcaseCopy p {") &&
    sourceOverrides.includes("margin-top: calc(16 / 1920 * 100vw);") &&
    (sourceOverrides.match(/line-height: normal;/g) || []).length >= 2 &&
    sourceOverrides.includes("filter: contrast(1.26);") &&
    sourceOverrides.includes("left: calc(-50 / 1920 * 100vw);") &&
    sourceOverrides.includes('url("/assets/v3/feature-shadow-wide.svg")') &&
    sourceOverrides.includes('url("/assets/v3/feature-shadow-narrow.svg")') &&
    !/\.featureShowcaseCopy,\s*\n\s*\.featureShowcaseSwatches\s*\{\s*display:\s*none/.test(sourceOverrides),
  "Design & Craft's desktop HTML typography, artwork alignment, or Figma shadow layer is incomplete.",
);
assert(
  sourceOverrides.includes("linear-gradient(143.1301deg, #fff 0%, #c8c8c8 89.286%)") &&
    sourceOverrides.includes("linear-gradient(152.7232deg, #babbc0 9.3025%, #76777c 92.824%)") &&
    sourceOverrides.includes("linear-gradient(152.7232deg, #272727 9.3025%, #080606 92.824%)"),
  "Design & Craft's three finish swatches have drifted from the Figma fills.",
);
assert(
  sourceOverrides.includes(".heroV2 .heroV2Form .waitlistForm input,\n  .footerFormShell .waitlistForm input {\n    touch-action: manipulation;") &&
    (sourceOverrides.match(/font-size:\s*max\(16px,/g) || []).length >= 2 &&
    /\.field input,\s*\n\s*\.field select\s*\{\s*font-size:\s*16px;\s*touch-action:\s*manipulation;/m.test(checkoutCss) &&
    !/maximum-scale|user-scalable/i.test(sourceOverrides),
  "Mobile inputs must avoid focus/double-tap zoom while preserving page pinch zoom.",
);

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Shopify v3 verification passed (${requiredAssets.size} active assets checked).`);
}
