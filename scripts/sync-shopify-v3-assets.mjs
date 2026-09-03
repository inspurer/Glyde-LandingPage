/**
 * Materialises the latest Next.js landing/deposit presentation assets in the
 * Shopify theme's flat `assets/` namespace.
 *
 * The source files remain the same files served by glydeclipper.online. Only
 * URL prefixes in the v3 override stylesheet are rewritten because Shopify
 * serves theme assets as CDN siblings instead of preserving public folders.
 */

import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const themeAssets = join(root, "theme", "assets");

await mkdir(themeAssets, { recursive: true });

const copied = [];

async function copy(relativeSource, outputName) {
  await copyFile(join(publicDir, relativeSource), join(themeAssets, outputName));
  copied.push(outputName);
}

async function copyDirectory(relativeDirectory, outputPrefix, filter = () => true) {
  const sourceDirectory = join(publicDir, relativeDirectory);
  const entries = await readdir(sourceDirectory, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !filter(entry.name)) continue;
    await copy(join(relativeDirectory, entry.name), `${outputPrefix}${entry.name}`);
  }
}

await copy("hero.css", "glyde-v3-hero.css");
await copy("sections.css", "glyde-v3-sections.css");

const landingOverrides = (await readFile(join(publicDir, "landing-v3.css"), "utf8"))
  .replaceAll("/assets/v3/", "v3-")
  .replaceAll("/theme/footer-form.svg", "footer-form.svg");
await writeFile(join(themeAssets, "glyde-v3-overrides.css"), landingOverrides);
copied.push("glyde-v3-overrides.css");

await copy("assets/hero/logo-wordmark.png", "hero-logo-wordmark.png");
await copyDirectory("assets/press", "press-");
await copyDirectory("assets/v3", "v3-");
await copyDirectory("assets/v2", "v2-", (name) => name.startsWith("result-"));
await copyDirectory("media/v3", "media-v3-");
await copy("media/hero-poster.jpg", "media-hero-poster.jpg");
await copy("media/hero.mp4", "media-hero.mp4");
await copy("media/hero.webm", "media-hero.webm");

await copyDirectory("assets/deposit", "glyde-deposit-v3-");
await copy("assets/figma/logo.png", "glyde-deposit-v3-logo.png");
await copy("assets/figma/star.svg", "glyde-deposit-v3-star.svg");
await copy("assets/figma/star-highlight.svg", "glyde-deposit-v3-star-highlight.svg");
await copy("assets/figma/faq-chevron.svg", "glyde-deposit-v3-faq-chevron.svg");
for (const avatar of ["avatar-1.png", "avatar-2.png", "avatar-3.png", "avatar-4.png"]) {
  await copy(`assets/v3/${avatar}`, `glyde-deposit-v3-${avatar}`);
}

console.log(`Synced ${copied.length} GLYDE v3 files into theme/assets.`);
