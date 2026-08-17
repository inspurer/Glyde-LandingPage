"use client";

import { useState } from "react";

// "Real People, Real Cuts" — rebuilt from Figma node 497-283.
//
// Five cards of 375×667 with a 21px gap, starting 101px from the left, and a
// 100px round control centred on the card row. The fifth card runs past the
// right edge in the design; that bleed is the affordance that there is more to
// see, so the viewport clips rather than fitting all five.
//
// The cards are deliberately empty. The Figma frame ships them as blank
// rounded rectangles — no photo, no copy — and inventing content would not be
// the design. They are marked aria-hidden so a screen reader is not walked
// through five empty boxes.

const CARD_COUNT = 5;
const VISIBLE = 4;

export function ResultsSection() {
  const [index, setIndex] = useState(0);
  const maxIndex = CARD_COUNT - VISIBLE;

  const advance = () => setIndex((current) => (current >= maxIndex ? 0 : current + 1));

  return (
    <section className="s2 s2Results" aria-labelledby="results-title">
      <header className="s2Head s2ResultsHead">
        <p className="s2Eyebrow">Real People, Real Cuts</p>
        <h2 id="results-title" className="s2Title">
          See The <span className="s2Accent">Results</span>
        </h2>
        <p className="s2Count" aria-live="polite">
          <b>{String(index + 1).padStart(2, "0")}</b> / {String(CARD_COUNT).padStart(2, "0")}
        </p>
      </header>

      <div className="s2ResultsViewport">
        <div
          className="s2ResultsTrack"
          style={{ transform: `translateX(calc(${-index} * (375 / 1920 * 100vw + var(--gap))))` }}
        >
          {Array.from({ length: CARD_COUNT }, (_, i) => (
            <article className="s2ResultCard" key={i} aria-hidden="true" />
          ))}
        </div>

        <button
          type="button"
          className="s2Arrow s2ResultsArrow"
          onClick={advance}
          aria-label="Next result"
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
    </section>
  );
}
