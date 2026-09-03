(() => {
  "use strict";

  const runtimeKey = "__glydeAnalyticsV3Runtime";
  const existingRuntime = window[runtimeKey];

  // Shopify can evaluate theme assets more than once in the Theme Editor.
  // Keep the consent controller and the tracker singletons for this document.
  if (existingRuntime) {
    if (typeof existingRuntime.checkConsent === "function") {
      existingRuntime.checkConsent();
    }
    return;
  }
  if (window.__glydeAnalyticsV3Started) return;

  const visitorKey = "glyde_vid";
  const sessionKey = "glyde_sid";
  const sessionSeenKey = "glyde_sid_seen";
  const runtime = {
    initialized: false,
    apiStatus: "checking",
    analyticsAllowed: false,
    denialObserved: false,
    identifiersPurged: false,
    checkConsent: null,
    clearQueue: null,
    onConsentChanged: null,
  };
  window[runtimeKey] = runtime;

  function customerPrivacyApi() {
    try {
      const api = window.Shopify && window.Shopify.customerPrivacy;
      return api && typeof api.analyticsProcessingAllowed === "function"
        ? api
        : null;
    } catch {
      return null;
    }
  }

  function analyticsAllowedNow() {
    const api = customerPrivacyApi();
    if (!api) return false;
    try {
      const allowed = api.analyticsProcessingAllowed() === true;
      runtime.denialObserved = !allowed;
      if (!allowed) purgeAnalyticsIdentifiers();
      return allowed;
    } catch {
      // Missing, partial, throwing, and otherwise unknown APIs all fail closed.
      return false;
    }
  }

  function dataLayerProcessingAllowedNow() {
    if (!analyticsGateOpen()) return false;
    const api = customerPrivacyApi();
    if (!api || typeof api.marketingAllowed !== "function") return false;
    try {
      return api.marketingAllowed() === true;
    } catch {
      return false;
    }
  }

  function purgeAnalyticsIdentifiers() {
    if (runtime.identifiersPurged) return;
    [
      ["localStorage", visitorKey],
      ["sessionStorage", sessionKey],
      ["sessionStorage", sessionSeenKey],
    ].forEach(([areaName, key]) => {
      try {
        const storage = window[areaName];
        if (storage && typeof storage.removeItem === "function") {
          storage.removeItem(key);
        }
      } catch {
        // Storage can be unavailable in hardened browsing modes.
      }
    });
    runtime.identifiersPurged = true;
  }

  function setAnalyticsAllowed(allowed) {
    const changed = runtime.analyticsAllowed !== allowed;
    runtime.analyticsAllowed = allowed;

    if (!allowed && typeof runtime.clearQueue === "function") {
      runtime.clearQueue();
    }
    if (!allowed && runtime.denialObserved) purgeAnalyticsIdentifiers();
    if (changed && typeof runtime.onConsentChanged === "function") {
      runtime.onConsentChanged(allowed);
    }
  }

  function analyticsGateOpen() {
    const allowed = analyticsAllowedNow();
    if (!allowed) setAnalyticsAllowed(false);
    return allowed;
  }

  function checkConsent() {
    if (customerPrivacyApi()) runtime.apiStatus = "ready";

    const allowed = analyticsAllowedNow();
    setAnalyticsAllowed(allowed);
    if (allowed && !runtime.initialized) startAnalytics();
  }
  runtime.checkConsent = checkConsent;

  function settlePrivacyApiLoad(error) {
    if (customerPrivacyApi()) {
      runtime.apiStatus = "ready";
      checkConsent();
      return;
    }

    if (error) {
      runtime.apiStatus = "error";
      checkConsent();
      return;
    }

    // A successful loadFeatures callback should expose the API globally. If it
    // does not, keep failing closed: this is an inconsistent/unknown state, not
    // proof that the API is unavailable.
    runtime.apiStatus = "loading";
    window.setTimeout(() => {
      if (customerPrivacyApi()) runtime.apiStatus = "ready";
      checkConsent();
    }, 0);
  }

  function onConsentSignal(event) {
    if (customerPrivacyApi()) {
      runtime.apiStatus = "ready";
    } else {
      const detail = event && event.detail;
      if (
        detail &&
        (detail.analyticsAllowed === false ||
          detail.analyticsProcessingAllowed === false ||
          detail.analytics === false ||
          detail.analytics === "no")
      ) {
        runtime.denialObserved = true;
      }
      runtime.apiStatus = "loading";
    }
    checkConsent();
  }

  function onPrivacyApiLoaded() {
    runtime.apiStatus = customerPrivacyApi() ? "ready" : "loading";
    checkConsent();
  }

  // Bind before requesting the API so consent changes during loading cannot be
  // missed. The accepted event is retained for older consent-banner versions.
  document.addEventListener("visitorConsentCollected", onConsentSignal);
  document.addEventListener("trackingConsentAccepted", onConsentSignal);
  document.addEventListener(
    "shopifyCustomerPrivacyApiLoaded",
    onPrivacyApiLoaded,
  );
  document.addEventListener("customerPrivacyApiLoaded", onPrivacyApiLoaded);

  function waitForEmbeddedPrivacyApi() {
    let hasPartialApi = false;
    let privacyScripts = [];
    try {
      hasPartialApi = Boolean(window.Shopify && window.Shopify.customerPrivacy);
      privacyScripts = Array.from(document.scripts || []).filter((script) =>
        /(?:consent-tracking-api|privacy-banner)/i.test(script.src || ""),
      );
    } catch {
      // The gate remains closed if script discovery itself is unavailable.
    }

    if (!hasPartialApi && !privacyScripts.length) return false;

    runtime.apiStatus = "loading";
    checkConsent();

    const settleAfterDocumentLoad = () => {
      runtime.apiStatus = customerPrivacyApi() ? "ready" : "loading";
      checkConsent();
    };
    privacyScripts.forEach((script) => {
      script.addEventListener(
        "load",
        () => {
          if (customerPrivacyApi()) onPrivacyApiLoaded();
        },
        { once: true },
      );
    });

    if (document.readyState !== "complete") {
      window.addEventListener("load", settleAfterDocumentLoad, { once: true });
    }
    return true;
  }

  function initializePrivacyGate() {
    if (customerPrivacyApi()) {
      runtime.apiStatus = "ready";
      checkConsent();
      return;
    }

    let loadFeatures;
    try {
      loadFeatures = window.Shopify && window.Shopify.loadFeatures;
    } catch {
      loadFeatures = null;
    }

    if (typeof loadFeatures !== "function") {
      if (waitForEmbeddedPrivacyApi()) return;
      runtime.apiStatus = "missing";
      checkConsent();
      return;
    }

    runtime.apiStatus = "loading";
    checkConsent();
    try {
      loadFeatures.call(
        window.Shopify,
        [{ name: "consent-tracking-api", version: "0.1" }],
        settlePrivacyApiLoad,
      );
    } catch (error) {
      settlePrivacyApiLoad(error);
    }
  }

  initializePrivacyGate();

  function startAnalytics() {
    if (runtime.initialized || !analyticsGateOpen()) return;
    runtime.initialized = true;
    window.__glydeAnalyticsV3Started = true;

    const endpoint =
      window.GLYDE_ANALYTICS_ENDPOINT || "https://glydeclipper.online/api/events";
    const sessionIdleMs = 30 * 60 * 1000;
    const flushIntervalMs = 5000;
    const flushAtQueueLength = 10;
    const maxLabel = 120;
    const queue = [];
    const reached = new Set();
    const seenSections = new Set();
    const arrivedAt = Date.now();
    let hiddenAt = null;
    let hiddenTotal = 0;
    let lastScrollCheck = 0;

    runtime.clearQueue = () => {
      queue.length = 0;
    };

    function randomId() {
      try {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return btoa(String.fromCharCode(...bytes))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
      } catch {
        return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
      }
    }

    function readStored(storage, key) {
      if (!storage) return null;
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    }

    function writeStored(storage, key, value) {
      if (!storage || !analyticsGateOpen()) return;
      try {
        storage.setItem(key, value);
      } catch {
        // Analytics must never interfere with the storefront.
      }
    }

    function storageArea(name) {
      try {
        return window[name];
      } catch {
        return null;
      }
    }

    function visitorId() {
      const storage = storageArea("localStorage");
      const existing = readStored(storage, visitorKey);
      if (isAnalyticsId(existing)) return existing;
      const id = randomId();
      writeStored(storage, visitorKey, id);
      return id;
    }

    function session() {
      const now = Date.now();
      const storage = storageArea("sessionStorage");
      const existing = readStored(storage, sessionKey);
      const lastSeen = Number(readStored(storage, sessionSeenKey) || 0);
      if (
        isAnalyticsId(existing) &&
        Number.isFinite(lastSeen) &&
        now - lastSeen < sessionIdleMs
      ) {
        writeStored(storage, sessionSeenKey, String(now));
        return { id: existing, isNew: false };
      }

      const id = randomId();
      writeStored(storage, sessionKey, id);
      writeStored(storage, sessionSeenKey, String(now));
      return { id, isNew: true };
    }

    function deviceClass() {
      if (window.innerWidth < 768) return "mobile";
      if (window.innerWidth < 1200) return "tablet";
      return "desktop";
    }

    function isAnalyticsId(value) {
      return typeof value === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(value);
    }

    const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
    const ipv4Pattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
    const ipv6Pattern = /\b(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4}\b/i;
    const phonePattern = /(?:^|\D)(?:\+?\d[\s().-]*){8,}(?:$|\D)/;
    const uuidPattern =
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
    const allowedEventNames = new Set([
      "carousel_navigate",
      "click",
      "deposit_reserve",
      "engagement",
      "outbound_click",
      "page_view",
      "scroll_depth",
      "section_view",
      "session_start",
      "video_play",
      "waitlist_external_fallback",
      "waitlist_submit",
      "waitlist_success",
    ]);
    const eventPropertyKeys = {
      carousel_navigate: ["direction", "from", "method", "to"],
      click: ["location", "tag"],
      deposit_reserve: ["location", "tag"],
      engagement: ["max_scroll"],
      outbound_click: ["destination_host", "location", "tag"],
      page_view: ["viewport"],
      session_start: ["language", "screen"],
      video_play: ["id", "provider", "trigger"],
      waitlist_external_fallback: ["channel"],
      waitlist_submit: ["channel"],
      waitlist_success: ["channel", "shopify_status"],
    };

    function containsPersonalData(value) {
      const text = String(value);
      let decoded = text;
      const candidates = [text];
      for (let pass = 0; pass < 3; pass += 1) {
        try {
          const next = decodeURIComponent(decoded);
          if (next === decoded) break;
          decoded = next;
          candidates.push(decoded);
        } catch {
          break;
        }
      }
      candidates.push(decoded.replace(/&#(?:64|x40);/gi, "@"));
      return candidates.some(
        (candidate) =>
          emailPattern.test(candidate) ||
          ipv4Pattern.test(candidate) ||
          ipv6Pattern.test(candidate) ||
          phonePattern.test(candidate) ||
          uuidPattern.test(candidate),
      );
    }

    function safeText(value, limit = maxLabel) {
      if (value === undefined || value === null) return undefined;
      const text = String(value).replace(/\s+/g, " ").trim();
      if (!text) return undefined;
      if (containsPersonalData(text)) return "[redacted]";
      return text.slice(0, limit);
    }

    function safeEventName(value) {
      const text = safeText(value, 60);
      return text && allowedEventNames.has(text) ? text : "custom_event";
    }

    function safeProperties(value, eventName) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
      }
      const result = {};
      (eventPropertyKeys[eventName] || []).forEach((key) => {
        try {
          if (!Object.prototype.hasOwnProperty.call(value, key)) return;
          const item = value[key];
          if (typeof item === "string") {
            const text = safeText(item, 200);
            if (text !== undefined) result[key] = text;
          } else if (typeof item === "number") {
            if (Number.isFinite(item)) result[key] = item;
          } else if (typeof item === "boolean") {
            result[key] = item;
          }
        } catch {
          // Ignore throwing getters on untrusted custom-event detail objects.
        }
      });

      return Object.keys(result).length ? result : undefined;
    }

    function safeValue(value, eventName) {
      if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
      if (eventName === "scroll_depth") {
        return [25, 50, 75, 100].includes(value) ? value : undefined;
      }
      if (eventName === "waitlist_external_fallback") {
        return Number.isInteger(value) && value >= 0 && value <= 599
          ? value
          : undefined;
      }
      if (eventName === "carousel_navigate") {
        return Number.isInteger(value) && Math.abs(value) <= 1000 ? value : undefined;
      }
      if (eventName === "engagement") {
        return value >= 0 && value <= 7 * 24 * 60 * 60 ? value : undefined;
      }
      return undefined;
    }

    function safePath() {
      const path = String(window.location.pathname || "/");
      if (containsPersonalData(path)) return "/[redacted]";
      return path
        .replace(
          /\/(?:\d{8,}|[0-9a-f]{24,}|[A-Za-z0-9_-]{32,})(?=\/|$)/gi,
          "/[redacted]",
        )
        .slice(0, 240);
    }

    function safeReferrer() {
      if (!document.referrer) return undefined;
      try {
        const url = new URL(document.referrer);
        if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
        return url.origin;
      } catch {
        return undefined;
      }
    }

    function elementLabel(element) {
      const explicit = element.getAttribute("data-track");
      if (explicit) return safeText(explicit, maxLabel);

      // Visible text can contain an account name or an entered email address.
      // A semantic element label is sufficient for generic interaction counts.
      return element.tagName.toLowerCase();
    }

    let currentVisitorId = visitorId();
    let currentSession = session();
    const currentDevice = deviceClass();
    runtime.identifiersPurged = false;

    function rotateAnalyticsIds() {
      const now = Date.now();
      currentVisitorId = randomId();
      currentSession = { id: randomId(), isNew: true };
      writeStored(storageArea("localStorage"), visitorKey, currentVisitorId);
      writeStored(storageArea("sessionStorage"), sessionKey, currentSession.id);
      writeStored(storageArea("sessionStorage"), sessionSeenKey, String(now));
      runtime.identifiersPurged = false;
    }

    function mirrorToDataLayer(event) {
      // dataLayer consumers can include advertising tags. Mirror only when
      // both analytics and marketing purposes are explicitly permitted.
      if (!dataLayerProcessingAllowedNow()) return;
      try {
        window.dataLayer = window.dataLayer || [];
        if (typeof window.dataLayer.push !== "function") return;
        window.dataLayer.push({
          event: `glyde_${event.name}`,
          glyde_event_name: event.name,
          glyde_label: event.label || undefined,
          glyde_path: event.path,
          glyde_device: event.device,
          glyde_value: event.value,
          glyde_properties: event.props || undefined,
        });
      } catch {
        // A third-party dataLayer implementation must not break the storefront.
      }
    }

    function send(useBeacon) {
      if (!analyticsGateOpen()) {
        queue.length = 0;
        return;
      }
      if (!queue.length) return;
      const events = queue.splice(0, queue.length);
      const body = JSON.stringify({
        visitorId: currentVisitorId,
        sessionId: currentSession.id,
        events,
      });

      try {
        if (useBeacon && navigator.sendBeacon) {
          // text/plain is CORS-safelisted. The ingest endpoint deliberately
          // parses the body as JSON independent of its content type.
          const accepted = navigator.sendBeacon(
            endpoint,
            new Blob([body], { type: "text/plain;charset=UTF-8" }),
          );
          if (accepted) return;
        }

        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
          mode: "cors",
          credentials: "omit",
        }).catch(() => {});
      } catch {
        // Dropped telemetry must never surface to a visitor.
      }
    }

    function track(name, extra = {}) {
      if (!analyticsGateOpen()) return false;

      let event;
      try {
        event = {
          name: safeEventName(name),
          path: safePath(),
          device: currentDevice,
        };
        const label = safeText(extra.label, maxLabel);
        const referrer = ["page_view", "session_start"].includes(event.name)
          ? safeText(extra.referrer, 240)
          : undefined;
        const props = safeProperties(extra.props, event.name);
        const value = safeValue(extra.value, event.name);
        if (label !== undefined) event.label = label;
        if (referrer !== undefined) event.referrer = referrer;
        if (value !== undefined) event.value = value;
        if (props !== undefined) event.props = props;
      } catch {
        return false;
      }

      queue.push(event);
      mirrorToDataLayer(event);
      if (queue.length >= flushAtQueueLength) send(false);
      return true;
    }

    if (currentSession.isNew) {
      track("session_start", {
        referrer: safeReferrer(),
        props: {
          screen: `${window.screen.width}x${window.screen.height}`,
          language: navigator.language,
        },
      });
    }

    track("page_view", {
      referrer: safeReferrer(),
      props: {
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      },
    });

    function onClick(event) {
      if (!(event.target instanceof Element)) return;
      const actionable = event.target.closest(
        "a, button, summary, [data-track], [role='option']",
      );
      if (!actionable) return;

      const label = elementLabel(actionable);
      const explicitEvent = actionable.getAttribute("data-track");
      const location = actionable.getAttribute("data-track-location");
      const props = {
        tag: actionable.tagName.toLowerCase(),
        ...(location ? { location: safeText(location, maxLabel) } : {}),
      };

      if (explicitEvent) {
        const namedEvent = safeEventName(explicitEvent);
        if (namedEvent !== "custom_event") track(namedEvent, { label, props });
      }

      if (actionable instanceof HTMLAnchorElement && actionable.href) {
        try {
          const url = new URL(actionable.href);
          if (url.host && url.host !== window.location.host) {
            track("outbound_click", {
              label,
              props: { ...props, destination_host: url.hostname },
            });
            return;
          }
        } catch {
          // mailto: and other non-HTTP links do not require host comparison.
        }
      }

      track("click", { label, props });
    }

    function onScroll() {
      if (!analyticsGateOpen()) return;
      const now = Date.now();
      if (now - lastScrollCheck < 200) return;
      lastScrollCheck = now;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const percent = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
      [25, 50, 75, 100].forEach((milestone) => {
        if (percent < milestone || reached.has(milestone)) return;
        reached.add(milestone);
        track("scroll_depth", { label: `${milestone}%`, value: milestone });
      });
    }

    function sectionAnalyticsName(section) {
      return (
        section.getAttribute("data-track-section") ||
        Array.from(section.classList).pop() ||
        "section"
      );
    }

    let observer = null;
    if (typeof window.IntersectionObserver === "function") {
      observer = new window.IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting || !analyticsGateOpen()) return;
            const section = entry.target;
            const name = sectionAnalyticsName(section);
            if (seenSections.has(name)) return;
            if (!track("section_view", { label: safeText(name, maxLabel) })) return;
            seenSections.add(name);
            observer.unobserve(section);
          });
        },
        { threshold: 0.25 },
      );
    }

    function observeSections() {
      if (!observer) return;
      document.querySelectorAll("section, [data-track-section]").forEach((section) => {
        if (!seenSections.has(sectionAnalyticsName(section))) observer.observe(section);
      });
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden" || !analyticsAllowedNow()) {
        if (hiddenAt === null) hiddenAt = Date.now();
        send(true);
      } else if (hiddenAt !== null) {
        hiddenTotal += Date.now() - hiddenAt;
        hiddenAt = null;
      }
    }

    function onPageHide() {
      const hiddenNow = hiddenAt !== null ? Date.now() - hiddenAt : 0;
      const visibleMs = Date.now() - arrivedAt - hiddenTotal - hiddenNow;
      track("engagement", {
        value: Math.max(0, Math.round(visibleMs / 1000)),
        props: { max_scroll: reached.size ? Math.max(...reached) : 0 },
      });
      send(true);
    }

    function onCustom(event) {
      try {
        if (!event.detail || !event.detail.name) return;
        const name = safeEventName(event.detail.name);
        if (name === "custom_event") return;
        track(name, {
          label: event.detail.label,
          value: event.detail.value,
          props: event.detail.props,
        });
      } catch {
        // Custom analytics input is untrusted and must remain non-blocking.
      }
    }

    let behaviorCaptureActive = false;
    let flushIntervalId = null;
    const publicTrack = (name, detail = {}) => {
      const safeName = safeEventName(name);
      return safeName === "custom_event" ? false : track(safeName, detail);
    };

    function activateBehaviorCapture() {
      if (behaviorCaptureActive || !analyticsGateOpen()) return;
      behaviorCaptureActive = true;
      document.addEventListener("click", onClick, { capture: true, passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
      document.addEventListener("visibilitychange", onVisibilityChange);
      window.addEventListener("pagehide", onPageHide);
      document.addEventListener("glyde:track", onCustom);
      window.glydeTrack = publicTrack;
      flushIntervalId = window.setInterval(() => send(false), flushIntervalMs);
      observeSections();
      onScroll();
    }

    function deactivateBehaviorCapture() {
      if (!behaviorCaptureActive) return;
      behaviorCaptureActive = false;
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("glyde:track", onCustom);
      if (observer && typeof observer.disconnect === "function") observer.disconnect();
      if (flushIntervalId !== null && typeof window.clearInterval === "function") {
        window.clearInterval(flushIntervalId);
      }
      flushIntervalId = null;
      if (window.glydeTrack === publicTrack) window.glydeTrack = () => false;
    }

    runtime.onConsentChanged = (allowed) => {
      if (!allowed) {
        queue.length = 0;
        if (hiddenAt === null) hiddenAt = Date.now();
        deactivateBehaviorCapture();
        return;
      }

      if (runtime.identifiersPurged) rotateAnalyticsIds();
      if (document.visibilityState !== "hidden" && hiddenAt !== null) {
        hiddenTotal += Date.now() - hiddenAt;
        hiddenAt = null;
      }
      activateBehaviorCapture();
    };

    activateBehaviorCapture();
  }
})();
