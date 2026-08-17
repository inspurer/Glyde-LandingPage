"use client";

import { useState } from "react";

// "Design & Craft" — rebuilt from Figma node 497-283.
//
// Three tabs over a row of 352×466 cards from x82 with a 21px gap; the fifth
// card bleeds past the right edge, which is the cue that the row scrolls.
//
// Only the Interaction tab's cards exist in the design. Philosophy and Colors
// render the same set until their content arrives — a placeholder that is
// visible and obviously provisional, rather than an empty panel that looks
// broken.

const TABS = ["Interaction", "Philosophy", "Colors"] as const;

const INTERACTION_CARDS = [
  { src: "/assets/v2/craft-1-designed-for-your-routine.webp", caption: "Designed For Your Routine, Not Around It." },
  { src: "/assets/v2/craft-2-flip-to-clean.webp", caption: "Flip To Clean" },
  { src: "/assets/v2/craft-3-feels-right-in-your-hand.webp", caption: "Feels Right In Your Hand" },
  { src: "/assets/v2/craft-4-drop-and-charge.webp", caption: "Drop And Charge" },
  { src: "/assets/v2/craft-5-minimal-outside.webp", caption: "Minimal On The Outside. Precision On The Inside." },
];

const VISIBLE = 5;

export function DesignCraftSection() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Interaction");
  const [index, setIndex] = useState(0);

  const cards = INTERACTION_CARDS;
  const maxIndex = Math.max(0, cards.length - VISIBLE + 1);

  return (
    <section className="s2 s2Craft" aria-labelledby="craft-title">
      <header className="s2CraftHead">
        <p className="s2CraftEyebrow">Design &amp; Craft</p>
        <h2 id="craft-title" className="s2CraftTitle">
          <b>Built To Feel</b> <em>Right.</em> Every Detail Designed Around Your Daily Routine.
        </h2>
      </header>

      <div className="s2CraftTabs" role="tablist" aria-label="Design and craft topics">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            className="s2CraftTab"
            aria-selected={tab === name}
            onClick={() => {
              setTab(name);
              setIndex(0);
            }}
          >
            {name}
          </button>
        ))}

        <button
          type="button"
          className="s2Arrow s2CraftTabsArrow"
          onClick={() => setIndex((current) => (current >= maxIndex ? 0 : current + 1))}
          aria-label="Next detail"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 12h15m0 0-6-6m6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="s2CraftViewport">
        <div
          className="s2CraftTrack"
          style={{ transform: `translateX(calc(${-index} * (352 / 1920 * 100vw + var(--gap))))` }}
        >
          {cards.map((card) => (
            <article className="s2CraftCard" key={card.src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.src} alt="" loading="lazy" decoding="async" />
              <p className="s2CraftCaption">{card.caption}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
