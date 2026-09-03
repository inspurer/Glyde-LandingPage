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

  const statusId = `${location}-form-status`;
  const hasErrors = state === "error";

  useEffect(() => {
    const form = formRef.current;
    const input = inputRef.current;

    if (!form || !input) return;

    const mobileViewport = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const visualViewport = window.visualViewport;
    const settleTimers = new Set<number>();
    let focused = false;
    let frame = 0;

    const cancelScheduledWork = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      settleTimers.forEach((timer) => window.clearTimeout(timer));
      settleTimers.clear();
    };

    const keepFormAboveKeyboard = () => {
      frame = 0;

      if (!focused || document.activeElement !== input || !mobileViewport.matches) return;

      const viewport = window.visualViewport;

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
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(keepFormAboveKeyboard);
    };

    const handleFocus = () => {
      focused = true;
      cancelScheduledWork();

      // iOS exposes its final VisualViewport over several keyboard animation
      // frames and occasionally omits one resize event. These bounded checks
      // cover that transition without keeping a polling loop alive.
      KEYBOARD_SETTLE_DELAYS.forEach((delay) => {
        const timer = window.setTimeout(() => {
          settleTimers.delete(timer);
          scheduleCorrection();
        }, delay);
        settleTimers.add(timer);
      });
    };

    const handleBlur = () => {
      focused = false;
      cancelScheduledWork();
    };

    input.addEventListener("focus", handleFocus);
    input.addEventListener("blur", handleBlur);
    visualViewport?.addEventListener("resize", scheduleCorrection);
    visualViewport?.addEventListener("scroll", scheduleCorrection);
    window.addEventListener("resize", scheduleCorrection, { passive: true });

    return () => {
      focused = false;
      cancelScheduledWork();
      input.removeEventListener("focus", handleFocus);
      input.removeEventListener("blur", handleBlur);
      visualViewport?.removeEventListener("resize", scheduleCorrection);
      visualViewport?.removeEventListener("scroll", scheduleCorrection);
      window.removeEventListener("resize", scheduleCorrection);
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (state === "loading") {
      return;
    }

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
      trackEvent("waitlist_error", { label: location, value: response.status });
      // Report what actually failed. Claiming the address was malformed when
      // the upstream is down would send people back to re-typing a valid email.
      setMessage(response.status === 422 ? INVALID_MESSAGE : result?.error || INVALID_MESSAGE);
    } catch {
      setState("error");
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
