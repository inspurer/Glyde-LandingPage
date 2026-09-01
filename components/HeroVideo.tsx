"use client";

import { useEffect, useRef } from "react";

// Background video for the hero.
//
// `muted` is not a style choice: browsers refuse to autoplay a video with
// sound, so an unmuted hero video simply never starts. The source is encoded
// without an audio track at all, so there is nothing to unmute.
//
// No React state here. The poster image sits behind the video and the <video>
// element shows its own poster until playback begins, so every "not playing"
// case — reduced motion (the stylesheet hides the video), a refused autoplay
// on iOS Low Power Mode, a codec neither source satisfies — lands on the same
// still frame without this component tracking which one happened.

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // The stylesheet already hides it; pausing stops the decode as well.
      video.pause();
      return;
    }

    // Safari sometimes ignores the autoplay attribute after a client
    // navigation. A rejected promise is expected, not an error.
    video.play().catch(() => undefined);
  }, []);

  return (
    <div className="heroV2Media" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="heroV2Poster" src="/media/hero-poster.jpg" alt="" fetchPriority="high" />
      {/* The mobile Figma frame uses a different, portrait crop and still. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="heroV2MobilePoster"
        src="/assets/figma/hero-photo.png"
        alt=""
        width={2048}
        height={1152}
        fetchPriority="high"
      />
      <video
        ref={videoRef}
        className="heroV2Video"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster="/media/hero-poster.jpg"
      >
        <source src="/media/hero.webm" type="video/webm" />
        <source src="/media/hero.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
