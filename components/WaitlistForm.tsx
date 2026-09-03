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
const KEYBOARD_MIN_SHRINK = 40;
const KEYBOARD_RECOVERY_TOLERANCE = 8;
const KEYBOARD_CLOSE_RECOVERY_RATIO = 0.8;
const VIEWPORT_STABLE_EPSILON = 1;
const VIEWPORT_STABLE_FRAMES = 2;
const KEYBOARD_OPEN_TRACK_MS = 720;
const KEYBOARD_CLOSE_TRACK_MS = 1_600;
const POINTER_SNAPSHOT_TTL = 1_200;
const USER_SCROLL_SLOP = 12;
const KEYBOARD_PREDICTION_MIN = 240;
const KEYBOARD_PREDICTION_MAX = 420;

type Orientation = "portrait" | "landscape";

// Reusing the last measured keyboard inset lets a footer field create enough
// scroll room before the next keyboard animation starts. The fallback is only
// a spacer; positioning still follows the real VisualViewport geometry.
const keyboardInsetMemory: Record<Orientation, number> = {
  portrait: 0,
  landscape: 0,
};

type ViewportMetrics = {
  height: number;
  offsetTop: number;
  pageTop: number;
  scale: number;
  width: number;
};

type KeyboardSession = {
  originScrollY: number;
  originPageTop: number;
  baselineViewportHeight: number;
  baselineViewportOffsetTop: number;
  baselineViewportWidth: number;
  targetDocumentTop: number;
  targetHeight: number;
  preferredVisualTop: number;
  minViewportHeight: number;
  predictedKeyboardInset: number;
  orientation: Orientation;
  keyboardSeen: boolean;
  closing: boolean;
  trackingDeadline: number;
  stableFrames: number;
  lastViewportHeight: number;
  lastViewportOffsetTop: number;
  lastViewportPageTop: number;
  lastTargetPageTop: number;
  gestureActive: boolean;
  gestureMoved: boolean;
};

type PointerSnapshot = {
  scrollY: number;
  pageTop: number;
  offsetTop: number;
  viewportHeight: number;
  viewportWidth: number;
  targetDocumentTop: number;
  targetHeight: number;
  preferredVisualTop: number;
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
    let session: KeyboardSession | null = null;
    let pointerSnapshot: PointerSnapshot | null = null;
    let touchStart: { x: number; y: number } | null = null;
    let restingViewportHeight = visualViewport?.height ?? window.innerHeight;
    let restingViewportOffsetTop = visualViewport?.offsetTop ?? 0;
    let syncFrame = 0;
    let keyboardSpacer: HTMLDivElement | null = null;

    const viewportMetrics = (): ViewportMetrics => ({
      height: window.visualViewport?.height ?? window.innerHeight,
      offsetTop: window.visualViewport?.offsetTop ?? 0,
      pageTop: window.visualViewport?.pageTop ?? window.scrollY,
      scale: window.visualViewport?.scale ?? 1,
      width: window.innerWidth,
    });

    const editableHasFocus = () =>
      document.activeElement instanceof HTMLElement &&
      document.activeElement.matches('input, textarea, select, [contenteditable="true"]');

    const orientationFor = (width: number, height: number): Orientation =>
      width > height ? "landscape" : "portrait";

    const predictedKeyboardInset = (height: number, orientation: Orientation) => {
      const remembered = keyboardInsetMemory[orientation];
      if (remembered > 0) return remembered;

      return Math.min(
        KEYBOARD_PREDICTION_MAX,
        Math.max(KEYBOARD_PREDICTION_MIN, height * 0.42),
      );
    };

    const setSpacerHeight = (height: number) => {
      if (!keyboardSpacer) {
        keyboardSpacer = document.createElement("div");
        keyboardSpacer.dataset.glydeKeyboardSpacer = "";
        keyboardSpacer.setAttribute("aria-hidden", "true");
        keyboardSpacer.style.width = "1px";
        keyboardSpacer.style.overflowAnchor = "none";
        keyboardSpacer.style.pointerEvents = "none";
        keyboardSpacer.style.visibility = "hidden";
        document.body.append(keyboardSpacer);
      }

      keyboardSpacer.style.height = `${Math.max(0, Math.ceil(height))}px`;
    };

    const removeSpacer = () => {
      keyboardSpacer?.remove();
      keyboardSpacer = null;
    };

    const cancelScheduledWork = () => {
      cancelAnimationFrame(syncFrame);
      syncFrame = 0;
    };

    const finishSession = () => {
      const finishedSession = session;
      cancelScheduledWork();
      session = null;
      pointerSnapshot = null;
      touchStart = null;
      form.removeAttribute("data-keyboard-tracking");
      removeSpacer();

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
        restingViewportOffsetTop = metrics.offsetTop;
      }
    };

    const syncPosition = () => {
      syncFrame = 0;
      const currentSession = session;

      if (!currentSession || !mobileViewport.matches) return;

      let metrics = viewportMetrics();
      const now = performance.now();

      if (
        metrics.width !== currentSession.baselineViewportWidth ||
        navigationPendingRef.current
      ) {
        finishSession();
        return;
      }

      const focusedElement = document.activeElement;
      const anotherEditableHasFocus =
        focusedElement !== input &&
        focusedElement instanceof HTMLElement &&
        focusedElement.matches('input, textarea, select, [contenteditable="true"]');

      // Only one waitlist field may own viewport corrections. This also makes
      // switching directly between the hero and footer fields deterministic.
      if (anotherEditableHasFocus) {
        finishSession();
        return;
      }

      // Mobile fields are always at least 16px, so focus does not auto-zoom.
      // Any remaining scale change is an accessibility gesture and should not
      // be counter-scrolled.
      if (metrics.scale > 1.05) {
        finishSession();
        return;
      }

      const previousHeight = currentSession.lastViewportHeight;
      let positionAligned = !currentSession.keyboardSeen;
      const keyboardInset = Math.max(
        0,
        currentSession.baselineViewportHeight - metrics.height,
      );
      currentSession.minViewportHeight = Math.min(
        currentSession.minViewportHeight,
        metrics.height,
      );

      if (keyboardInset >= KEYBOARD_MIN_SHRINK) {
        currentSession.keyboardSeen = true;
        keyboardInsetMemory[currentSession.orientation] = Math.max(
          keyboardInsetMemory[currentSession.orientation],
          keyboardInset,
        );
      }

      // Android Back can close the keyboard while leaving the input focused.
      // A real viewport expansion enters the same close path as a blur event.
      const totalKeyboardShrink =
        currentSession.baselineViewportHeight - currentSession.minViewportHeight;
      const recoveredFromMinimum =
        metrics.height - currentSession.minViewportHeight;
      const keyboardIsAlmostClosed =
        recoveredFromMinimum >=
          Math.max(KEYBOARD_MIN_SHRINK, totalKeyboardShrink * KEYBOARD_CLOSE_RECOVERY_RATIO) ||
        keyboardInset <= KEYBOARD_RECOVERY_TOLERANCE;

      if (
        !currentSession.closing &&
        currentSession.keyboardSeen &&
        !currentSession.gestureActive &&
        keyboardIsAlmostClosed &&
        (metrics.height - previousHeight > KEYBOARD_RECOVERY_TOLERANCE ||
          keyboardInset <= KEYBOARD_RECOVERY_TOLERANCE)
      ) {
        currentSession.closing = true;
        currentSession.trackingDeadline = now + KEYBOARD_CLOSE_TRACK_MS;
        currentSession.stableFrames = 0;
      }

      const spacerInset = currentSession.keyboardSeen
        ? currentSession.closing
          ? keyboardInset
          : Math.max(keyboardInset, currentSession.predictedKeyboardInset)
        : currentSession.closing
          ? 0
          : currentSession.predictedKeyboardInset;
      setSpacerHeight(spacerInset + (spacerInset > 0 ? KEYBOARD_SAFE_GAP : 0));
      // Changing the footer spacer can clamp the layout scroll position. Read
      // VisualViewport again so the correction uses the post-layout pageTop.
      metrics = viewportMetrics();

      if (currentSession.keyboardSeen && !currentSession.gestureActive) {
        const topNav = document.querySelector<HTMLElement>('.topNav[data-visible="true"]');
        const safeTop = Math.max(
          KEYBOARD_SAFE_GAP,
          topNav
            ? topNav.getBoundingClientRect().bottom - metrics.offsetTop + KEYBOARD_SAFE_GAP
            : KEYBOARD_SAFE_GAP,
        );
        const safeBottom = Math.max(safeTop, metrics.height - KEYBOARD_SAFE_GAP);
        const maximumVisualTop = Math.max(
          safeTop,
          safeBottom - currentSession.targetHeight,
        );
        const desiredVisualTop = Math.min(
          maximumVisualTop,
          Math.max(safeTop, currentSession.preferredVisualTop),
        );
        const desiredPageTop = currentSession.targetDocumentTop - desiredVisualTop;
        const pageDelta = desiredPageTop - metrics.pageTop;

        currentSession.lastTargetPageTop = desiredPageTop;

        if (Math.abs(pageDelta) >= 0.75) {
          const maximumScrollY = Math.max(
            0,
            Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) -
              window.innerHeight,
          );
          const targetScrollY = Math.min(
            maximumScrollY,
            Math.max(0, window.scrollY + pageDelta),
          );

          if (Math.abs(window.scrollY - targetScrollY) >= 0.75) {
            window.scrollTo({ top: targetScrollY, left: 0, behavior: "instant" });
          }
        }

        metrics = viewportMetrics();
        positionAligned = Math.abs(metrics.pageTop - desiredPageTop) <= 1.25;
      }

      const viewportRecovered =
        metrics.height >=
          currentSession.baselineViewportHeight - KEYBOARD_RECOVERY_TOLERANCE &&
        Math.abs(metrics.offsetTop - currentSession.baselineViewportOffsetTop) <=
          KEYBOARD_RECOVERY_TOLERANCE;
      const viewportStable =
        Math.abs(metrics.height - currentSession.lastViewportHeight) <=
          VIEWPORT_STABLE_EPSILON &&
        Math.abs(metrics.offsetTop - currentSession.lastViewportOffsetTop) <=
          VIEWPORT_STABLE_EPSILON &&
        Math.abs(metrics.pageTop - currentSession.lastViewportPageTop) <=
          VIEWPORT_STABLE_EPSILON &&
        positionAligned;

      currentSession.lastViewportHeight = metrics.height;
      currentSession.lastViewportOffsetTop = metrics.offsetTop;
      currentSession.lastViewportPageTop = metrics.pageTop;

      if (currentSession.closing) {
        currentSession.stableFrames =
          viewportRecovered && viewportStable ? currentSession.stableFrames + 1 : 0;

        if (!currentSession.keyboardSeen || currentSession.stableFrames >= VIEWPORT_STABLE_FRAMES) {
          finishSession();
          return;
        }

        // Browser chrome can legitimately return to a slightly different
        // resting height than the focus snapshot. Never leave the temporary
        // scroll extent behind if that prevents the strict stability check.
        if (now >= currentSession.trackingDeadline) {
          const maximumScrollY = Math.max(
            0,
            Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) -
              window.innerHeight,
          );
          window.scrollTo({
            top: Math.min(
              maximumScrollY,
              Math.max(0, currentSession.originPageTop - metrics.offsetTop),
            ),
            left: 0,
            behavior: "instant",
          });
          finishSession();
          return;
        }
      }

      if (
        !currentSession.keyboardSeen &&
        !currentSession.closing &&
        now >= currentSession.trackingDeadline
      ) {
        setSpacerHeight(0);
      }

      // One bounded frame loop follows the native animation even on WebKit
      // versions that publish a resize or offset one frame late.
      if (now < currentSession.trackingDeadline) {
        syncFrame = requestAnimationFrame(syncPosition);
      }
    };

    const scheduleSync = () => {
      if (!syncFrame) syncFrame = requestAnimationFrame(syncPosition);
    };

    const beginSession = () => {
      cancelScheduledWork();

      const metrics = viewportMetrics();
      const currentRect = form.getBoundingClientRect();
      const snapshot =
        pointerSnapshot && performance.now() - pointerSnapshot.capturedAt <= POINTER_SNAPSHOT_TTL
          ? pointerSnapshot
          : null;
      const baselineViewportHeight = snapshot
        ? Math.max(snapshot.viewportHeight, restingViewportHeight)
        : Math.max(metrics.height, restingViewportHeight);
      const snapshotIsAtRest =
        snapshot &&
        snapshot.viewportHeight >= restingViewportHeight - KEYBOARD_RECOVERY_TOLERANCE;
      const baselineViewportOffsetTop = snapshotIsAtRest
        ? snapshot.offsetTop
        : restingViewportOffsetTop;
      const orientation = orientationFor(metrics.width, baselineViewportHeight);
      const currentTargetDocumentTop = window.scrollY + currentRect.top;
      const scrollMarginTop = Number.parseFloat(getComputedStyle(input).scrollMarginTop) || 0;
      const anchorOriginScrollY =
        input.id === "hero-email" && window.location.hash === "#hero-email"
          ? window.scrollY + input.getBoundingClientRect().top - scrollMarginTop
          : window.scrollY;
      const originScrollY = snapshot ? snapshot.scrollY : Math.max(0, anchorOriginScrollY);
      const originPageTop = snapshotIsAtRest
        ? snapshot.pageTop
        : originScrollY + baselineViewportOffsetTop;
      const targetDocumentTop = snapshot?.targetDocumentTop ?? currentTargetDocumentTop;
      const targetHeight = snapshot?.targetHeight ?? currentRect.height;
      const preferredVisualTop = snapshot
        ? snapshot.preferredVisualTop
        : targetDocumentTop - originPageTop;

      session = {
        originScrollY,
        originPageTop,
        baselineViewportHeight,
        baselineViewportOffsetTop,
        baselineViewportWidth: snapshot?.viewportWidth ?? metrics.width,
        targetDocumentTop,
        targetHeight,
        preferredVisualTop,
        minViewportHeight: metrics.height,
        predictedKeyboardInset: predictedKeyboardInset(baselineViewportHeight, orientation),
        orientation,
        keyboardSeen: false,
        closing: false,
        trackingDeadline: performance.now() + KEYBOARD_OPEN_TRACK_MS,
        stableFrames: 0,
        lastViewportHeight: metrics.height,
        lastViewportOffsetTop: metrics.offsetTop,
        lastViewportPageTop: metrics.pageTop,
        lastTargetPageTop: originPageTop,
        gestureActive: false,
        gestureMoved: false,
      };
      pointerSnapshot = null;
      form.dataset.keyboardTracking = "true";

      // Create real scroll extent before the OS performs its focus pan. This
      // is essential for the footer field, which otherwise hits maxScrollY.
      setSpacerHeight(session.predictedKeyboardInset + KEYBOARD_SAFE_GAP);
      scheduleSync();
    };

    const beginClosing = () => {
      const currentSession = session;
      if (!currentSession || currentSession.closing) return;

      currentSession.closing = true;
      currentSession.trackingDeadline = performance.now() + KEYBOARD_CLOSE_TRACK_MS;
      currentSession.stableFrames = 0;
      scheduleSync();
    };

    const handlePointerDown = () => {
      if (!mobileViewport.matches || (session && !session.closing)) return;

      const metrics = viewportMetrics();
      const rect = form.getBoundingClientRect();
      pointerSnapshot = {
        scrollY: session?.closing ? session.originScrollY : window.scrollY,
        pageTop: session?.closing ? session.originPageTop : metrics.pageTop,
        offsetTop: session?.closing
          ? session.baselineViewportOffsetTop
          : metrics.offsetTop,
        viewportHeight: session?.closing
          ? Math.max(metrics.height, session.baselineViewportHeight)
          : metrics.height,
        viewportWidth: metrics.width,
        targetDocumentTop: session?.closing
          ? session.targetDocumentTop
          : window.scrollY + rect.top,
        targetHeight: rect.height,
        preferredVisualTop: session?.closing
          ? session.preferredVisualTop
          : rect.top - metrics.offsetTop,
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
          restingViewportOffsetTop = metrics.offsetTop;
        }
        return;
      }

      if (window.innerWidth !== currentSession.baselineViewportWidth) {
        finishSession();
        return;
      }

      scheduleSync();
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (!session || event.touches.length !== 1) return;
      touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      session.gestureActive = true;
      session.gestureMoved = false;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!session || !touchStart || event.touches.length !== 1) return;

      const deltaX = Math.abs(event.touches[0].clientX - touchStart.x);
      const deltaY = Math.abs(event.touches[0].clientY - touchStart.y);
      if (deltaY > USER_SCROLL_SLOP && deltaY >= deltaX) session.gestureMoved = true;
    };

    const handleTouchEnd = () => {
      const currentSession = session;
      touchStart = null;
      if (!currentSession) return;

      currentSession.gestureActive = false;

      if (currentSession.gestureMoved) {
        // Keep deliberate page movement without destroying the session. The
        // closing path then settles at the visitor's new resting position.
        const metrics = viewportMetrics();
        const manualPageDelta = metrics.pageTop - currentSession.lastTargetPageTop;
        currentSession.originScrollY = Math.max(
          0,
          currentSession.originScrollY + manualPageDelta,
        );
        currentSession.originPageTop = Math.max(
          0,
          currentSession.originPageTop + manualPageDelta,
        );
        currentSession.preferredVisualTop =
          currentSession.targetDocumentTop - currentSession.originPageTop;
        currentSession.lastTargetPageTop = metrics.pageTop;
      }

      currentSession.gestureMoved = false;
      scheduleSync();
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
    window.addEventListener("scroll", handleViewportChange, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });
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
      window.removeEventListener("scroll", handleViewportChange);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
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
