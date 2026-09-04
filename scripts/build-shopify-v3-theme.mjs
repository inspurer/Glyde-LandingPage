import { access, cp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceTheme = join(root, "theme");
const outputTheme = join(root, "build", "shopify-theme-v3");
const liveThemeArgument = process.argv[2];

if (!liveThemeArgument) {
  throw new Error(
    "Pass the path of a freshly pulled live theme: " +
      "node scripts/build-shopify-v3-theme.mjs /tmp/<live-theme-baseline>",
  );
}

const liveTheme = resolve(liveThemeArgument);
const projectRoot = resolve(root);

if (liveTheme === projectRoot || liveTheme.startsWith(`${projectRoot}${sep}`)) {
  throw new Error(
    "The live baseline must be a freshly pulled directory outside the project tree.",
  );
}

if (liveTheme === resolve(outputTheme)) {
  throw new Error("The live baseline cannot be the clean-theme output directory.");
}

const entryFiles = [
  "layout/theme.liquid",
  "templates/index.json",
  "templates/page.deposit.json",
  "templates/page.deposit-v3.json",
  "sections/glyde-landing-v3.liquid",
  "sections/glyde-deposit-v3.liquid",
  "snippets/glyde-v3-waitlist.liquid",
  "snippets/glyde-structured-data.liquid",
  "assets/glyde-landing.css",
  "assets/glyde-v3-hero.css",
  "assets/glyde-v3-sections.css",
  "assets/glyde-v3-overrides.css",
  "assets/glyde-deposit-v3.css",
  "assets/glyde-landing-v3.js",
  "assets/glyde-deposit-v3.js",
  "assets/glyde-analytics-v3.js",
];

const allowedChangedLiveFiles = new Set([
  "layout/theme.liquid",
  "templates/index.json",
  "assets/glyde-landing.css",
  "assets/glyde-landing-v3.js",
  "assets/glyde-v3-overrides.css",
  "sections/glyde-landing-v3.liquid",
  "snippets/glyde-v3-waitlist.liquid",
]);

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function filesUnder(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await filesUnder(join(directory, entry.name), relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files.sort();
}

function collectAssetReferences(path, source, assets) {
  for (const match of source.matchAll(/['"]([^'"]+)['"]\s*\|\s*asset_url/g)) {
    assets.add(match[1]);
  }

  if (!path.endsWith(".css")) return;

  for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    const asset = match[1].trim().split(/[?#]/, 1)[0];
    if (asset && !/^(?:data:|https?:|\/\/|#|var\()/i.test(asset)) {
      assets.add(asset);
    }
  }
}

if (!(await exists(join(liveTheme, "layout", "theme.liquid")))) {
  throw new Error(
    `Live theme baseline is missing at ${liveTheme}. Pull the published theme before building.`,
  );
}

const outputPrefix = `${resolve(root, "build")}${sep}`;
if (!resolve(outputTheme).startsWith(outputPrefix)) {
  throw new Error("Refusing to clean a theme output outside the project build directory.");
}

await rm(outputTheme, { recursive: true, force: true });
await mkdir(dirname(outputTheme), { recursive: true });
await cp(liveTheme, outputTheme, { recursive: true, preserveTimestamps: true });

const requiredAssets = new Set();
for (const entryFile of entryFiles) {
  const sourcePath = join(sourceTheme, entryFile);
  if (!(await exists(sourcePath))) {
    throw new Error(`Missing Shopify v3 entry file: ${entryFile}`);
  }

  const source = await readFile(sourcePath, "utf8");
  collectAssetReferences(entryFile, source, requiredAssets);
}

for (const entryFile of entryFiles) {
  const destination = join(outputTheme, entryFile);
  await mkdir(dirname(destination), { recursive: true });
  await cp(join(sourceTheme, entryFile), destination, {
    preserveTimestamps: true,
  });
}

for (const asset of requiredAssets) {
  const sourcePath = join(sourceTheme, "assets", asset);
  if (!(await exists(sourcePath))) {
    throw new Error(`Missing referenced Shopify v3 asset: ${asset}`);
  }

  const destination = join(outputTheme, "assets", asset);
  await mkdir(dirname(destination), { recursive: true });
  await cp(sourcePath, destination, { preserveTimestamps: true });
}

for (const dotfile of [".shopifyignore", ".theme-check.yml"]) {
  const sourcePath = join(sourceTheme, dotfile);
  if (await exists(sourcePath)) {
    await cp(sourcePath, join(outputTheme, dotfile), {
      preserveTimestamps: true,
    });
  }
}

const liveFiles = await filesUnder(liveTheme);
const outputFiles = await filesUnder(outputTheme);
const liveFileSet = new Set(liveFiles);
const customFileSet = new Set([
  ...entryFiles,
  ...[...requiredAssets].map((asset) => join("assets", asset)),
  ".shopifyignore",
  ".theme-check.yml",
]);

for (const liveFile of liveFiles) {
  const outputPath = join(outputTheme, liveFile);
  if (!(await exists(outputPath))) {
    throw new Error(`Clean theme dropped a live file: ${liveFile}`);
  }

  if (!allowedChangedLiveFiles.has(liveFile)) {
    const [before, after] = await Promise.all([
      readFile(join(liveTheme, liveFile)),
      readFile(outputPath),
    ]);
    if (!before.equals(after)) {
      throw new Error(`Clean theme changed a protected live file: ${liveFile}`);
    }
  }
}

for (const outputFile of outputFiles) {
  if (!liveFileSet.has(outputFile) && !customFileSet.has(outputFile)) {
    throw new Error(`Unexpected file entered the clean theme: ${outputFile}`);
  }
}

console.log(
  `Built clean Shopify theme at ${relative(root, outputTheme)}: ` +
    `${liveFiles.length} live files, ${outputFiles.length - liveFiles.length} v3 additions, ` +
    `${requiredAssets.size} referenced assets.`,
);
