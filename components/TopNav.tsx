"use client";

import { useEffect, useState } from "react";

const DEPOSIT_PATH = "/deposit";

/**
 * Figma nodes 696:492 / 696:482. The bar is intentionally absent while the
 * hero is on screen, then becomes the page's persistent reservation control.
 */
export function TopNav() {
  const [visible, setVisible] = useState(false);

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
      <a className="topNavReserve" href={DEPOSIT_PATH} tabIndex={visible ? 0 : -1}>
        <span>Reserve For $3</span>
        <strong>Get $80 Off At Launch</strong>
      </a>
    </nav>
  );
}
