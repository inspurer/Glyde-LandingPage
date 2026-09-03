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

const indexTemplate = JSON.parse(await read("theme/templates/index.json"));
const depositTemplate = JSON.parse(await read("theme/templates/page.deposit.json"));
const depositV3Template = JSON.parse(await read("theme/templates/page.deposit-v3.json"));
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
const settings = JSON.parse(settingsRaw.replace(/^\/\*[\s\S]*?\*\/\s*/, ""));

assert(layout.includes("GTM-TP33P29Q"), "GTM container was not migrated.");
assert(layout.includes("1176292317946919"), "Meta Pixel was not migrated.");
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
assert(waitlist.includes("data-shopify-captcha: 'true'"), "Shopify hCaptcha protection is disabled on the waitlist form.");
assert(
  waitlist.includes("shopify.online_store.spam_detection.disclaimer_html") &&
    !waitlist.includes('class="glydeCaptchaDisclaimer"'),
  "The Shopify-supported hCaptcha text disclosure is missing.",
);
assert(
  landingCss.includes(".waitlistForm > [data-spam-detection-disclaimer]") &&
    landingCss.includes("position: absolute") &&
    landingCss.includes("bottom: calc(100% + 6px)"),
  "The hCaptcha text disclosure is not isolated from the Figma form geometry.",
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
const themeHero = await read("theme/assets/glyde-v3-hero.css");
const themeSections = await read("theme/assets/glyde-v3-sections.css");
const themeOverrides = await read("theme/assets/glyde-v3-overrides.css");
assert(sourceHero === themeHero, "Shopify hero CSS diverges from the Next.js baseline.");
assert(sourceSections === themeSections, "Shopify section CSS diverges from the Next.js baseline.");
assert(
  sourceOverrides.replaceAll("/assets/v3/", "v3-").replaceAll("/theme/footer-form.svg", "footer-form.svg") === themeOverrides,
  "Shopify override CSS diverges from the URL-rewritten Next.js baseline.",
);

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Shopify v3 verification passed (${requiredAssets.size} active assets checked).`);
}
