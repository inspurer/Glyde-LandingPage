// Full-page screenshot at an exact viewport width, for checking a build against
// the Figma reference.
//
// Chrome's --screenshot flag only captures the viewport, and this page's hero is
// 100svh, so a taller window just makes a taller hero. Driving CDP instead gives
// both an exact device-metrics override and captureBeyondViewport, which is what
// actually produces a full-page image at 1920.
//
// Usage: node scripts/shoot.mjs <url> <out.png> [width] [height]

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const [url, out, widthArg = "1920", heightArg = "1080", scrollArg] = process.argv.slice(2);
// When a scroll offset is given, capture only the viewport at that position.
// captureBeyondViewport re-lays-out the page and has been seen to paint
// clipped, transformed tracks at the wrong offset, so it is not trustworthy
// for verifying a carousel.
const scrollY = scrollArg === undefined ? null : Number(scrollArg);
const width = Number(widthArg);
const height = Number(heightArg);

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9800 + Math.floor(Math.random() * 180);

const chrome = spawn(CHROME, [
  "--headless",
  "--disable-gpu",
  "--hide-scrollbars",
  `--remote-debugging-port=${port}`,
  "--remote-allow-origins=*",
  `--window-size=${width},${height}`,
  "--user-data-dir=/tmp/glyde-shoot-profile",
  "about:blank",
], { stdio: "ignore" });

async function endpoint() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      return (await res.json()).webSocketDebuggerUrl;
    } catch {
      await sleep(250);
    }
  }
  throw new Error("Chrome did not expose a debugging endpoint");
}

const ws = new WebSocket(await endpoint());
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

let nextId = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const resolver = pending.get(message.id);
  if (resolver) {
    pending.delete(message.id);
    resolver(message.result ?? {});
  }
});

const send = (method, params = {}, sessionId) =>
  new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });

await send("Page.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: 1,
  mobile: false,
}, sessionId);
// Stops the theme's `scroll-behavior: smooth` from animating anything mid-capture.
// See probe.mjs: MOTION=1 turns this off for anything gated on the query.
if (!process.env.MOTION) {
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  }, sessionId);
}

await send("Page.navigate", { url }, sessionId);
await sleep(4500);

if (scrollY !== null) {
  await send("Runtime.enable", {}, sessionId);
  await send("Runtime.evaluate", {
    expression: `window.scrollTo(0, ${scrollY})`,
  }, sessionId);
  await sleep(600);
}

const { data } = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: scrollY === null,
  fromSurface: true,
}, sessionId);

writeFileSync(out, Buffer.from(data, "base64"));
console.log(`${out} written at ${width}px wide`);

ws.close();
chrome.kill();
process.exit(0);
