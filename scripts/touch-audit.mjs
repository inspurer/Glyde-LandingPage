// Mobile audit driver: loads a page at a phone viewport with touch emulation
// on, dispatches real touch sequences through the Chrome DevTools Protocol, and
// prints a JSON report.
//
// This exists because neither probe.mjs nor the browser extension can emulate
// touch. A wheel that only responds to mouse drags looks perfectly fine to a
// mouse-driven probe — `touch-action` and `pointercancel` only enter the picture
// once the input is genuinely a finger, so the failure is invisible without it.
//
// Usage: node scripts/touch-audit.mjs <url> <probe-file> [width] [height] [dpr]

import { spawn } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const [url, exprFile, widthArg = "390", heightArg = "844", dprArg = "3"] =
  process.argv.slice(2);
const width = Number(widthArg);
const height = Number(heightArg);
const deviceScaleFactor = Number(dprArg);
const expression = readFileSync(exprFile, "utf8");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// Port 0 lets the OS pick, and the chosen port is read back out of the profile
// directory, so concurrent runs cannot land on each other's browser.
const profile = `/tmp/glyde-touch-profile-${process.pid}`;
rmSync(profile, { recursive: true, force: true });

const chrome = spawn(CHROME, [
  "--headless",
  "--disable-gpu",
  "--hide-scrollbars",
  "--remote-debugging-port=0",
  "--remote-allow-origins=*",
  `--window-size=${width},${height}`,
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore" });

async function endpoint() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const port = readFileSync(`${profile}/DevToolsActivePort`, "utf8").split("\n")[0].trim();
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
    resolver(message);
  }
});

const send = (method, params = {}, sessionId) =>
  new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

const { result: target } = await send("Target.createTarget", { url: "about:blank" });
const { result: attached } = await send("Target.attachToTarget", {
  targetId: target.targetId,
  flatten: true,
});
const sessionId = attached.sessionId;

await send("Page.enable", {}, sessionId);
await send("Runtime.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor,
  mobile: true,
  screenWidth: width,
  screenHeight: height,
}, sessionId);
// Without this the page still reports a coarse pointer but Blink routes input
// as a mouse, so `touch-action` never gets consulted.
await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, sessionId);
await send("Emulation.setEmitTouchEventsForMouse", { enabled: true, configuration: "mobile" }, sessionId);
await send("Network.setUserAgentOverride", {
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
    "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
}, sessionId);

await send("Page.navigate", { url }, sessionId);
await sleep(4500);

const evaluate = async (js) => {
  const response = await send("Runtime.evaluate", {
    expression: `(async () => JSON.stringify(await (async () => { ${js} })()))()`,
    returnByValue: true,
    awaitPromise: true,
  }, sessionId);
  const details = response.result?.exceptionDetails;
  if (details) throw new Error(JSON.stringify(details.exception ?? details, null, 2));
  return JSON.parse(response.result?.result?.value ?? "null");
};

// The emulation command reports success even when the page keeps the launch
// window's dimensions, which happens when several of these run at once. An
// unverified viewport is worse than no measurement — the report still looks
// plausible, just taken at the wrong width — so the size is asserted here and
// the override re-applied until the page agrees.
for (let attempt = 1; ; attempt += 1) {
  const seen = await evaluate("return { w: innerWidth, h: innerHeight }");
  if (seen.w === width && seen.h === height) break;
  if (attempt > 5) {
    throw new Error(
      `viewport stuck at ${seen.w}x${seen.h}, wanted ${width}x${height} — refusing to report`,
    );
  }
  await send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor, mobile: true,
    screenWidth: width, screenHeight: height,
  }, sessionId);
  await sleep(600);
}

/** Drags a finger from (x, y) by dy over `steps` moves, as a phone would. */
const touchDrag = async (x, y, dy, steps = 12) => {
  await send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1, radiusX: 12, radiusY: 12, force: 1 }],
  }, sessionId);
  for (let i = 1; i <= steps; i += 1) {
    await send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y + (dy * i) / steps, id: 1, radiusX: 12, radiusY: 12, force: 1 }],
    }, sessionId);
    await sleep(16);
  }
  await send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  }, sessionId);
  await sleep(450);
};

// The probe file receives these as globals.
globalThis.__evaluate = evaluate;
globalThis.__touchDrag = touchDrag;
globalThis.__send = send;
globalThis.__sessionId = sessionId;
globalThis.__viewport = { width, height };

const report = await new Function(
  "evaluate", "touchDrag", "send", "sessionId", "viewport", "sleep",
  `return (async () => { ${expression} })()`,
)(evaluate, touchDrag, send, sessionId, { width, height }, sleep);

console.log(JSON.stringify(report, null, 2));

ws.close();
chrome.kill();
// Best effort: Chrome may still be flushing the profile out as we exit, and a
// leftover temp directory is not worth failing a completed report over.
try { rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(0);
