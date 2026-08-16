"use client";

import { useState, type FormEvent } from "react";

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

export function WaitlistForm({ location }: { location: "hero" | "footer" }) {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  const statusId = `${location}-form-status`;
  const hasErrors = state === "error";

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
          id={`${location}-email`}
          name="contact[email]"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          enterKeyHint="send"
          spellCheck={false}
          placeholder="GLYDE@163.com"
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
