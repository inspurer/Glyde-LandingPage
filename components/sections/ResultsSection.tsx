"use client";

import { useState } from "react";

import { trackEvent } from "../Analytics";

// "Real People, Real Cuts" — rebuilt from Figma node 497-283.
//
// Five cards of 375×667 with a 21px gap, starting 101px from the left, and a
// 100px round control centred on the card row. The fifth card runs past the
// right edge in the design; that bleed is the affordance that there is more to
// see, so the viewport clips rather than fitting all five.
//
// The design ships the cards blank. They now hold five Shorts from GLYDE's own
// channel, which is a 9:16 frame — 1080×1920 against the card's 375×667, the
// same aspect to within half a percent, so the artwork fills the card with no
// crop and no letterboxing.
//
// Each card is a facade, not an embed: a self-hosted still with a play control,
// which swaps in the real player only once someone asks for it. Five live
// iframes would pull several megabytes of YouTube's player on first paint and
// set third-party cookies for every visitor who never presses play, on a page
// whose own analytics are deliberately first-party. The posters are the videos'
// own `oar2` frames, re-encoded to WebP and served from this origin, so nothing
// reaches youtube.com until the click.

const VIDEOS = [
  { id: "lt88LWLGL8w", title: "His Reaction to the Final Look Says It All" },
  { id: "XFo8fvejvvU", title: "1M YouTuber CyrusJanssen tried GLYDE at our office" },
  { id: "HCN69rdEesY", title: "See What GLYDE Can Do on a First Try" },
  { id: "QYMGFUHt1Zg", title: "GLYDE's first seed user cuts his own hair at home" },
  { id: "ql0uL7epUwA", title: "See GLYDE in Action: A Live Haircut Demo" },
];

const POSTERS: Record<string, string> = {
  lt88LWLGL8w: "/assets/v2/result-01-lt88LWLGL8w.webp",
  XFo8fvejvvU: "/assets/v2/result-02-XFo8fvejvvU.webp",
  HCN69rdEesY: "/assets/v2/result-03-HCN69rdEesY.webp",
  QYMGFUHt1Zg: "/assets/v2/result-04-QYMGFUHt1Zg.webp",
  ql0uL7epUwA: "/assets/v2/result-05-ql0uL7epUwA.webp",
};

const VISIBLE = 4;

export function ResultsSection() {
  const [index, setIndex] = useState(0);
  // One at a time: starting a second video would leave the first one playing
  // underneath, and mounting a player per card defeats the point of the facade.
  const [playing, setPlaying] = useState<string | null>(null);
  const maxIndex = VIDEOS.length - VISIBLE;

  const advance = () => setIndex((current) => (current >= maxIndex ? 0 : current + 1));

  return (
    <section className="s2 s2Results" aria-labelledby="results-title">
      <header className="s2Head s2ResultsHead">
        <p className="s2Eyebrow">Real People, Real Cuts</p>
        <h2 id="results-title" className="s2Title">
          See The <span className="s2Accent">Results</span>
        </h2>
        <p className="s2Count" aria-live="polite">
          <b>{String(index + 1).padStart(2, "0")}</b> / {String(VIDEOS.length).padStart(2, "0")}
        </p>
      </header>

      <div className="s2ResultsViewport">
        <div
          className="s2ResultsTrack"
          style={{ transform: `translateX(calc(${-index} * (375 / 1920 * 100vw + var(--gap))))` }}
        >
          {VIDEOS.map((video) => (
            <article className="s2ResultCard" key={video.id}>
              {playing === video.id ? (
                <iframe
                  className="s2ResultPlayer"
                  // No `autoplay=1`, deliberately. YouTube answers a player that
                  // starts without a gesture of its own with "sign in to confirm
                  // you're not a bot", and the video never plays. Measured on the
                  // live origin: autoplay fails on both youtube.com and the
                  // nocookie host, `autoplay=1&mute=1` fails, and driving an
                  // otherwise-idle player with a postMessage `playVideo` command
                  // fails too — what it objects to is programmatic playback, not
                  // embedding. Loaded idle it plays fine. The cost is that the
                  // visitor presses play twice: once on the poster below, once on
                  // YouTube's own control. Self-hosting these five clips the way
                  // the rest of the page's video works would remove both the
                  // second click and the dependency; see the README.
                  //
                  // nocookie: YouTube's privacy-preserving host, which holds off
                  // on its tracking cookies until playback actually starts.
                  src={`https://www.youtube-nocookie.com/embed/${video.id}?playsinline=1&rel=0&modestbranding=1`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              ) : (
                <button
                  type="button"
                  className="s2ResultFacade"
                  aria-label={`Play: ${video.title}`}
                  onClick={() => {
                    setPlaying(video.id);
                    trackEvent("video_play", {
                      label: video.title,
                      props: { id: video.id, provider: "youtube" },
                    });
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={POSTERS[video.id]}
                    alt=""
                    width={720}
                    height={1280}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="s2ResultPlay" aria-hidden="true">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" />
                    </svg>
                  </span>
                </button>
              )}
            </article>
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
