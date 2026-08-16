"use client";

import { useEffect } from "react";

// First-party behaviour tracking for the preview deployment.
//
// What it deliberately does not do: no cookies, no third-party script, no
// fingerprinting, and the server stores neither IP nor user-agent. A visitor is
// identified only by a random id generated here and kept in this origin's own
// storage, so the data cannot follow anyone off this host. Referrers are reduced
// to a hostname server-side before they are written.
//
// Events are queued and flushed in batches. The page-hide flush uses
// sendBeacon because a normal fetch is cancelled when the document goes away,
// which is exactly when the engagement event is worth having.

const ENDPOINT = "/api/events";
const VISITOR_KEY = "glyde_vid";
const SESSION_KEY = "glyde_sid";
const SESSION_SEEN_KEY = "glyde_sid_seen";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_AT_QUEUE_LENGTH = 10;
const MAX_LABEL = 120;

type QueuedEvent = {
  name: string;
  path: string;
  label?: string;
  referrer?: string;
  device: string;
  value?: number;
  props?: Record<string, unknown>;
};

// Module scope so React's development double-invocation of effects cannot
// attach a second set of listeners or start a second flush timer.
let started = false;

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function readStored(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    // Safari private mode and storage-blocking extensions throw on access.
    return null;
  }
}

function writeStored(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    /* tracking is never worth breaking a page over */
  }
}

function getVisitorId(): string {
  const existing = readStored(localStorage, VISITOR_KEY);
  if (existing) return existing;

  const id = randomId();
  writeStored(localStorage, VISITOR_KEY, id);
  return id;
}

/**
 * Returns the current session id, starting a new one after 30 minutes of
 * inactivity so an abandoned tab reopened the next day is not counted as one
 * very long visit.
 */
function getSessionId(): { id: string; isNew: boolean } {
  const now = Date.now();
  const existing = readStored(sessionStorage, SESSION_KEY);
  const lastSeen = Number(readStored(sessionStorage, SESSION_SEEN_KEY) ?? 0);

  if (existing && Number.isFinite(lastSeen) && now - lastSeen < SESSION_IDLE_MS) {
    writeStored(sessionStorage, SESSION_SEEN_KEY, String(now));
    return { id: existing, isNew: false };
  }

  const id = randomId();
  writeStored(sessionStorage, SESSION_KEY, id);
  writeStored(sessionStorage, SESSION_SEEN_KEY, String(now));
  return { id, isNew: true };
}

function deviceClass(): string {
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1200) return "tablet";
  return "desktop";
}

function labelFor(element: Element): string {
  const explicit = element.getAttribute("data-track");
  if (explicit) return explicit.slice(0, MAX_LABEL);

  const aria = element.getAttribute("aria-label");
  if (aria) return aria.slice(0, MAX_LABEL);

  const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
  if (text) return text.slice(0, MAX_LABEL);

  return element.tagName.toLowerCase();
}

export function Analytics() {
  useEffect(() => {
    if (started) return;
    started = true;

    const visitorId = getVisitorId();
    const session = getSessionId();
    const device = deviceClass();
    const queue: QueuedEvent[] = [];
    const arrivedAt = Date.now();
    let flushTimer: ReturnType<typeof setInterval> | null = null;

    const send = (useBeacon: boolean) => {
      if (queue.length === 0) return;

      const body = JSON.stringify({
        visitorId,
        sessionId: session.id,
        events: queue.splice(0, queue.length),
      });

      try {
        if (useBeacon && navigator.sendBeacon) {
          navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
          return;
        }
        void fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => undefined);
      } catch {
        /* dropped analytics must not surface to the visitor */
      }
    };

    const track = (name: string, extra: Partial<QueuedEvent> = {}) => {
      queue.push({
        name,
        path: window.location.pathname,
        device,
        ...extra,
      });

      if (queue.length >= FLUSH_AT_QUEUE_LENGTH) {
        send(false);
      }
    };

    // --- page view -------------------------------------------------------
    if (session.isNew) {
      track("session_start", {
        referrer: document.referrer || undefined,
        props: {
          screen: `${window.screen.width}x${window.screen.height}`,
          language: navigator.language,
        },
      });
    }

    const params = new URLSearchParams(window.location.search);
    track("page_view", {
      referrer: document.referrer || undefined,
      label: document.title.slice(0, MAX_LABEL),
      props: {
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        ...(params.get("utm_source") ? { utm_source: params.get("utm_source") } : {}),
        ...(params.get("utm_medium") ? { utm_medium: params.get("utm_medium") } : {}),
        ...(params.get("utm_campaign") ? { utm_campaign: params.get("utm_campaign") } : {}),
      },
    });

    // --- clicks ----------------------------------------------------------
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const actionable = target.closest("a, button, summary, [data-track], [role='option']");
      if (!actionable) return;

      const label = labelFor(actionable);

      if (actionable instanceof HTMLAnchorElement && actionable.href) {
        let host = "";
        try {
          host = new URL(actionable.href).host;
        } catch {
          /* javascript: and mailto: links have no host */
        }

        if (host && host !== window.location.host) {
          track("outbound_click", { label, props: { href: actionable.href.slice(0, 200) } });
          return;
        }
      }

      track("click", {
        label,
        props: { tag: actionable.tagName.toLowerCase() },
      });
    };

    // --- scroll depth ----------------------------------------------------
    const milestones = [25, 50, 75, 100];
    const reached = new Set<number>();
    let lastScrollCheck = 0;

    // Throttled on a timestamp rather than requestAnimationFrame: rAF is paused
    // while the tab is in the background, so an rAF-gated handler would leave
    // its "pending" flag set forever if the visitor scrolled and then switched
    // tabs — killing scroll tracking for the rest of the page's life.
    const onScroll = () => {
      const now = Date.now();
      if (now - lastScrollCheck < 200) return;
      lastScrollCheck = now;

      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;

      const percent = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
      for (const milestone of milestones) {
        if (percent >= milestone && !reached.has(milestone)) {
          reached.add(milestone);
          track("scroll_depth", { label: `${milestone}%`, value: milestone });
        }
      }
    };

    // --- section visibility ---------------------------------------------
    const seenSections = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          const section = entry.target;
          const name =
            section.getAttribute("aria-labelledby") ||
            section.getAttribute("aria-label") ||
            section.className.split(/\s+/).filter(Boolean).pop() ||
            "section";

          if (seenSections.has(name)) continue;
          seenSections.add(name);
          track("section_view", { label: name.slice(0, MAX_LABEL) });
          observer.unobserve(section);
        }
      },
      { threshold: 0.4 },
    );

    document.querySelectorAll("section, [data-track-section]").forEach((section) => {
      observer.observe(section);
    });

    // --- engagement ------------------------------------------------------
    let hiddenAt: number | null = null;
    let hiddenTotal = 0;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        // The document may never come back, so bank what is queued now.
        send(true);
      } else if (hiddenAt !== null) {
        hiddenTotal += Date.now() - hiddenAt;
        hiddenAt = null;
      }
    };

    const onPageHide = () => {
      const visibleMs = Date.now() - arrivedAt - hiddenTotal - (hiddenAt ? Date.now() - hiddenAt : 0);
      track("engagement", {
        value: Math.max(0, Math.round(visibleMs / 1000)),
        props: { max_scroll: reached.size ? Math.max(...reached) : 0 },
      });
      send(true);
    };

    document.addEventListener("click", onClick, { capture: true, passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    flushTimer = setInterval(() => send(false), FLUSH_INTERVAL_MS);

    // Let other components report domain events (form submitted, etc.) without
    // importing anything from here.
    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { name?: string; label?: string; value?: number; props?: Record<string, unknown> }
        | undefined;
      if (!detail?.name) return;
      track(detail.name, { label: detail.label, value: detail.value, props: detail.props });
    };
    document.addEventListener("glyde:track", onCustom);

    onScroll();

    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("glyde:track", onCustom);
      observer.disconnect();
      if (flushTimer) clearInterval(flushTimer);
      send(true);
      started = false;
    };
  }, []);

  return null;
}

/** Reports a domain event from anywhere on the page. */
export function trackEvent(
  name: string,
  detail: { label?: string; value?: number; props?: Record<string, unknown> } = {},
): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent("glyde:track", { detail: { name, ...detail } }));
}
