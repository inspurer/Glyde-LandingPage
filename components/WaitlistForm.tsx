"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { trackEvent } from "./Analytics";

// The Shopify form redirects to its own /pages/deposit. This deployment serves
// a port of that page at /deposit, so the flow stays on this host.
const DEPOSIT_PATH = "/deposit";

// Mirrors the Shopify theme's `{% form 'customer' %}` markup so the shared
// stylesheet lays both out identically. Only two children sit in the form's
// grid flow — the input and the button; the label, divider and honeypot are all
// absolutely positioned, which is what keeps the 88px pill from growing a
// second implicit row.
//
// Shopify submits natively and redirects to the deposit page. There is no
// Shopify storefront in front of this deployment, so the submit goes to our own
// /api/subscribe and this sends the browser to the same destination on success.

type FormState = "idle" | "loading" | "success" | "error";

const SUCCESS_MESSAGE = "You're on the list. Watch your inbox for GLYDE updates.";
const INVALID_MESSAGE = "Please enter a valid email address and try again.";
const MOBILE_VIEWPORT_QUERY = "(max-width: 900px)";
const KEYBOARD_SAFE_GAP = 20;
const KEYBOARD_SETTLE_DELAYS = [0, 80, 180, 320, 520] as const;
const KEYBOARD_CLOSE_CHECK_DELAYS = [0, 80, 180, 320, 520, 760] as const;
const KEYBOARD_RESTORE_SETTLE_DELAYS = [80, 220] as const;
const KEYBOARD_MIN_SHRINK = 80;
const KEYBOARD_RECOVERY_TOLERANCE = 64;
const POINTER_SNAPSHOT_TTL = 1_200;
const USER_SCROLL_SLOP = 12;

type KeyboardSession = {
  originScrollY: number;
  baselineViewportHeight: number;
  baselineViewportWidth: number;
  minViewportHeight: number;
  keyboardSeen: boolean;
  closing: boolean;
  closingStartedAt: number | null;
  restoreCommitted: boolean;
};

type PointerSnapshot = {
  scrollY: number;
  viewportHeight: number;
  viewportWidth: number;
  capturedAt: number;
};

export function WaitlistForm({
  location,
  placeholder = "Enter your email",
}: {
  location: "hero" | "footer";
  /** Both Figma waitlist states use the same prompt. */
  placeholder?: string;
}) {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigationPendingRef = useRef(false);

  const statusId = `${location}-form-status`;
  const hasErrors = state === "error";

  useEffect(() => {
    const form = formRef.current;
    const input = inputRef.current;

    if (!form || !input) return;

    const mobileViewport = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const visualViewport = window.visualViewport;
    const scheduledTimers = new Set<number>();
    let session: KeyboardSession | null = null;
    let pointerSnapshot: PointerSnapshot | null = null;
    let touchStart: { x: number; y: number } | null = null;
    let restingViewportHeight = visualViewport?.height ?? window.innerHeight;
    let correctionFrame = 0;
    let restoreFrame = 0;

    const viewportMetrics = () => ({
      height: window.visualViewport?.height ?? window.innerHeight,
      pageTop: window.visualViewport?.pageTop ?? window.scrollY,
      scale: window.visualViewport?.scale ?? 1,
      width: window.innerWidth,
    });

    const editableHasFocus = () =>
      document.activeElement instanceof HTMLElement &&
      document.activeElement.matches('input, textarea, select, [contenteditable="true"]');

    const scheduleTimer = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        scheduledTimers.delete(timer);
        callback();
      }, delay);
      scheduledTimers.add(timer);
    };

    const cancelScheduledWork = () => {
      cancelAnimationFrame(correctionFrame);
      cancelAnimationFrame(restoreFrame);
      correctionFrame = 0;
      restoreFrame = 0;
      scheduledTimers.forEach((timer) => window.clearTimeout(timer));
      scheduledTimers.clear();
    };

    const finishSession = () => {
      const finishedSession = session;
      cancelScheduledWork();
      session = null;
      pointerSnapshot = null;
      touchStart = null;

      const metrics = viewportMetrics();
      const keyboardIsStillReducingViewport =
        finishedSession?.keyboardSeen &&
        metrics.height <
          finishedSession.baselineViewportHeight - KEYBOARD_RECOVERY_TOLERANCE;

      // The second WaitlistForm receives the same viewport events. Never let
      // an inactive form learn the keyboard-reduced height as its next resting
      // baseline, or Android's focus-preserving close path becomes undetectable.
      if (
        metrics.scale <= 1.05 &&
        !editableHasFocus() &&
        !keyboardIsStillReducingViewport
      ) {
        restingViewportHeight = metrics.height;
      }
    };

    const keyboardThreshold = (currentSession: KeyboardSession) =>
      Math.max(KEYBOARD_MIN_SHRINK, currentSession.baselineViewportHeight * 0.15);

    const observeKeyboard = (currentSession: KeyboardSession) => {
      const { height } = viewportMetrics();
      currentSession.minViewportHeight = Math.min(currentSession.minViewportHeight, height);

      if (currentSession.baselineViewportHeight - height >= keyboardThreshold(currentSession)) {
        currentSession.keyboardSeen = true;
      }
    };

    const viewportHasRecovered = (currentSession: KeyboardSession) => {
      const { height } = viewportMetrics();
      const totalShrink = currentSession.baselineViewportHeight - currentSession.minViewportHeight;
      const recoveredFromMinimum = height - currentSession.minViewportHeight;

      return (
        height >= currentSession.baselineViewportHeight - KEYBOARD_RECOVERY_TOLERANCE ||
        (currentSession.keyboardSeen &&
          recoveredFromMinimum >= Math.max(120, totalShrink * 0.75))
      );
    };

    const keepFormAboveKeyboard = () => {
      correctionFrame = 0;
      const currentSession = session;

      if (
        !currentSession ||
        currentSession.closing ||
        document.activeElement !== input ||
        !mobileViewport.matches
      ) {
        return;
      }

      const viewport = window.visualViewport;
      observeKeyboard(currentSession);

      // Respect deliberate browser zoom instead of fighting the visitor's
      // accessibility choice. The normal keyboard case remains at scale 1.
      if (viewport && viewport.scale > 1.05) return;

      const pageTop = viewport?.pageTop ?? window.scrollY;
      const pageBottom = pageTop + (viewport?.height ?? window.innerHeight);
      let safeTop = pageTop + KEYBOARD_SAFE_GAP;
      const safeBottom = pageBottom - KEYBOARD_SAFE_GAP;
      const topNav = document.querySelector<HTMLElement>('.topNav[data-visible="true"]');

      if (topNav) {
        const navBottom = window.scrollY + topNav.getBoundingClientRect().bottom;
        safeTop = Math.max(safeTop, navBottom + KEYBOARD_SAFE_GAP);
      }

      const availableHeight = Math.max(0, safeBottom - safeTop);
      const formRect = form.getBoundingClientRect();
      const target = formRect.height <= availableHeight ? form : input;
      const targetRect = target.getBoundingClientRect();
      const targetTop = window.scrollY + targetRect.top;
      const targetBottom = window.scrollY + targetRect.bottom;
      let delta = 0;

      if (targetBottom > safeBottom) {
        delta = targetBottom - safeBottom;
      } else if (targetTop < safeTop) {
        delta = targetTop - safeTop;
      }

      if (Math.abs(delta) >= 1) {
        // Instant, minimal correction tracks the keyboard animation without
        // layering another animation on top or moving focus away from input.
        window.scrollBy({ top: delta, left: 0, behavior: "instant" });
      }
    };

    const scheduleCorrection = () => {
      cancelAnimationFrame(correctionFrame);
      correctionFrame = requestAnimationFrame(keepFormAboveKeyboard);
    };

    const beginSession = () => {
      cancelScheduledWork();

      const metrics = viewportMetrics();
      const snapshot =
        pointerSnapshot && performance.now() - pointerSnapshot.capturedAt <= POINTER_SNAPSHOT_TTL
          ? pointerSnapshot
          : null;
      const baselineViewportHeight = snapshot
        ? snapshot.viewportHeight
        : Math.max(metrics.height, restingViewportHeight);
      const scrollMarginTop = Number.parseFloat(getComputedStyle(input).scrollMarginTop) || 0;
      const anchorOriginScrollY =
        input.id === "hero-email" && window.location.hash === "#hero-email"
          ? window.scrollY + input.getBoundingClientRect().top - scrollMarginTop
          : window.scrollY;

      session = {
        // TopNav targets #hero-email through a smooth fragment scroll. Native
        // focus can fire before that motion finishes, so derive its final
        // scroll target from the input's document position instead of storing
        // a transient frame. Direct taps always use the pointer snapshot.
        originScrollY: snapshot ? snapshot.scrollY : Math.max(0, anchorOriginScrollY),
        baselineViewportHeight,
        baselineViewportWidth: snapshot ? snapshot.viewportWidth : metrics.width,
        minViewportHeight: metrics.height,
        keyboardSeen: false,
        closing: false,
        closingStartedAt: null,
        restoreCommitted: false,
      };
      pointerSnapshot = null;

      // iOS exposes its final VisualViewport over several keyboard animation
      // frames and occasionally omits one resize event. These bounded checks
      // cover that transition without keeping a polling loop alive.
      KEYBOARD_SETTLE_DELAYS.forEach((delay) => {
        scheduleTimer(scheduleCorrection, delay);
      });
    };

    const applyRestore = (currentSession: KeyboardSession) => {
      const focusedElement = document.activeElement;
      const anotherEditableHasFocus =
        focusedElement !== input &&
        focusedElement instanceof HTMLElement &&
        focusedElement.matches('input, textarea, select, [contenteditable="true"]');

      if (
        session !== currentSession ||
        navigationPendingRef.current ||
        window.innerWidth !== currentSession.baselineViewportWidth ||
        viewportMetrics().scale > 1.05 ||
        anotherEditableHasFocus
      ) {
        return;
      }

      const maximumScrollY = Math.max(
        0,
        Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) -
          window.innerHeight,
      );
      const targetScrollY = Math.min(
        maximumScrollY,
        Math.max(0, currentSession.originScrollY),
      );

      if (Math.abs(window.scrollY - targetScrollY) >= 1) {
        window.scrollTo({ top: targetScrollY, left: 0, behavior: "instant" });
      }
    };

    const commitRestore = (currentSession: KeyboardSession) => {
      if (currentSession.restoreCommitted) return;

      currentSession.restoreCommitted = true;
      cancelScheduledWork();

      // WebKit can publish one final viewport/scroll position after its resize
      // callback. Two paint frames plus two bounded rechecks keep the original
      // composition stable without creating an open-ended polling loop.
      restoreFrame = requestAnimationFrame(() => {
        restoreFrame = requestAnimationFrame(() => {
          applyRestore(currentSession);

          KEYBOARD_RESTORE_SETTLE_DELAYS.forEach((delay) => {
            scheduleTimer(() => applyRestore(currentSession), delay);
          });

          scheduleTimer(() => {
            if (session === currentSession) finishSession();
          }, KEYBOARD_RESTORE_SETTLE_DELAYS.at(-1)! + 40);
        });
      });
    };

    const checkRestore = (force = false) => {
      const currentSession = session;
      if (!currentSession?.closing || currentSession.restoreCommitted) return;

      if (window.innerWidth !== currentSession.baselineViewportWidth) {
        finishSession();
        return;
      }

      const focusedElement = document.activeElement;
      const anotherEditableHasFocus =
        focusedElement !== input &&
        focusedElement instanceof HTMLElement &&
        focusedElement.matches('input, textarea, select, [contenteditable="true"]');

      if (anotherEditableHasFocus) {
        finishSession();
        return;
      }

      if (navigationPendingRef.current) return;

      const metrics = viewportMetrics();
      if (metrics.scale > 1.05) {
        finishSession();
        return;
      }

      const closingElapsed = performance.now() - (currentSession.closingStartedAt ?? 0);
      const minimumClosingDelay = currentSession.keyboardSeen ? 80 : 320;

      if (
        !force &&
        (closingElapsed < minimumClosingDelay || !viewportHasRecovered(currentSession))
      ) {
        return;
      }

      commitRestore(currentSession);
    };

    const scheduleCloseChecks = () => {
      const currentSession = session;
      if (!currentSession?.closing || currentSession.restoreCommitted) return;

      KEYBOARD_CLOSE_CHECK_DELAYS.forEach((delay) => {
        scheduleTimer(() => checkRestore(delay === KEYBOARD_CLOSE_CHECK_DELAYS.at(-1)), delay);
      });
    };

    const beginClosing = () => {
      const currentSession = session;
      if (!currentSession || currentSession.closing) return;

      currentSession.closing = true;
      currentSession.closingStartedAt = performance.now();
      cancelScheduledWork();
      scheduleCloseChecks();
    };

    const handlePointerDown = () => {
      if (!mobileViewport.matches || (session && !session.closing)) return;

      const metrics = viewportMetrics();
      pointerSnapshot = {
        scrollY: session?.closing ? session.originScrollY : window.scrollY,
        viewportHeight: session?.closing
          ? Math.max(metrics.height, session.baselineViewportHeight)
          : metrics.height,
        viewportWidth: metrics.width,
        capturedAt: performance.now(),
      };

      // Android can leave the input focused after dismissing its keyboard. A
      // second tap will not emit focus again, so arm the next session here.
      if (document.activeElement === input) beginSession();
    };

    const handleFocus = () => {
      if (!mobileViewport.matches) return;
      if (!session || session.closing) beginSession();
    };

    const handleBlur = () => {
      beginClosing();
    };

    const handleViewportChange = () => {
      const currentSession = session;

      if (!currentSession) {
        const metrics = viewportMetrics();
        if (metrics.scale <= 1.05 && !editableHasFocus()) {
          restingViewportHeight = metrics.height;
        }
        return;
      }

      if (window.innerWidth !== currentSession.baselineViewportWidth) {
        finishSession();
        return;
      }

      observeKeyboard(currentSession);

      if (currentSession.closing) {
        checkRestore();
        return;
      }

      // Android's Back key and some swipe-to-dismiss paths keep the input
      // focused. The recovered visual viewport is the reliable close signal.
      if (currentSession.keyboardSeen && viewportHasRecovered(currentSession)) {
        beginClosing();
        return;
      }

      scheduleCorrection();
    };

    const cancelForUserScroll = () => {
      if (session) finishSession();
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (!session || event.touches.length !== 1) return;
      touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!session || !touchStart || event.touches.length !== 1) return;

      const deltaX = Math.abs(event.touches[0].clientX - touchStart.x);
      const deltaY = Math.abs(event.touches[0].clientY - touchStart.y);
      if (deltaY > USER_SCROLL_SLOP && deltaY >= deltaX) cancelForUserScroll();
    };

    const handlePageHide = () => {
      finishSession();
    };

    const handlePageShow = () => {
      // A Back navigation may revive this React tree from BFCache rather than
      // remount it, so never carry the previous successful navigation guard
      // into a new waitlist interaction.
      navigationPendingRef.current = false;
    };

    input.addEventListener("pointerdown", handlePointerDown, { passive: true });
    input.addEventListener("focus", handleFocus);
    input.addEventListener("blur", handleBlur);
    visualViewport?.addEventListener("resize", handleViewportChange);
    visualViewport?.addEventListener("scroll", handleViewportChange);
    window.addEventListener("resize", handleViewportChange, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("wheel", cancelForUserScroll, { passive: true });
    window.addEventListener("orientationchange", finishSession);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      finishSession();
      input.removeEventListener("pointerdown", handlePointerDown);
      input.removeEventListener("focus", handleFocus);
      input.removeEventListener("blur", handleBlur);
      visualViewport?.removeEventListener("resize", handleViewportChange);
      visualViewport?.removeEventListener("scroll", handleViewportChange);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("wheel", cancelForUserScroll);
      window.removeEventListener("orientationchange", finishSession);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (state === "loading") {
      return;
    }

    navigationPendingRef.current = false;

    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("contact[email]") ?? "");
    const website = String(data.get("website") ?? "");

    setState("loading");
    setMessage("");
    trackEvent("waitlist_submit", { label: location });

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website, source: location }),
      });

      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (response.ok && result?.ok) {
        navigationPendingRef.current = true;
        setState("success");
        setMessage(SUCCESS_MESSAGE);
        trackEvent("waitlist_success", { label: location });
        form.reset();
        // A full document navigation on purpose, not router.push(): /deposit
        // lives under a different root layout with its own stylesheet and
        // <body> class, and the unload also flushes the queued analytics beacon.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(DEPOSIT_PATH);
        return;
      }

      setState("error");
      navigationPendingRef.current = false;
      trackEvent("waitlist_error", { label: location, value: response.status });
      // Report what actually failed. Claiming the address was malformed when
      // the upstream is down would send people back to re-typing a valid email.
      setMessage(response.status === 422 ? INVALID_MESSAGE : result?.error || INVALID_MESSAGE);
    } catch {
      setState("error");
      navigationPendingRef.current = false;
      trackEvent("waitlist_error", { label: location, value: 0 });
      setMessage("Network error. Please check your connection and try again.");
    }
  }

  return (
    <>
      <form
        ref={formRef}
        id={`glyde-${location}-waitlist`}
        className="waitlistForm"
        onSubmit={handleSubmit}
        aria-busy={state === "loading"}
        noValidate={false}
      >
        <label className="srOnly" htmlFor={`${location}-email`}>
          Email address
        </label>
        <input
          ref={inputRef}
          id={`${location}-email`}
          name="contact[email]"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          enterKeyHint="send"
          spellCheck={false}
          placeholder={placeholder}
          required
          disabled={state === "loading"}
          aria-invalid={hasErrors}
          aria-describedby={statusId}
        />
        <input
          className="honeypot"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          defaultValue=""
        />
        <span aria-hidden="true" className="formDivider" />
        <button type="submit" disabled={state === "loading"}>
          Get Early Access
        </button>
      </form>
      <p
        id={statusId}
        className={`formStatus${hasErrors ? " formError" : ""}`}
        role={hasErrors ? "alert" : "status"}
        aria-live={hasErrors ? "assertive" : "polite"}
      >
        {message}
      </p>
    </>
  );
}
