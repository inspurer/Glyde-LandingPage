"use client";

import { useEffect, useRef, useState } from "react";

const HERO_EMAIL_ANCHOR = "#hero-email";

/**
 * Figma nodes 696:492 / 696:433 / 702:2. The bar is intentionally absent while the
 * hero is on screen, then becomes the page's persistent reservation control.
 */
export function TopNav() {
  const [visible, setVisible] = useState(false);
  const reserveRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(".heroV2");
    if (!hero) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // On narrow screens the next section starts with a compact heading only
        // 28px below the hero. Give it one nav-height to pass before revealing
        // the fixed bar so the bar cannot pop in directly over that heading.
        const narrowRevealOffset = window.matchMedia("(max-width: 900px)").matches ? 64 : 0;
        setVisible(window.scrollY >= hero.offsetTop + hero.offsetHeight + narrowRevealOffset - 1);
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    let focusRestoreFrame = 0;

    const restoreTriggerFocus = (event: HashChangeEvent) => {
      if (
        new URL(event.oldURL).hash !== HERO_EMAIL_ANCHOR ||
        new URL(event.newURL).hash === HERO_EMAIL_ANCHOR
      ) {
        return;
      }

      // Native hash navigation correctly focuses the email input. When the
      // visitor goes Back, browser scroll restoration may itself be smooth.
      // Wait until the original below-hero position and the TopNav have both
      // settled; otherwise the next Tab press jumps back to the off-screen form.
      cancelAnimationFrame(focusRestoreFrame);
      let attempts = 0;
      const focusWhenRestored = () => {
        const hero = document.querySelector<HTMLElement>(".heroV2");
        const email = document.querySelector<HTMLInputElement>(HERO_EMAIL_ANCHOR);
        const trigger = reserveRef.current;
        if (!hero || !email || !trigger || document.activeElement !== email) return;

        const navIsReady = trigger.closest(".topNav")?.getAttribute("data-visible") === "true";
        const restoredBelowHero = window.scrollY >= hero.offsetTop + hero.offsetHeight - 1;
        if (navIsReady && restoredBelowHero) {
          trigger.focus({ preventScroll: true });
          return;
        }

        attempts += 1;
        if (attempts < 180) focusRestoreFrame = requestAnimationFrame(focusWhenRestored);
      };
      focusRestoreFrame = requestAnimationFrame(focusWhenRestored);
    };

    window.addEventListener("hashchange", restoreTriggerFocus);
    return () => {
      cancelAnimationFrame(focusRestoreFrame);
      window.removeEventListener("hashchange", restoreTriggerFocus);
    };
  }, []);

  return (
    <nav
      className="topNav"
      data-visible={visible ? "true" : "false"}
      aria-label="GLYDE reservation"
      aria-hidden={!visible}
    >
      <a className="topNavHome" href="#top" aria-label="Back to GLYDE home" tabIndex={visible ? 0 : -1}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/hero/logo-wordmark.png" width={1196} height={204} alt="GLYDE" />
      </a>
      <a
        ref={reserveRef}
        className="topNavReserve"
        href={HERO_EMAIL_ANCHOR}
        aria-label="Reserve for $3 · Get $80 off at launch — enter your email"
        tabIndex={visible ? 0 : -1}
      >
        <span className="topNavReserveDesktop" aria-hidden="true">
          Reserve For $3 · Get $80 Off At Launch
        </span>
        <span className="topNavReserveMobile" aria-hidden="true">
          <span>Reserve For $3</span>
          <strong>Get $80 Off At Launch</strong>
        </span>
      </a>
    </nav>
  );
}
