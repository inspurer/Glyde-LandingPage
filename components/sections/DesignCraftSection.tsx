"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// "Design & Craft" — rebuilt from Figma node 497-283, card row 497-369.
//
// One continuous row of twelve 352×466 cards from x82 with a 21px gap; the
// fifth card bleeds past the right edge, which is the cue that the row scrolls.
//
// The three tabs are not three separate sets — they are bookmarks into that one
// row, four cards apart. Interaction parks card 1 at the row's left edge,
// Philosophy card 5, Colors card 9. Arrowing or swiping past a boundary moves
// the selected tab with it, since the tab describes where you are.

const TABS = [
  { name: "Interaction", start: 0 },
  { name: "Philosophy", start: 4 },
  { name: "Colors", start: 8 },
] as const;

// All twelve, in the row's order, exported from Figma at 2x (704×932 for a
// 352×466 card) and re-encoded to WebP — 352KB for the set.
//
// Unlike the first batch, these exports carry no baked-in caption, so nothing
// has to be painted out of the artwork this time. The captions below are the
// design's own text layer, which is not part of the image export: the five that
// were readable off the page export are here, and the rest are still missing
// rather than invented.
//
// The order was checked rather than trusted. Each of the first five matches its
// card in the page export with a mean grey difference of 5-8, where the nearest
// other card of the five scores 28-41 — a four-to-sixfold margin, so the
// sequence is not ambiguous.
const CARDS = [
  { src: "/assets/v2/craft-01.webp", caption: "Designed For Your Routine, Not Around It." },
  { src: "/assets/v2/craft-02.webp", caption: "Flip To Clean" },
  { src: "/assets/v2/craft-03.webp", caption: "Feels Right In Your Hand" },
  { src: "/assets/v2/craft-04.webp", caption: "Drop And Charge" },
  { src: "/assets/v2/craft-05.webp", caption: "Minimal On The Outside. Precision On The Inside." },
  { src: "/assets/v2/craft-06.webp", caption: "" },
  { src: "/assets/v2/craft-07.webp", caption: "" },
  { src: "/assets/v2/craft-08.webp", caption: "" },
  { src: "/assets/v2/craft-09.webp", caption: "" },
  { src: "/assets/v2/craft-10.webp", caption: "" },
  { src: "/assets/v2/craft-11.webp", caption: "" },
  { src: "/assets/v2/craft-12.webp", caption: "" },
];

// How many cards stand in the viewport at the 1920 reference width: five, with
// the fifth bleeding. The last position that still fills the row is therefore
// twelve minus five plus the bleeding one — which lands exactly on card 9, the
// Colors bookmark.
const VISIBLE = 5;
const MAX_INDEX = Math.max(0, CARDS.length - VISIBLE + 1);

type TabName = (typeof TABS)[number]["name"];

/** The tab whose range contains `index`. */
function tabFor(index: number): TabName {
  let current: TabName = TABS[0].name;
  for (const tab of TABS) if (index >= tab.start) current = tab.name;
  return current;
}

export function DesignCraftSection() {
  const [index, setIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // Set while a tab click is scrolling the phone carousel, so the scroll
  // handler below does not fight the animation it triggered.
  const scrollingTo = useRef(false);

  // Desktop moves the track with a transform and the viewport never scrolls;
  // the phone layout drops that transform and scrolls natively. Doing both is
  // what keeps one handler correct for either, since whichever does not apply
  // is a no-op there.
  const goTo = useCallback((next: number) => {
    setIndex(next);
    const viewport = viewportRef.current;
    const card = trackRef.current?.children[next] as HTMLElement | undefined;
    if (!viewport || !card) return;
    if (viewport.scrollWidth <= viewport.clientWidth) return;
    scrollingTo.current = true;
    viewport.scrollTo({
      left: viewport.scrollLeft + card.getBoundingClientRect().left
        - viewport.getBoundingClientRect().left
        - parseFloat(getComputedStyle(viewport).scrollPaddingLeft || "0"),
      behavior: "smooth",
    });
    window.setTimeout(() => { scrollingTo.current = false; }, 600);
  }, []);

  // On a phone the row is swiped rather than driven, so the selected tab has to
  // follow the scroll or it would keep announcing a card the visitor left long
  // ago.
  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    let last = 0;
    const onScroll = () => {
      if (scrollingTo.current) return;
      const now = Date.now();
      if (now - last < 120) return;
      last = now;
      const edge = viewport.getBoundingClientRect().left;
      let nearest = 0;
      let best = Infinity;
      for (let i = 0; i < track.children.length; i += 1) {
        const distance = Math.abs(track.children[i].getBoundingClientRect().left - edge);
        if (distance < best) {
          best = distance;
          nearest = i;
        }
      }
      setIndex(nearest);
    };

    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, []);

  const selected = tabFor(index);

  return (
    <section className="s2 s2Craft" aria-labelledby="craft-title">
      <header className="s2CraftHead">
        <p className="s2CraftEyebrow">Design &amp; Craft</p>
        <h2 id="craft-title" className="s2CraftTitle">
          <b>Built To Feel</b> <em>Right.</em> Every Detail Designed Around Your Daily Routine.
        </h2>
      </header>

      <div className="s2CraftTabs" role="tablist" aria-label="Design and craft topics">
        {TABS.map((tab) => (
          <button
            key={tab.name}
            type="button"
            role="tab"
            className="s2CraftTab"
            aria-selected={selected === tab.name}
            onClick={() => goTo(tab.start)}
          >
            {tab.name}
          </button>
        ))}

        <button
          type="button"
          className="s2Arrow s2CraftTabsArrow"
          onClick={() => goTo(index >= MAX_INDEX ? 0 : index + 1)}
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

      <div className="s2CraftViewport" ref={viewportRef}>
        <div
          className="s2CraftTrack"
          ref={trackRef}
          style={{ transform: `translateX(calc(${-index} * (352 / 1920 * 100vw + var(--gap))))` }}
        >
          {CARDS.map((card) => (
            <article className="s2CraftCard" key={card.src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.src}
                alt=""
                width={704}
                height={932}
                loading="lazy"
                decoding="async"
              />
              {card.caption ? <p className="s2CraftCaption">{card.caption}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
