// Copies the Shopify theme's landing-page stylesheet, script and fonts into
// `public/theme/` so the Next.js build serves byte-identical assets.
//
// The Shopify theme is the source of truth for the landing page's appearance
// and behaviour: it received the 2026-08-13 carousel, length-picker and mobile
// form rework that never reached the React implementation. Rather than
// re-implementing that logic in React idiom — which would reintroduce the bugs
// that rework fixed — the Next.js app renders the same DOM and loads these
// files unmodified.
//
// The stylesheet references its fonts with relative URLs (`Montserrat-Bold.ttf`),
// exactly as Shopify serves them from a flat asset directory, so the fonts must
// sit next to the stylesheet. Nothing here rewrites file contents.
//
// Run with `npm run sync:theme` after changing the theme.

import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "theme", "assets");
const target = join(root, "public", "theme");

const stylesheets = ["glyde-landing.css", "glyde-deposit.css"];
const scripts = ["glyde-landing.js"];

// Referenced from the ported markup rather than from CSS, so they cannot be
// discovered by scanning url() declarations.
const markupAssets = ["glyde-deposit-offer.png"];

// The stylesheets are loaded with a plain <link>, so nothing rewrites their
// relative url() references — fonts, button frames, arrows and chevrons all
// resolve as siblings of the stylesheet. Derive them from the CSS instead of
// listing them by hand, so a new reference in the theme cannot silently ship a
// page with a missing background.
const relativeAssets = new Set();

for (const stylesheet of stylesheets) {
  const css = await readFile(join(source, stylesheet), "utf8");
  for (const [, url] of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    const reference = url.trim();
    if (!/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(reference)) {
      relativeAssets.add(reference);
    }
  }
}

const files = [...stylesheets, ...scripts, ...markupAssets, ...relativeAssets];

await mkdir(target, { recursive: true });

for (const file of files) {
  await copyFile(join(source, file), join(target, file));
}

console.log(
  `Synced ${files.length} theme files to public/theme/ (${relativeAssets.size} referenced by CSS)`,
);
