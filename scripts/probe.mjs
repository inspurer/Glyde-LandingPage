// Evaluates an expression in a page at an exact viewport width and prints the
// JSON result. Companion to shoot.mjs — the browser extension cannot set the
// viewport, so measuring desktop layout needs its own driver.
//
// Usage: node scripts/probe.mjs <url> <js-expression-file> [width] [height]

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const [url, exprFile, widthArg = "1920", heightArg = "1080"] = process.argv.slice(2);
const width = Number(widthArg);
const height = Number(heightArg);
const expression = readFileSync(exprFile, "utf8");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9600 + Math.floor(Math.random() * 180);

const chrome = spawn(CHROME, [
  "--headless",
  "--disable-gpu",
  "--hide-scrollbars",
  `--remote-debugging-port=${port}`,
  "--remote-allow-origins=*",
  `--window-size=${width},${height}`,
  "--user-data-dir=/tmp/glyde-probe-profile",
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
  deviceScaleFactor: 1,
  mobile: false,
}, sessionId);
await send("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-reduced-motion", value: "reduce" }],
}, sessionId);

await send("Page.navigate", { url }, sessionId);
await sleep(4000);

const response = await send("Runtime.evaluate", {
  // async so probes can await animations and transitions
  expression: `(async () => JSON.stringify(await (async () => { ${expression} })(), null, 2))()`,
  returnByValue: true,
  awaitPromise: true,
}, sessionId);

const value = response.result?.result?.value;
const error = response.result?.exceptionDetails;
console.log(error ? JSON.stringify(error, null, 2) : value);

ws.close();
chrome.kill();
process.exit(0);
