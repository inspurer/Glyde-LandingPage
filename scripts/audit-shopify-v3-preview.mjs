#!/usr/bin/env node

// Read-only interaction audit for a Shopify v3 preview or the published theme.
//
// The script never submits a form and never follows a reserve/checkout link.
// It drives an isolated headless Chrome profile and prints machine-readable
// evidence for every assertion.
//
// Usage:
//   node scripts/audit-shopify-v3-preview.mjs [theme-id|live] [origin] [suite]
//
// Suites: all (default), core, privacy, waitlist, seo.


import { spawn } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const themeId = process.argv[2] || "195039723803";
const origin = (process.argv[3] || "https://glydeclipper.com").replace(/\/$/, "");
const suite = process.argv[4] || "all";
const reportPath = process.argv[5] || null;
const liveMode = themeId === "live" || themeId === "published";
const previewQuery = liveMode ? "" : `?preview_theme_id=${encodeURIComponent(themeId)}`;
const homeUrl = `${origin}/${previewQuery}`;
const depositUrl = `${origin}/pages/deposit${previewQuery}`;
const productUrl = `${origin}/products/glyde-vip-prelaunch-reservation-online${previewQuery}`;
const chromeBinary = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const results = [];

function assertion(scope, name, passed, evidence) {
  results.push({ scope, name, passed: Boolean(passed), evidence });
}

function near(actual, expected, tolerance = 1) {
  return Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;
}

function increasing(values) {
  return values.every((value, index) => index === 0 || value > values[index - 1]);
}

class ChromePage {
  constructor(label, width, height, mobile = false) {
    this.label = label;
    this.width = width;
    this.height = height;
    this.mobile = mobile;
    this.port = 9400 + Math.floor(Math.random() * 350);
    this.profile = `/tmp/glyde-shopify-v3-audit-${process.pid}-${label}`;
    this.pending = new Map();
    this.nextId = 0;
    this.networkFailures = [];
    this.runtimeErrors = [];
  }

  async open(url, options = {}) {
    rmSync(this.profile, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
    this.chrome = spawn(
      chromeBinary,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        "--disable-default-apps",
        "--remote-allow-origins=*",
        `--remote-debugging-port=${this.port}`,
        `--window-size=${this.width},${this.height}`,
        `--user-data-dir=${this.profile}`,
        "about:blank",
      ],
      { stdio: "ignore" },
    );

    const endpoint = await this.waitForEndpoint();
    this.ws = new WebSocket(endpoint);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });

    this.ws.addEventListener("message", (event) => this.onMessage(event));
    const target = await this.send("Target.createTarget", { url: "about:blank" });
    const attached = await this.send("Target.attachToTarget", {
      targetId: target.targetId,
      flatten: true,
    });
    this.sessionId = attached.sessionId;

    await Promise.all([
      this.send("Page.enable"),
      this.send("Runtime.enable"),
      this.send("Network.enable"),
      this.send("Log.enable"),
    ]);
    if (options.initScript) {
      await this.send("Page.addScriptToEvaluateOnNewDocument", {
        source: options.initScript,
      });
    }
    await this.send("Emulation.setDeviceMetricsOverride", {
      width: this.width,
      height: this.height,
      screenWidth: this.width,
      screenHeight: this.height,
      deviceScaleFactor: 1,
      mobile: this.mobile,
    });
    await this.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
    });
    if (this.mobile) {
      await this.send("Emulation.setTouchEmulationEnabled", {
        enabled: true,
        maxTouchPoints: 5,
      });
    }

    await this.send("Page.navigate", { url });
    await this.waitForReady();
    await sleep(3500);
    if (options.dismissPrivacy === false) return;
    this.privacyBanner = await this.evaluate(`(async () => {
      const visible = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };
      const banner = document.querySelector('#shopify-pc__banner, .shopify-pc__banner__dialog, .shopify-pc__banner__body');
      if (!banner || !visible(banner)) return {present:false, dismissed:false};
      const buttons = Array.from(document.querySelectorAll('button')).filter((button) => {
        const inPrivacyUi = button.closest('[id^="shopify-pc"], [class*="shopify-pc"]');
        return inPrivacyUi && visible(button);
      });
      const decline =
        document.querySelector('#shopify-pc__banner__btn-decline, [data-decline-button]') ||
        buttons.find((button) => /decline|reject|no thanks|only necessary/i.test(button.textContent || '')) ||
        buttons.find((button) => /close/i.test(button.getAttribute('aria-label') || ''));
      decline?.click();
      await new Promise((resolve) => setTimeout(resolve, 450));
      return {
        present: true,
        dismissed: Boolean(decline) && !visible(banner),
        action: decline?.textContent?.replace(/\\s+/g, ' ').trim() || decline?.getAttribute('aria-label') || null,
      };
    })()`);
  }

  async waitForEndpoint() {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${this.port}/json/version`);
        const payload = await response.json();
        return payload.webSocketDebuggerUrl;
      } catch {
        await sleep(200);
      }
    }
    throw new Error(`Chrome debugging endpoint did not start for ${this.label}`);
  }

  onMessage(event) {
    const message = JSON.parse(event.data);
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result || {});
      return;
    }

    if (message.method === "Network.responseReceived") {
      const response = message.params?.response;
      if (response?.status >= 400) {
        this.networkFailures.push({ status: response.status, url: response.url });
      }
    }
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params?.exceptionDetails;
      this.runtimeErrors.push(
        details?.exception?.description || details?.text || "Unknown runtime exception",
      );
    }
    if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
      const entry = message.params.entry;
      this.runtimeErrors.push(`${entry.text}${entry.url ? ` (${entry.url})` : ""}`);
    }
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, sessionId: this.sessionId }));
    });
  }

  async waitForReady() {
    // Shopify preview requests occasionally take longer than ten seconds while
    // the CDN is regenerating an unpublished theme. Give navigation enough
    // time to settle so a transient preview delay is not reported as a UI
    // regression.
    for (let attempt = 0; attempt < 150; attempt += 1) {
      try {
        const state = await this.evaluate("document.readyState");
        if (state === "complete") return;
      } catch {
        // The execution context is briefly unavailable during navigation.
      }
      await sleep(200);
    }
    throw new Error(`Page did not finish loading for ${this.label}`);
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (response.exceptionDetails) {
      throw new Error(
        response.exceptionDetails.exception?.description ||
          response.exceptionDetails.text ||
          "Runtime evaluation failed",
      );
    }
    return response.result?.value;
  }

  async key(key, code = key) {
    await this.send("Input.dispatchKeyEvent", { type: "keyDown", key, code });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", key, code });
  }

  async mouseDrag(from, to, duration = 260) {
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: from.x,
      y: from.y,
    });
    await this.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      button: "left",
      buttons: 1,
      clickCount: 1,
      x: from.x,
      y: from.y,
    });
    const steps = 8;
    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;
      await this.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        button: "left",
        buttons: 1,
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
      });
      await sleep(duration / steps);
    }
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      button: "left",
      buttons: 0,
      clickCount: 1,
      x: to.x,
      y: to.y,
    });
  }

  async touchDrag(from, to, duration = 320) {
    const touch = (point) => [
      {
        x: point.x,
        y: point.y,
        radiusX: 2,
        radiusY: 2,
        force: 0.8,
        id: 1,
      },
    ];
    await this.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: touch(from),
    });
    const steps = 10;
    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;
      await this.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: touch({
          x: from.x + (to.x - from.x) * progress,
          y: from.y + (to.y - from.y) * progress,
        }),
      });
      await sleep(duration / steps);
    }
    await this.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }

  async wheel(point, deltaY, deltaX = 0) {
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: point.x,
      y: point.y,
    });
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: point.x,
      y: point.y,
      deltaX,
      deltaY,
    });
  }

  async close() {
    try {
      this.ws?.close();
    } catch {}
    try {
      this.chrome?.kill();
    } catch {}
    await sleep(100);
    try {
      rmSync(this.profile, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
    } catch {
      // Chrome may still be flushing its disposable profile. The OS temp
      // cleaner can safely remove it later; audit results must still print.
    }
  }
}

const cardStateExpression = `(() => {
  const section = document.querySelector('[data-glyde-results-v3]');
  const cards = Array.from(section?.querySelectorAll('.s2ResultCard') || []);
  const viewport = section?.querySelector('[data-glyde-results-viewport]');
  const rectOf = (element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  };
  return {
    found: Boolean(section && viewport),
    center: cards.find((card) => card.dataset.center === 'true')?.dataset.videoNumber || null,
    centerCount: cards.filter((card) => card.dataset.center === 'true').length,
    countText: section?.querySelector('.s2Count')?.textContent?.replace(/\\s+/g, ' ').trim(),
    reserveElements: section?.querySelectorAll('.topNavReserve, [data-glyde-reserve-link], a[href*="deposit"]').length || 0,
    viewport: viewport ? rectOf(viewport) : null,
    cards: cards.map((card) => ({
      number: card.dataset.videoNumber,
      slot: Number(card.dataset.slot),
      center: card.dataset.center === 'true',
      zIndex: Number.parseInt(getComputedStyle(card).zIndex, 10) || 0,
      rect: rectOf(card),
    })),
  };
})()`;

const manualStateExpression = `(() => {
  const section = document.querySelector('[data-glyde-manual]');
  const wheel = section?.querySelector('[data-glyde-manual-wheel]');
  const cursor = wheel?.querySelector('.s2WheelCursor');
  const selected = wheel?.querySelector('.s2WheelOption[aria-selected="true"]');
  const activeFrames = Array.from(section?.querySelectorAll('.s2ManualFrame[data-active="true"]') || []);
  const rect = wheel?.getBoundingClientRect();
  return {
    found: Boolean(section && wheel && cursor),
    index: Number(section?.dataset.index),
    value: section?.dataset.value || null,
    selectedValue: selected?.dataset.value || null,
    activeDescendant: wheel?.getAttribute('aria-activedescendant') || null,
    cursorTop: cursor ? Number.parseFloat(cursor.style.top) : null,
    activeFrames: activeFrames.map((frame) => ({
      value: frame.dataset.value,
      src: new URL(frame.currentSrc || frame.src, location.href).pathname,
      opacity: Number.parseFloat(getComputedStyle(frame).opacity),
      naturalWidth: frame.naturalWidth,
    })),
    wheelRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
    scrollY: window.scrollY,
  };
})()`;

async function auditResults(page, scope, includeTouch = false) {
  await page.evaluate(`document.querySelector('[data-glyde-results-v3]')?.scrollIntoView({block:'center'}); true`);
  await sleep(300);
  const initial = await page.evaluate(cardStateExpression);
  assertion(scope, "Results controller is present", initial.found, initial);
  if (!initial.found) return;

  const slots = initial.cards.map((card) => card.slot).sort((a, b) => a - b);
  const centerCard = initial.cards.find((card) => card.center);
  const sideCards = initial.cards.filter((card) => Math.abs(card.slot) === 1);
  const farCards = initial.cards.filter((card) => Math.abs(card.slot) === 2);
  assertion(
    scope,
    "Results has exactly one centre and all five unique slots",
    initial.centerCount === 1 && JSON.stringify(slots) === JSON.stringify([-2, -1, 0, 1, 2]),
    { center: initial.center, centerCount: initial.centerCount, slots },
  );
  assertion(
    scope,
    "Centre result card is the largest visual layer",
    centerCard &&
      sideCards.every((card) => centerCard.rect.width > card.rect.width) &&
      farCards.every((card) => sideCards[0].rect.width > card.rect.width) &&
      sideCards.every((card) => centerCard.zIndex > card.zIndex),
    initial.cards,
  );
  assertion(
    scope,
    "Results contains no Reserve button/link",
    initial.reserveElements === 0,
    { reserveElements: initial.reserveElements },
  );

  const initialCenter = initial.center;
  await page.evaluate(`document.querySelector('[data-glyde-results-viewport]')?.focus({preventScroll:true}); true`);
  const loopSequence = [];
  for (let index = 0; index < 5; index += 1) {
    await page.key("ArrowRight", "ArrowRight");
    await sleep(760);
    loopSequence.push((await page.evaluate(cardStateExpression)).center);
  }
  assertion(
    scope,
    "Results cycles through all five cards and wraps to its start",
    new Set(loopSequence).size === 5 && loopSequence.at(-1) === initialCenter,
    { initialCenter, loopSequence },
  );

  const beforeSwipe = await page.evaluate(cardStateExpression);
  const point = {
    x: Math.max(30, Math.min(page.width - 30, beforeSwipe.viewport.x + beforeSwipe.viewport.width / 2)),
    y: Math.max(90, Math.min(page.height - 90, beforeSwipe.viewport.y + beforeSwipe.viewport.height / 2)),
  };
  await page.evaluate(`(() => {
    window.__glydeAuditPointerTrace = [];
    ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach((type) => {
      document.addEventListener(type, (event) => {
        window.__glydeAuditPointerTrace.push({
          type,
          pointerType: event.pointerType,
          x: event.clientX,
          y: event.clientY,
          target: event.target?.className || event.target?.tagName || '',
        });
      }, {capture:true});
    });
    return true;
  })()`);
  if (includeTouch) {
    await page.touchDrag(point, {
      x: point.x - Math.min(180, page.width * 0.32),
      y: point.y,
    });
  } else {
    await page.mouseDrag(point, {
      x: point.x - Math.min(180, page.width * 0.32),
      y: point.y,
    });
  }
  await sleep(800);
  const afterSwipe = await page.evaluate(cardStateExpression);
  const pointerTrace = await page.evaluate(`window.__glydeAuditPointerTrace?.slice(-20) || []`);
  assertion(
    scope,
    "Results responds to a horizontal drag/swipe",
    afterSwipe.center && afterSwipe.center !== beforeSwipe.center && afterSwipe.centerCount === 1,
    {
      before: beforeSwipe.center,
      after: afterSwipe.center,
      centerCount: afterSwipe.centerCount,
      pointerTrace,
    },
  );
}

async function auditManual(page, scope, includeTouch) {
  await page.evaluate(`(() => {
    const section = document.querySelector('[data-glyde-manual]');
    section?.scrollIntoView({block:'center'});
    section?.querySelector('[data-glyde-manual-wheel]')?.focus({preventScroll:true});
    return true;
  })()`);
  await sleep(500);
  await page.key("Home", "Home");
  await sleep(500);

  const expectedValues = ["01", "04", "08", "12", "16", "20", "25"];
  const expectedAssets = [
    "v3-manual-25.webp",
    "v3-manual-20.webp",
    "v3-manual-16.webp",
    "v3-manual-12.webp",
    "v3-manual-08.webp",
    "v3-manual-04.webp",
    "v3-manual-01.webp",
  ];
  const expectedTops = [5.24535, 17.9357, 34.85618, 51.77665, 68.69712, 85.6176, 98.30795];
  const states = [];
  for (let index = 0; index < expectedValues.length; index += 1) {
    if (index > 0) {
      await page.key("ArrowDown", "ArrowDown");
      await sleep(460);
    }
    states.push(await page.evaluate(manualStateExpression));
  }

  const mappingPass = states.every((state, index) => {
    const frame = state.activeFrames[0];
    return (
      state.value === expectedValues[index] &&
      state.selectedValue === expectedValues[index] &&
      state.activeFrames.length === 1 &&
      frame?.src.endsWith(expectedAssets[index]) &&
      frame.opacity > 0.98 &&
      near(state.cursorTop, expectedTops[index], 0.12)
    );
  });
  assertion(
    scope,
    "Manual Mode maps all seven values to reversed image sequence and exact ruler ticks",
    mappingPass,
    states.map((state) => ({
      value: state.value,
      selectedValue: state.selectedValue,
      cursorTop: state.cursorTop,
      activeFrames: state.activeFrames,
    })),
  );
  assertion(
    scope,
    "Manual cursor moves monotonically through seven distinct tick positions",
    states.every((state) => Number.isFinite(state.cursorTop)) &&
      new Set(states.map((state) => state.cursorTop.toFixed(3))).size === 7 &&
      increasing(states.map((state) => state.cursorTop)),
    states.map((state) => ({ value: state.value, cursorTop: state.cursorTop })),
  );

  await page.evaluate(`(() => {
    const section = document.querySelector('[data-glyde-manual]');
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({top: Math.max(1, top - innerHeight * 0.25), behavior:'instant'});
    section.querySelector('[data-glyde-manual-wheel]')?.focus({preventScroll:true});
    return true;
  })()`);
  await page.key("End", "End");
  await sleep(250);
  const downBefore = await page.evaluate(manualStateExpression);
  const downPoint = {
    x: Math.max(20, Math.min(page.width - 20, downBefore.wheelRect.x + downBefore.wheelRect.width / 2)),
    y: Math.max(80, Math.min(page.height - 80, downBefore.wheelRect.y + downBefore.wheelRect.height / 2)),
  };
  await page.wheel(downPoint, 420);
  await sleep(350);
  const downAfter = await page.evaluate(manualStateExpression);
  assertion(
    scope,
    "Manual lower boundary releases outward wheel scrolling to the page",
    downAfter.value === "25" && downAfter.scrollY > downBefore.scrollY + 20,
    { before: downBefore.scrollY, after: downAfter.scrollY, value: downAfter.value },
  );

  await page.evaluate(`(() => {
    const section = document.querySelector('[data-glyde-manual]');
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({top: Math.max(300, top + innerHeight * 0.2), behavior:'instant'});
    section.querySelector('[data-glyde-manual-wheel]')?.focus({preventScroll:true});
    return true;
  })()`);
  await page.key("Home", "Home");
  await sleep(250);
  const upBefore = await page.evaluate(manualStateExpression);
  const upPoint = {
    x: Math.max(20, Math.min(page.width - 20, upBefore.wheelRect.x + upBefore.wheelRect.width / 2)),
    y: Math.max(80, Math.min(page.height - 80, upBefore.wheelRect.y + upBefore.wheelRect.height / 2)),
  };
  await page.wheel(upPoint, -420);
  await sleep(350);
  const upAfter = await page.evaluate(manualStateExpression);
  assertion(
    scope,
    "Manual upper boundary releases outward wheel scrolling to the page",
    upAfter.value === "01" && upAfter.scrollY < upBefore.scrollY - 20,
    { before: upBefore.scrollY, after: upAfter.scrollY, value: upAfter.value },
  );

  if (includeTouch) {
    await page.evaluate(`(() => {
      const section = document.querySelector('[data-glyde-manual]');
      section?.scrollIntoView({block:'center'});
      section?.querySelector('[data-glyde-manual-wheel]')?.focus({preventScroll:true});
      return true;
    })()`);
    await page.key("Home", "Home");
    await sleep(250);
    const beforeTouch = await page.evaluate(manualStateExpression);
    await page.evaluate(`(() => {
      window.__glydeAuditManualPointerTrace = [];
      ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach((type) => {
        document.addEventListener(type, (event) => {
          window.__glydeAuditManualPointerTrace.push({
            type,
            pointerType: event.pointerType,
            x: event.clientX,
            y: event.clientY,
            target: event.target?.className || event.target?.tagName || '',
          });
        }, {capture:true});
      });
      return true;
    })()`);
    const start = {
      x: beforeTouch.wheelRect.x + beforeTouch.wheelRect.width / 2,
      y: Math.min(page.height - 70, beforeTouch.wheelRect.y + beforeTouch.wheelRect.height * 0.72),
    };
    await page.touchDrag(start, { x: start.x, y: Math.max(75, start.y - 125) });
    await sleep(600);
    const afterTouch = await page.evaluate(manualStateExpression);
    const pointerTrace = await page.evaluate(`window.__glydeAuditManualPointerTrace?.slice(-24) || []`);
    assertion(
      scope,
      "Manual responds to a real mobile vertical touch drag",
      Number(afterTouch.index) > 0 && Number(afterTouch.index) <= 6,
      {
        before: beforeTouch.value,
        after: afterTouch.value,
        index: afterTouch.index,
        wheelRect: beforeTouch.wheelRect,
        pointerTrace,
      },
    );
  }
}

async function auditHomeFaq(page, scope) {
  await page.evaluate(`document.querySelector('[data-glyde-faq]')?.scrollIntoView({block:'start'}); true`);
  await sleep(250);
  const initial = await page.evaluate(`(() => {
    const items = Array.from(document.querySelectorAll('[data-glyde-faq-item]'));
    return {
      count: items.length,
      expanded: items.map((item) => item.querySelector('[data-glyde-faq-button]')?.getAttribute('aria-expanded')),
      hidden: items.map((item) => item.querySelector('[data-glyde-faq-answer]')?.getAttribute('aria-hidden')),
      pageHeight: document.scrollingElement.scrollHeight,
    };
  })()`);
  assertion(
    scope,
    "Homepage FAQ initially has all answers collapsed",
    initial.count === 7 && initial.expanded.every((value) => value === "false") && initial.hidden.every((value) => value === "true"),
    initial,
  );

  const opened = await page.evaluate(`(async () => {
    const items = Array.from(document.querySelectorAll('[data-glyde-faq-item]'));
    items[0]?.querySelector('[data-glyde-faq-button]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 650));
    const item = items[0];
    const answer = item?.querySelector('[data-glyde-faq-answer]');
    const paragraph = answer?.querySelector('p');
    const itemRect = item?.getBoundingClientRect();
    const answerRect = answer?.getBoundingClientRect();
    const paragraphRect = paragraph?.getBoundingClientRect();
    return {
      expanded: items.map((entry) => entry.querySelector('[data-glyde-faq-button]')?.getAttribute('aria-expanded')),
      answerHeight: answerRect?.height || 0,
      answerScrollHeight: answer?.scrollHeight || 0,
      itemBottom: itemRect?.bottom || 0,
      answerBottom: answerRect?.bottom || 0,
      paragraphBottom: paragraphRect?.bottom || 0,
      pageHeight: document.scrollingElement.scrollHeight,
    };
  })()`);
  assertion(
    scope,
    "Homepage FAQ opens one answer without clipping its content",
    opened.expanded.filter((value) => value === "true").length === 1 &&
      opened.answerHeight > 20 &&
      opened.answerBottom <= opened.itemBottom + 2 &&
      opened.paragraphBottom <= opened.itemBottom + 2,
    opened,
  );

  const accordion = await page.evaluate(`(async () => {
    const items = Array.from(document.querySelectorAll('[data-glyde-faq-item]'));
    items[1]?.querySelector('[data-glyde-faq-button]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 650));
    return items.map((item) => item.querySelector('[data-glyde-faq-button]')?.getAttribute('aria-expanded'));
  })()`);
  assertion(
    scope,
    "Homepage FAQ behaves as a single-open accordion",
    accordion[0] === "false" && accordion[1] === "true" && accordion.filter((value) => value === "true").length === 1,
    accordion,
  );
}

async function auditTopNav(page, scope) {
  await page.evaluate(`(() => {
    window.scrollTo({top:0, behavior:'instant'});
    return true;
  })()`);
  await sleep(180);
  const initial = await page.evaluate(`(() => {
    const nav = document.querySelector('[data-glyde-top-nav]');
    return { visible: nav?.dataset.visible, ariaHidden: nav?.getAttribute('aria-hidden') };
  })()`);
  await page.evaluate(`(() => {
    const hero = document.querySelector('.heroV2');
    window.scrollTo({top: hero.offsetTop + hero.offsetHeight + 120, behavior:'instant'});
    return true;
  })()`);
  await sleep(500);
  const visible = await page.evaluate(`(() => {
    const nav = document.querySelector('[data-glyde-top-nav]');
    const link = nav?.querySelector('.topNavReserve');
    return {
      visible: nav?.dataset.visible,
      ariaHidden: nav?.getAttribute('aria-hidden'),
      href: link?.getAttribute('href'),
      text: link?.textContent?.replace(/\\s+/g, ' ').trim(),
    };
  })()`);
  assertion(
    scope,
    "TopNav hides on the hero and appears after it",
    initial.visible === "false" && visible.visible === "true" && visible.ariaHidden === "false",
    { initial, visible },
  );
  assertion(
    scope,
    "TopNav reserve target is the hero email anchor",
    visible.href === "#hero-email",
    visible,
  );
  const clicked = await page.evaluate(`(async () => {
    document.querySelector('.topNavReserve')?.click();
    await new Promise((resolve) => setTimeout(resolve, 900));
    const input = document.querySelector('#hero-email');
    const rect = input?.getBoundingClientRect();
    return {
      hash: location.hash,
      scrollY: window.scrollY,
      inputRect: rect ? { top: rect.top, bottom: rect.bottom, height: rect.height } : null,
    };
  })()`);
  assertion(
    scope,
    "TopNav click returns to a visible hero email field",
    clicked.hash === "#hero-email" &&
      clicked.inputRect &&
      clicked.inputRect.bottom > 0 &&
      clicked.inputRect.top < page.height,
    clicked,
  );
}

async function auditWaitlistPresentation(page, scope) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const disclosureCount = await page.evaluate(
      "document.querySelectorAll('[data-glyde-waitlist] > [data-spam-detection-disclaimer]').length",
    );
    if (disclosureCount === 2) break;
    await sleep(100);
  }
  const state = await page.evaluate(`(() => {
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
    };
    const rectOf = (element) => {
      const rect = element?.getBoundingClientRect();
      return rect ? {top:rect.top,right:rect.right,bottom:rect.bottom,left:rect.left,width:rect.width,height:rect.height} : null;
    };
    const intersects = (a, b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
    const forms = Array.from(document.querySelectorAll('[data-glyde-waitlist]')).map((form) => {
      const input = form.querySelector('input[type="email"]');
      const button = form.querySelector('button[type="submit"]');
      const disclaimer = form.querySelector(':scope > [data-spam-detection-disclaimer], .glydeCaptchaDisclaimer');
      const formRect = rectOf(form);
      const inputRect = rectOf(input);
      const buttonRect = rectOf(button);
      const disclaimerRect = rectOf(disclaimer);
      const links = Array.from(disclaimer?.querySelectorAll('a') || []).map((link) => link.href);
      const hosts = Array.from(form.querySelectorAll(':scope > .h-captcha')).map((host) => ({
        rect: rectOf(host),
        position: getComputedStyle(host).position,
        visible: visible(host),
      }));
      const nearbySelector = form.dataset.glydeSource === 'hero'
        ? '.heroV2Title, .heroV2Lead, .heroV2Press'
        : '.finalCta .sectionHeading, .finalLead, .finalTrust, .socialLinks';
      const overlaps = Array.from(document.querySelectorAll(nearbySelector))
        .filter((element) => visible(element) && element !== disclaimer)
        .filter((element) => intersects(disclaimerRect, rectOf(element)))
        .map((element) => element.className || element.tagName);
      return {
        source: form.dataset.glydeSource,
        formRect,
        inputRect,
        buttonRect,
        disclaimerRect,
        disclaimerPosition: disclaimer ? getComputedStyle(disclaimer).position : null,
        disclaimerVisible: visible(disclaimer),
        disclaimerText: disclaimer?.textContent?.replace(/\\s+/g, ' ').trim() || null,
        links,
        inputType: input?.type || null,
        inputMode: input?.inputMode || null,
        inputLabelled: Boolean(input?.id && document.querySelector('label[for="' + CSS.escape(input.id) + '"]')),
        hosts,
        overlaps,
      };
    });

    const resultsRect = rectOf(document.querySelector('[data-glyde-results-viewport]'));
    const badgeCandidates = Array.from(document.querySelectorAll(
      '.grecaptcha-badge, .h-captcha-badge, iframe[src*="hcaptcha"], iframe[src*="recaptcha"]',
    )).map((element) => {
      const rect = rectOf(element);
      let fixed = getComputedStyle(element).position === 'fixed';
      for (let parent = element.parentElement; parent && !fixed; parent = parent.parentElement) {
        fixed = getComputedStyle(parent).position === 'fixed';
      }
      return {rect, fixed, visible: visible(element), overlapsResults: intersects(rect, resultsRect)};
    });
    return {forms, badgeCandidates};
  })()`);

  const disclosuresPass =
    state.forms.length === 2 &&
    state.forms.every((form) =>
      form.disclaimerVisible &&
      /protected by hcaptcha/i.test(form.disclaimerText || "") &&
      form.links.length >= 2 &&
      form.links.every((href) => {
        try { return new URL(href).hostname.endsWith("hcaptcha.com"); } catch { return false; }
      }),
    );
  assertion(
    scope,
    "Both waitlist forms expose Shopify's visible official hCaptcha disclosure",
    disclosuresPass,
    state.forms,
  );

  const geometryPass = state.forms.length === 2 && state.forms.every((form) => {
    if (!form.formRect || !form.inputRect || !form.buttonRect || !form.disclaimerRect) return false;
    const formCenter = form.formRect.top + form.formRect.height / 2;
    const inputCenter = form.inputRect.top + form.inputRect.height / 2;
    const buttonCenter = form.buttonRect.top + form.buttonRect.height / 2;
    const inlineControls = Math.abs(inputCenter - formCenter) <= 2 && Math.abs(buttonCenter - formCenter) <= 2;
    const stackedControls =
      form.source === "hero" &&
      form.inputRect.bottom <= form.buttonRect.top + 1 &&
      Math.abs(form.inputRect.left - form.formRect.left) <= 2 &&
      Math.abs(form.buttonRect.left - form.formRect.left) <= 2;
    const controlsInside =
      form.inputRect.top >= form.formRect.top - 1 &&
      form.inputRect.bottom <= form.formRect.bottom + 1 &&
      form.buttonRect.top >= form.formRect.top - 1 &&
      form.buttonRect.bottom <= form.formRect.bottom + 1;
    return form.formRect.height >= 40 &&
      form.inputRect.height >= 39 &&
      form.buttonRect.height >= 39 &&
      controlsInside &&
      (inlineControls || stackedControls) &&
      form.disclaimerPosition === "absolute" &&
      form.disclaimerRect.bottom <= form.formRect.top + 1 &&
      form.overlaps.length === 0 &&
      form.inputType === "email" &&
      form.inputMode === "email" &&
      form.inputLabelled;
  });
  assertion(
    scope,
    "hCaptcha disclosure preserves one-row waitlist geometry and accessible email controls",
    geometryPass,
    state.forms,
  );

  const hostPass = state.forms.every((form) => form.hosts.every((host) =>
    host.position === "absolute" &&
    (host.rect?.width || 0) <= 1 &&
    (host.rect?.height || 0) <= 1 &&
    host.visible === false,
  ));
  const blockingBadges = state.badgeCandidates.filter((badge) =>
    badge.visible && badge.fixed && badge.overlapsResults,
  );
  assertion(
    scope,
    "No injected CAPTCHA host or fixed badge covers the Results carousel",
    hostPass && blockingBadges.length === 0,
    { hosts: state.forms.map((form) => ({source:form.source, hosts:form.hosts})), badgeCandidates:state.badgeCandidates, blockingBadges },
  );
}

async function auditDeposit(page, scope) {
  const baseline = await page.evaluate(`(() => {
    const root = document.querySelector('[data-glyde-deposit-v3]');
    const galleries = Array.from(document.querySelectorAll('[data-glyde-deposit-gallery]'));
    const gallery = galleries.find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      const style = getComputedStyle(candidate);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    const reserve = Array.from(root?.querySelectorAll('a.glyde-deposit-v3__reserve-button') || []).find((link) => {
      const rect = link.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    return {
      found: Boolean(root && gallery),
      productHandle: root?.dataset.productHandle,
      variantId: root?.dataset.variantId,
      selected: Array.from(gallery?.querySelectorAll('[data-gallery-thumb]') || []).map((thumb) => thumb.getAttribute('aria-pressed')),
      reserveHref: reserve?.href || null,
      reserveText: reserve?.textContent?.replace(/\\s+/g, ' ').trim() || null,
      unavailable: Boolean(root?.querySelector('[aria-disabled="true"]')),
    };
  })()`);
  assertion(scope, "Deposit v3 gallery and validated product are present", baseline.found && baseline.productHandle === "glyde-vip-prelaunch-reservation-online" && baseline.variantId === "53870139375899", baseline);

  const checkout = baseline.reserveHref ? new URL(baseline.reserveHref) : null;
  const checkoutPass =
    checkout &&
    checkout.origin === origin &&
    checkout.pathname === "/cart/53870139375899:1" &&
    checkout.searchParams.get("attributes[glyde_source]") === "glydeclipper.com" &&
    checkout.searchParams.get("attributes[glyde_offer]") === "GLYDE-VIP-PRELAUNCH-DEPOSIT-5" &&
    checkout.searchParams.get("attributes[checkout_version]") === "shopify-theme-v3" &&
    checkout.searchParams.get("ref") === "glydeclipper-com";
  assertion(
    scope,
    "Deposit Reserve is a same-store $5 Shopify cart permalink",
    checkoutPass && /Reserve for \$5/i.test(baseline.reserveText || "") && !baseline.unavailable,
    baseline,
  );

  const galleryStates = [];
  for (let index = 0; index < 5; index += 1) {
    galleryStates.push(
      await page.evaluate(`(async () => {
        const galleries = Array.from(document.querySelectorAll('[data-glyde-deposit-gallery]'));
        const gallery = galleries.find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          const style = getComputedStyle(candidate);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        });
        gallery?.querySelector('[data-gallery-thumb="${index}"]')?.click();
        await new Promise((resolve) => setTimeout(resolve, 220));
        const media = Array.from(gallery?.querySelectorAll('[data-gallery-media]') || []);
        const selected = media.filter((entry) => !entry.hidden);
        return {
          index: ${index},
          pressed: Array.from(gallery?.querySelectorAll('[data-gallery-thumb]') || []).map((thumb) => thumb.getAttribute('aria-pressed')),
          selected: selected.map((entry) => ({
            tag: entry.tagName,
            src: new URL(entry.currentSrc || entry.src, location.href).pathname,
            hidden: entry.hidden,
          })),
        };
      })()`),
    );
  }
  const expectedTags = ["IMG", "VIDEO", "VIDEO", "VIDEO", "IMG"];
  const expectedAssets = [
    "glyde-deposit-v3-product-01.png",
    "glyde-deposit-v3-product-02-20260903.mp4",
    "glyde-deposit-v3-product-03.mp4",
    "glyde-deposit-v3-product-04-20260903.mp4",
    "glyde-deposit-v3-product-05-dual-angle.png",
  ];
  const galleryPass = galleryStates.every((state, index) => {
    const selected = state.selected[0];
    return (
      state.selected.length === 1 &&
      selected.tag === expectedTags[index] &&
      selected.src.endsWith(expectedAssets[index]) &&
      state.pressed.filter((value) => value === "true").length === 1 &&
      state.pressed[index] === "true"
    );
  });
  assertion(
    scope,
    "Deposit gallery uses images for 1/5 and videos for 2/3/4",
    galleryPass,
    galleryStates,
  );

  const faq = await page.evaluate(`(async () => {
    const lists = Array.from(document.querySelectorAll('[data-glyde-deposit-faq]'));
    const visibleList = lists.find((list) => {
      const rect = list.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(list).display !== 'none';
    });
    const items = Array.from(visibleList?.querySelectorAll('[data-faq-item]') || []);
    const initial = items.map((item) => item.querySelector('[data-faq-trigger]')?.getAttribute('aria-expanded'));
    items[1]?.querySelector('[data-faq-trigger]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 650));
    const item = items[1];
    const answer = item?.querySelector('[data-faq-answer]');
    const paragraph = answer?.querySelector('p');
    const itemRect = item?.getBoundingClientRect();
    const answerRect = answer?.getBoundingClientRect();
    const paragraphRect = paragraph?.getBoundingClientRect();
    return {
      count: items.length,
      initial,
      after: items.map((entry) => entry.querySelector('[data-faq-trigger]')?.getAttribute('aria-expanded')),
      answerHeight: answerRect?.height || 0,
      answerBottom: answerRect?.bottom || 0,
      paragraphBottom: paragraphRect?.bottom || 0,
      itemBottom: itemRect?.bottom || 0,
    };
  })()`);
  assertion(
    scope,
    "Deposit FAQ starts fully collapsed (including item 2)",
    faq.count === 7 && faq.initial.every((value) => value === "false"),
    faq,
  );
  assertion(
    scope,
    "Deposit FAQ opens one answer without clipping",
    faq.after[1] === "true" &&
      faq.after.filter((value) => value === "true").length === 1 &&
      faq.answerHeight > 20 &&
      faq.answerBottom <= faq.itemBottom + 2 &&
      faq.paragraphBottom <= faq.itemBottom + 2,
    faq,
  );
}

async function auditSeo(page, scope, kind) {
  const seo = await page.evaluate(`(() => {
    const content = (selector, attribute = 'content') =>
      document.querySelector(selector)?.getAttribute(attribute) || null;
    const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((script, index) => {
      try {
        return { index, value: JSON.parse(script.textContent || 'null'), error: null };
      } catch (error) {
        return { index, value: null, error: String(error) };
      }
    });
    const types = [];
    const faqCounts = [];
    const products = [];
    const visit = (value) => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (!value || typeof value !== 'object') return;
      const type = value['@type'];
      if (Array.isArray(type)) types.push(...type.map(String));
      else if (type) types.push(String(type));
      if (type === 'FAQPage') faqCounts.push(Array.isArray(value.mainEntity) ? value.mainEntity.length : 0);
      if (type === 'Product') {
        products.push({
          name: value.name || null,
          url: value.url || null,
          offers: value.offers || null,
          brand: typeof value.brand === 'object' ? value.brand?.name || null : value.brand || null,
        });
      }
      Object.values(value).forEach(visit);
    };
    jsonLd.forEach((entry) => visit(entry.value));
    return {
      htmlLang: document.documentElement.lang,
      title: document.title,
      descriptions: document.querySelectorAll('meta[name="description"]').length,
      description: content('meta[name="description"]'),
      canonicalCount: document.querySelectorAll('link[rel="canonical"]').length,
      canonical: content('link[rel="canonical"]', 'href'),
      robotsCount: document.querySelectorAll('meta[name="robots"]').length,
      robots: content('meta[name="robots"]'),
      ogUrl: content('meta[property="og:url"]'),
      ogType: content('meta[property="og:type"]'),
      ogTitle: content('meta[property="og:title"]'),
      ogDescription: content('meta[property="og:description"]'),
      ogImage: content('meta[property="og:image"]'),
      twitterCard: content('meta[name="twitter:card"]'),
      priceAmount: content('meta[property="product:price:amount"]'),
      priceCurrency: content('meta[property="product:price:currency"]'),
      jsonLdCount: jsonLd.length,
      jsonLdErrors: jsonLd.filter((entry) => entry.error).map((entry) => entry.error),
      jsonLdContainsPreviewParameter: jsonLd.some((entry) => JSON.stringify(entry.value).includes('preview_theme_id')),
      types,
      faqCounts,
      products,
      bodyClass: document.body.className,
      depositRoot: Boolean(document.querySelector('[data-glyde-deposit-v3]')),
    };
  })()`);

  const expectedTitle =
    kind === "home"
      ? "GLYDE Smart Auto-Fade Clipper | Perfect Fades at Home"
      : "Reserve GLYDE for $5 | VIP Prelaunch Offer";
  const expectedCanonical = kind === "home" ? `${origin}/` : `${origin}/pages/deposit`;
  const expectedRobots = kind === "product" ? "noindex,follow" : "index,follow";
  assertion(
    scope,
    `${kind} has one clean canonical, title, description, and robots directive`,
    seo.htmlLang.toLowerCase().startsWith("en") &&
      seo.title === expectedTitle &&
      seo.descriptions === 1 &&
      (seo.description?.length || 0) >= 80 &&
      (seo.description?.length || 0) <= 180 &&
      seo.canonicalCount === 1 &&
      seo.canonical === expectedCanonical &&
      seo.robotsCount === 1 &&
      seo.robots?.startsWith(expectedRobots) &&
      !seo.canonical.includes("preview_theme_id"),
    seo,
  );
  assertion(
    scope,
    `${kind} OpenGraph/Twitter metadata agrees with its canonical content`,
    seo.ogUrl === expectedCanonical &&
      seo.ogTitle === expectedTitle &&
      (seo.ogDescription?.length || 0) >= 50 &&
      /^https:\/\//.test(seo.ogImage || "") &&
      seo.twitterCard === "summary_large_image" &&
      (kind === "home" ? seo.ogType === "website" : seo.ogType === "product"),
    seo,
  );
  assertion(
    scope,
    `${kind} JSON-LD is valid, complete, and free of preview URLs`,
    seo.jsonLdCount > 0 &&
      seo.jsonLdErrors.length === 0 &&
      !seo.jsonLdContainsPreviewParameter &&
      seo.types.includes("Product") &&
      seo.types.includes("FAQPage") &&
      seo.faqCounts.some((count) => count === 7) &&
      (kind !== "home" ||
        ["Organization", "WebSite", "ImageObject", "WebPage"].every((type) => seo.types.includes(type))),
    seo,
  );

  if (kind === "deposit" || kind === "product") {
    assertion(
      scope,
      `${kind} exposes the $5 product metadata and Deposit v3 body`,
      Number.parseFloat(seo.priceAmount) === 5 &&
        /^[A-Z]{3}$/.test(seo.priceCurrency || "") &&
        seo.bodyClass.includes("glyde-deposit-v3-page") &&
        seo.depositRoot,
      seo,
    );
  }
}

async function auditDirectProduct(page, scope) {
  const state = await page.evaluate(`(() => {
    const root = document.querySelector('[data-glyde-deposit-v3]');
    const reserve = Array.from(root?.querySelectorAll('a.glyde-deposit-v3__reserve-button') || []).find((link) => {
      const rect = link.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    return {
      rootPresent: Boolean(root),
      productHandle: root?.dataset.productHandle || null,
      variantId: root?.dataset.variantId || null,
      reserveHref: reserve?.href || null,
      reserveText: reserve?.textContent?.replace(/\\s+/g, ' ').trim() || null,
      normalHeaderCount: document.querySelectorAll('.header-wrapper, shopify-section-header-sticky').length,
      normalFooterCount: document.querySelectorAll('.footer.color-scheme-1, .footer__content-top').length,
    };
  })()`);
  const target = state.reserveHref ? new URL(state.reserveHref) : null;
  assertion(
    scope,
    "Unlisted product URL renders Deposit v3 and the exact $5 variant permalink",
    state.rootPresent &&
      state.productHandle === "glyde-vip-prelaunch-reservation-online" &&
      state.variantId === "53870139375899" &&
      /Reserve for \$5/i.test(state.reserveText || "") &&
      target?.origin === origin &&
      target?.pathname === "/cart/53870139375899:1" &&
      target.searchParams.get("attributes[glyde_offer]") === "GLYDE-VIP-PRELAUNCH-DEPOSIT-5" &&
      target.searchParams.get("attributes[checkout_version]") === "shopify-theme-v3" &&
      state.normalHeaderCount === 0 &&
      state.normalFooterCount === 0,
    state,
  );
}

const consentMockInitScript = `(() => {
  // Page.addScriptToEvaluateOnNewDocument also runs inside later iframes. Keep
  // the fixture in the top document so a same-origin app iframe cannot reseed
  // identifiers after the storefront has correctly purged them.
  if (window.top !== window) return;
  const state = { analytics: false, marketing: false, preferences: false, saleOfData: false };
  const privacy = {
    analyticsProcessingAllowed: () => state.analytics === true,
    marketingAllowed: () => state.marketing === true,
    preferencesProcessingAllowed: () => state.preferences === true,
    saleOfDataAllowed: () => state.saleOfData === true,
    currentVisitorConsent: () => ({
      analytics: state.analytics ? 'yes' : 'no',
      marketing: state.marketing ? 'yes' : 'no',
      preferences: state.preferences ? 'yes' : 'no',
      sale_of_data: state.saleOfData ? 'yes' : 'no',
    }),
    getTrackingConsent: () => state.analytics ? 'yes' : 'no',
    shouldShowBanner: () => false,
    setTrackingConsent: (next, callback) => {
      state.analytics = next?.analytics === true;
      state.marketing = next?.marketing === true;
      state.preferences = next?.preferences === true;
      state.saleOfData = next?.sale_of_data === true;
      document.dispatchEvent(new CustomEvent('visitorConsentCollected', {
        detail: {
          analyticsAllowed: state.analytics,
          analyticsProcessingAllowed: state.analytics,
          analytics: state.analytics,
          marketingAllowed: state.marketing,
        },
      }));
      callback?.(null);
    },
  };

  const shopifyTarget = window.Shopify && typeof window.Shopify === 'object'
    ? window.Shopify
    : {};
  try {
    Object.defineProperty(shopifyTarget, 'customerPrivacy', {
      configurable: false,
      enumerable: true,
      get: () => privacy,
      set: () => {},
    });
  } catch {
    shopifyTarget.customerPrivacy = privacy;
  }
  window.Shopify = shopifyTarget;
  window.__glydeQaConsentState = state;
  window.__glydeQaSetConsent = (analytics, marketing) => {
    privacy.setTrackingConsent({
      analytics: analytics === true,
      marketing: marketing === true,
      preferences: analytics === true,
      sale_of_data: marketing === true,
    });
  };

  try {
    localStorage.setItem('glyde_vid', 'PRESEEDEDVISITOR1');
    sessionStorage.setItem('glyde_sid', 'PRESEEDEDSESSION1');
    sessionStorage.setItem('glyde_sid_seen', String(Date.now()));
  } catch {}

  window.__glydeQaAnalyticsRequests = [];
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || String(input);
    if (/^https:\\/\\/glydeclipper\\.online\\/api\\/events(?:[?#]|$)/.test(url)) {
      let payload = null;
      try { payload = JSON.parse(init.body || 'null'); } catch {}
      window.__glydeQaAnalyticsRequests.push({ channel: 'fetch', url, payload });
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }));
    }
    return originalFetch(input, init);
  };

  const originalBeacon = typeof navigator.sendBeacon === 'function'
    ? navigator.sendBeacon.bind(navigator)
    : null;
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: (url, data) => {
      if (/^https:\\/\\/glydeclipper\\.online\\/api\\/events(?:[?#]|$)/.test(String(url))) {
        window.__glydeQaAnalyticsRequests.push({ channel: 'beacon', url: String(url), payload: '[Blob]' });
        return true;
      }
      return originalBeacon ? originalBeacon(url, data) : false;
    },
  });
})()`;

function unavailableConsentMockInitScript(mode) {
  return `(() => {
    if (window.top !== window) return;
    const shopifyTarget = window.Shopify && typeof window.Shopify === 'object'
      ? window.Shopify
      : {};
    let delegatedLoadFeatures = null;
    const loadFeatures = function(features, callback) {
      const requestsConsent = Array.isArray(features) && features.some((feature) => feature?.name === 'consent-tracking-api');
      if (requestsConsent) {
        window.setTimeout(() => {
          if (${JSON.stringify(mode)} === 'error') callback?.(new Error('QA consent API load error'));
          else callback?.();
        }, 0);
        return;
      }
      if (typeof delegatedLoadFeatures === 'function') {
        return delegatedLoadFeatures.call(this, features, callback);
      }
      callback?.(new Error('QA unsupported feature'));
    };
    try {
      Object.defineProperty(shopifyTarget, 'customerPrivacy', {
        configurable: false,
        enumerable: true,
        get: () => undefined,
        set: () => {},
      });
      Object.defineProperty(shopifyTarget, 'loadFeatures', {
        configurable: false,
        enumerable: true,
        get: () => loadFeatures,
        set: (value) => { if (value !== loadFeatures) delegatedLoadFeatures = value; },
      });
    } catch {}
    window.Shopify = shopifyTarget;

    try {
      localStorage.removeItem('glyde_vid');
      sessionStorage.removeItem('glyde_sid');
      sessionStorage.removeItem('glyde_sid_seen');
    } catch {}

    window.__glydeQaAnalyticsRequests = [];
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const url = typeof input === 'string' ? input : input?.url || String(input);
      if (/^https:\\/\\/glydeclipper\\.online\\/api\\/events(?:[?#]|$)/.test(url)) {
        window.__glydeQaAnalyticsRequests.push({ channel: 'fetch', url });
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        }));
      }
      return originalFetch(input, init);
    };
    const originalBeacon = typeof navigator.sendBeacon === 'function'
      ? navigator.sendBeacon.bind(navigator)
      : null;
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: (url, data) => {
        if (/^https:\\/\\/glydeclipper\\.online\\/api\\/events(?:[?#]|$)/.test(String(url))) {
          window.__glydeQaAnalyticsRequests.push({ channel: 'beacon', url: String(url) });
          return true;
        }
        return originalBeacon ? originalBeacon(url, data) : false;
      },
    });
  })()`;
}

function waitlistMockInitScript(mode) {
  return `(() => {
    if (window.top !== window) return;
    window.__glydeQaWaitlistMode = ${JSON.stringify(mode)};
    window.__glydeQaWaitlistRequests = [];
    window.__glydeQaNativeFallbacks = [];
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const url = typeof input === 'string' ? input : input?.url || String(input);
      if (/^https:\\/\\/glydeclipper\\.online\\/api\\/subscribe(?:[?#]|$)/.test(url)) {
        let payload = null;
        try { payload = JSON.parse(init.body || 'null'); } catch {}
        window.__glydeQaWaitlistRequests.push({ url, method: init.method, payload });
        if (window.__glydeQaWaitlistMode === 'success') {
          return Promise.resolve(new Response(JSON.stringify({ ok: true, shopifyStatus: 'success' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }));
        }
        if (window.__glydeQaWaitlistMode === 'suppressed') {
          return Promise.resolve(new Response(JSON.stringify({ ok: true, shopifyStatus: 'suppressed' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }));
        }
        if (window.__glydeQaWaitlistMode === 'not-configured') {
          return Promise.resolve(new Response(JSON.stringify({ ok: true, shopifyStatus: 'not_configured' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }));
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: false }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }));
      }
      return originalFetch(input, init);
    };

    const captureNative = function(submitter) {
      const fields = Object.fromEntries(Array.from(new FormData(this).entries()));
      window.__glydeQaNativeFallbacks.push({
        action: this.action,
        method: this.method,
        submitter: submitter?.textContent?.replace(/\\s+/g, ' ').trim() || null,
        fields,
      });
    };
    Object.defineProperty(HTMLFormElement.prototype, 'requestSubmit', {
      configurable: true,
      writable: true,
      value: captureNative,
    });
    Object.defineProperty(HTMLFormElement.prototype, 'submit', {
      configurable: true,
      writable: true,
      value: function() { captureNative.call(this, null); },
    });
  })()`;
}

async function auditConsent(page, scope) {
  const denied = await page.evaluate(`(() => {
    const runtime = window.__glydeAnalyticsV3Runtime;
    return {
      runtimePresent: Boolean(runtime),
      apiStatus: runtime?.apiStatus,
      initialized: runtime?.initialized,
      analyticsAllowed: runtime?.analyticsAllowed,
      visitor: localStorage.getItem('glyde_vid'),
      session: sessionStorage.getItem('glyde_sid'),
      sessionSeen: sessionStorage.getItem('glyde_sid_seen'),
      trackerType: typeof window.glydeTrack,
      requests: window.__glydeQaAnalyticsRequests?.length || 0,
      glydeDataLayerEvents: (window.dataLayer || []).filter((event) => String(event?.event || '').startsWith('glyde_')).length,
    };
  })()`);
  await page.evaluate(`(() => {
    window.glydeTrack?.('click', { label: 'denied-qa', props: { location: 'qa', tag: 'button' } });
    document.querySelector('[data-glyde-results-viewport]')?.dispatchEvent(new MouseEvent('click', {bubbles:true}));
    return true;
  })()`);
  await sleep(5300);
  const deniedAfterAction = await page.evaluate(`({
    requests: window.__glydeQaAnalyticsRequests?.length || 0,
    visitor: localStorage.getItem('glyde_vid'),
    session: sessionStorage.getItem('glyde_sid'),
  })`);
  assertion(
    scope,
    "Denied consent fails closed, purges identifiers, and emits no analytics",
    denied.runtimePresent &&
      denied.apiStatus === "ready" &&
      denied.analyticsAllowed === false &&
      denied.visitor === null &&
      denied.session === null &&
      denied.sessionSeen === null &&
      deniedAfterAction.requests === 0 &&
      deniedAfterAction.visitor === null &&
      deniedAfterAction.session === null,
    { denied, deniedAfterAction },
  );

  await page.evaluate(`window.__glydeQaSetConsent(true, false); true`);
  await sleep(500);
  const analyticsOnlyBefore = await page.evaluate(`(() => {
    const tracked = window.glydeTrack?.('click', {
      label: 'analytics-only-qa',
      props: { location: 'qa', tag: 'button' },
    });
    return {
      tracked,
      runtime: {
        initialized: window.__glydeAnalyticsV3Runtime?.initialized,
        analyticsAllowed: window.__glydeAnalyticsV3Runtime?.analyticsAllowed,
      },
      visitor: localStorage.getItem('glyde_vid'),
      session: sessionStorage.getItem('glyde_sid'),
      glydeDataLayerEvents: (window.dataLayer || []).filter((event) => String(event?.event || '').startsWith('glyde_')).length,
    };
  })()`);
  await sleep(5300);
  const analyticsOnlyAfter = await page.evaluate(`({
    requests: window.__glydeQaAnalyticsRequests || [],
    glydeDataLayerEvents: (window.dataLayer || []).filter((event) => String(event?.event || '').startsWith('glyde_')).length,
  })`);
  assertion(
    scope,
    "Analytics-only consent enables first-party events but not marketing dataLayer mirroring",
    analyticsOnlyBefore.tracked === true &&
      analyticsOnlyBefore.runtime.initialized === true &&
      analyticsOnlyBefore.runtime.analyticsAllowed === true &&
      typeof analyticsOnlyBefore.visitor === "string" &&
      typeof analyticsOnlyBefore.session === "string" &&
      analyticsOnlyBefore.glydeDataLayerEvents === 0 &&
      analyticsOnlyAfter.requests.length > 0 &&
      analyticsOnlyAfter.glydeDataLayerEvents === 0,
    { analyticsOnlyBefore, analyticsOnlyAfter },
  );

  await page.evaluate(`(() => {
    window.__glydeQaSetConsent(true, true);
    return window.glydeTrack?.('click', {
      label: 'marketing-qa',
      props: { location: 'qa', tag: 'button' },
    });
  })()`);
  await sleep(250);
  const marketing = await page.evaluate(`({
    glydeDataLayerEvents: (window.dataLayer || []).filter((event) => String(event?.event || '').startsWith('glyde_')).map((event) => event.event),
  })`);
  assertion(
    scope,
    "Marketing consent gates dataLayer mirroring separately",
    marketing.glydeDataLayerEvents.includes("glyde_click"),
    marketing,
  );

  await page.evaluate(`window.__glydeQaSetConsent(false, false); true`);
  await sleep(400);
  const revokedBefore = await page.evaluate(`(() => ({
    runtime: {
      initialized: window.__glydeAnalyticsV3Runtime?.initialized,
      analyticsAllowed: window.__glydeAnalyticsV3Runtime?.analyticsAllowed,
    },
    visitor: localStorage.getItem('glyde_vid'),
    session: sessionStorage.getItem('glyde_sid'),
    sessionSeen: sessionStorage.getItem('glyde_sid_seen'),
    requestCount: window.__glydeQaAnalyticsRequests?.length || 0,
    tracked: window.glydeTrack?.('click', {
      label: 'revoked-qa',
      props: { location: 'qa', tag: 'button' },
    }),
  }))()`);
  await page.evaluate(`document.dispatchEvent(new CustomEvent('glyde:track', {detail:{name:'click', label:'revoked-custom-qa', props:{location:'qa',tag:'button'}}})); true`);
  await sleep(5300);
  const revokedAfter = await page.evaluate(`({
    requestCount: window.__glydeQaAnalyticsRequests?.length || 0,
    visitor: localStorage.getItem('glyde_vid'),
    session: sessionStorage.getItem('glyde_sid'),
    sessionSeen: sessionStorage.getItem('glyde_sid_seen'),
  })`);
  assertion(
    scope,
    "Consent revocation purges IDs, disables capture, and prevents later sends",
    revokedBefore.runtime.initialized === true &&
      revokedBefore.runtime.analyticsAllowed === false &&
      revokedBefore.visitor === null &&
      revokedBefore.session === null &&
      revokedBefore.sessionSeen === null &&
      revokedBefore.tracked === false &&
      revokedAfter.requestCount === revokedBefore.requestCount &&
      revokedAfter.visitor === null &&
      revokedAfter.session === null &&
      revokedAfter.sessionSeen === null,
    { revokedBefore, revokedAfter },
  );
}

async function auditUnavailableConsent(page, scope, mode) {
  const initial = await page.evaluate(`(() => {
    const runtime = window.__glydeAnalyticsV3Runtime;
    return {
      runtimePresent: Boolean(runtime),
      apiStatus: runtime?.apiStatus || null,
      initialized: runtime?.initialized,
      analyticsAllowed: runtime?.analyticsAllowed,
      visitor: localStorage.getItem('glyde_vid'),
      session: sessionStorage.getItem('glyde_sid'),
      sessionSeen: sessionStorage.getItem('glyde_sid_seen'),
      trackerType: typeof window.glydeTrack,
      requests: window.__glydeQaAnalyticsRequests?.length || 0,
      glydeDataLayerEvents: (window.dataLayer || []).filter((event) => String(event?.event || '').startsWith('glyde_')).length,
    };
  })()`);
  await page.evaluate(`(() => {
    window.glydeTrack?.('click', {label:'unavailable-consent-qa', props:{location:'qa',tag:'button'}});
    document.dispatchEvent(new CustomEvent('glyde:track', {detail:{name:'click', label:'unavailable-event-qa', props:{location:'qa',tag:'button'}}}));
    document.querySelector('[data-glyde-results-viewport]')?.dispatchEvent(new MouseEvent('click', {bubbles:true}));
    return true;
  })()`);
  await sleep(5300);
  const after = await page.evaluate(`({
    requests: window.__glydeQaAnalyticsRequests?.length || 0,
    visitor: localStorage.getItem('glyde_vid'),
    session: sessionStorage.getItem('glyde_sid'),
    sessionSeen: sessionStorage.getItem('glyde_sid_seen'),
    glydeDataLayerEvents: (window.dataLayer || []).filter((event) => String(event?.event || '').startsWith('glyde_')).length,
  })`);
  const statusPass = mode === "error"
    ? initial.apiStatus === "error"
    : ["loading", "missing"].includes(initial.apiStatus);
  assertion(
    scope,
    `Consent API ${mode} state fails closed with zero IDs and zero events`,
    initial.runtimePresent &&
      statusPass &&
      initial.initialized === false &&
      initial.analyticsAllowed === false &&
      initial.visitor === null &&
      initial.session === null &&
      initial.sessionSeen === null &&
      initial.requests === 0 &&
      initial.glydeDataLayerEvents === 0 &&
      after.requests === 0 &&
      after.visitor === null &&
      after.session === null &&
      after.sessionSeen === null &&
      after.glydeDataLayerEvents === 0,
    { initial, after },
  );
}

async function auditWaitlist(page, scope, expectedMode, source) {
  const testEmail = `qa-${expectedMode}-${source}@example.invalid`;
  const result = await page.evaluate(`(async () => {
    const form = document.querySelector('[data-glyde-waitlist][data-glyde-source="${source}"], #glyde-${source}-waitlist');
    const input = form?.querySelector('input[type="email"]');
    const button = form?.querySelector('button[type="submit"], input[type="submit"]');
    const returnTo = form?.querySelector('input[name="return_to"]');
    form.dataset.glydeReturnTo = '#qa-waitlist-success';
    if (returnTo) returnTo.value = '#qa-waitlist-success';
    input.value = ${JSON.stringify(testEmail)};
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
      submitter: button,
    });
    const dispatchResult = form.dispatchEvent(event);
    await new Promise((resolve) => setTimeout(resolve, 900));
    return {
      found: Boolean(form && input && button),
      dispatchResult,
      hash: location.hash,
      submitChannel: form?.dataset.submitChannel || null,
      submitting: form?.dataset.submitting || null,
      ariaBusy: form?.getAttribute('aria-busy'),
      requests: window.__glydeQaWaitlistRequests || [],
      nativeFallbacks: window.__glydeQaNativeFallbacks || [],
    };
  })()`);

  const request = result.requests[0];
  const commonPass =
    result.found &&
    result.dispatchResult === false &&
    result.requests.length === 1 &&
    request.method === "POST" &&
    request.payload?.email === testEmail &&
    request.payload?.source === source &&
    request.payload?.website === "";
  assertion(scope, "Waitlist sends one correctly shaped request to the mocked online API", commonPass, result);

  if (expectedMode === "success" || expectedMode === "suppressed") {
    assertion(
      scope,
      `Waitlist ${expectedMode} response uses the success navigation path without native fallback`,
      result.hash === "#qa-waitlist-success" &&
        result.nativeFallbacks.length === 0 &&
        result.submitChannel === "online-api",
      result,
    );
    return;
  }

  const fallback = result.nativeFallbacks[0];
  assertion(
    scope,
    `Waitlist ${expectedMode} response falls back once to Shopify's native customer form`,
    result.hash !== "#qa-waitlist-success" &&
      result.nativeFallbacks.length === 1 &&
      result.submitChannel === "shopify-fallback" &&
      fallback?.method?.toLowerCase() === "post" &&
      new URL(fallback?.action || origin, origin).pathname === "/contact" &&
      fallback?.fields?.["contact[email]"] === testEmail &&
      /newsletter/.test(fallback?.fields?.["contact[tags]"] || "") &&
      new RegExp(`source:${source}`).test(fallback?.fields?.["contact[tags]"] || ""),
    result,
  );
}

async function runPage(label, width, height, mobile, url, audit, openOptions = {}) {
  const page = new ChromePage(label, width, height, mobile);
  try {
    await page.open(url, openOptions);
    await audit(page, label);
    const meaningfulFailures = page.networkFailures.filter(({ url: failedUrl }) => {
      try {
        const failed = new URL(failedUrl);
        if (failed.pathname === "/sf_private_access_tokens") return false;
        return failed.hostname === new URL(origin).hostname || failed.hostname.endsWith("cdn.shopify.com");
      } catch {
        return true;
      }
    });
    // The consent-missing fixture deliberately invokes Shopify feature
    // callbacks without installing customerPrivacy. Clarity's app embed assumes
    // that impossible contract is valid and throws; record that injected-only
    // noise separately without hiding runtime errors from a real storefront.
    const injectedPrivacyMockErrors = page.runtimeErrors.filter(
      (message) =>
        label === "consent-missing" &&
        message.includes("Cannot read properties of undefined (reading 'marketingAllowed')"),
    );
    const transientConnectionErrors = page.runtimeErrors.filter(
      (message) =>
        message.includes("net::ERR_CONNECTION_CLOSED") ||
        message.includes("A network failure may have prevented the request from completing") ||
        message.includes("Clarity pixel failed to start... TypeError: Failed to fetch") ||
        message.includes("didn't load correctly") ||
        message.includes("Failed to fetch dynamically imported module"),
    );
    const meaningfulRuntimeErrors = page.runtimeErrors.filter(
      (message) =>
        !message.includes("https://shop.app/") &&
        !message.includes("/sf_private_access_tokens") &&
        !injectedPrivacyMockErrors.includes(message) &&
        !transientConnectionErrors.includes(message),
    );
    assertion(label, "No first-party/CDN HTTP failures", meaningfulFailures.length === 0, meaningfulFailures);
    assertion(label, "No uncaught page runtime errors", meaningfulRuntimeErrors.length === 0, {
      meaningful: meaningfulRuntimeErrors,
      ignoredShopifyPlatformNoise: page.runtimeErrors.filter(
        (message) =>
          message.includes("https://shop.app/") ||
          message.includes("/sf_private_access_tokens"),
      ),
      ignoredInjectedPrivacyMockNoise: injectedPrivacyMockErrors,
      ignoredTransientConnectionNoise: transientConnectionErrors,
    });
  } catch (error) {
    assertion(label, "Audit session completed", false, error.stack || String(error));
  } finally {
    await page.close();
  }
}

if (suite === "all" || suite === "core") {
  await runPage("home-desktop", 1920, 1080, false, homeUrl, async (page, scope) => {
    await auditResults(page, scope);
    await auditManual(page, scope, false);
    await auditHomeFaq(page, scope);
    await auditTopNav(page, scope);
    await auditWaitlistPresentation(page, scope);
  });

  await runPage("home-mobile", 390, 844, true, homeUrl, async (page, scope) => {
    await auditResults(page, scope, true);
    await auditManual(page, scope, true);
    await auditHomeFaq(page, scope);
    await auditTopNav(page, scope);
    await auditWaitlistPresentation(page, scope);
  });

  await runPage("deposit-desktop", 1920, 1080, false, depositUrl, auditDeposit);
  await runPage("deposit-mobile", 390, 844, true, depositUrl, auditDeposit);
}

if (suite === "all" || suite === "privacy") {
  await runPage(
    "consent-state-machine",
    1280,
    900,
    false,
    homeUrl,
    auditConsent,
    { initScript: consentMockInitScript, dismissPrivacy: false },
  );
  for (const mode of ["missing", "error"]) {
    await runPage(
      `consent-${mode}`,
      1280,
      900,
      false,
      homeUrl,
      (page, scope) => auditUnavailableConsent(page, scope, mode),
      { initScript: unavailableConsentMockInitScript(mode), dismissPrivacy: false },
    );
  }
}

if (suite === "all" || suite === "waitlist") {
  for (const { mode, source } of [
    { mode: "success", source: "hero" },
    { mode: "not-configured", source: "footer" },
    { mode: "server-error", source: "hero" },
  ]) {
    await runPage(
      `waitlist-${mode}`,
      1280,
      900,
      false,
      homeUrl,
      (page, scope) => auditWaitlist(page, scope, mode, source),
      { initScript: waitlistMockInitScript(mode) },
    );
  }
}

if (suite === "all" || suite === "seo") {
  await runPage("seo-home", 1280, 900, false, homeUrl, (page, scope) =>
    auditSeo(page, scope, "home"),
  );
  await runPage("seo-deposit", 1280, 900, false, depositUrl, (page, scope) =>
    auditSeo(page, scope, "deposit"),
  );
  await runPage("seo-direct-product", 1280, 900, false, productUrl, async (page, scope) => {
    await auditSeo(page, scope, "product");
    await auditDirectProduct(page, scope);
  });
}

const passed = results.filter((result) => result.passed).length;
const failed = results.length - passed;
const report = {
  target: { themeId, origin, suite, homeUrl, depositUrl, productUrl },
  summary: { passed, failed, total: results.length },
  results,
};
if (reportPath) {
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ target: report.target, summary: report.summary, reportPath }, null, 2));
} else {
  console.log(JSON.stringify(report, null, 2));
}

process.exitCode = failed === 0 ? 0 : 1;
