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

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const markPlaying = () => {
      video.dataset.glydePlaying = "true";
    };
    const showFallback = () => {
      delete video.dataset.glydePlaying;
    };
    const syncPlayback = () => {
      if (motionPreference.matches || document.visibilityState === "hidden") {
        video.pause();
        if (motionPreference.matches) showFallback();
        return;
      }

      // Safari evaluates autoplay eligibility from the live properties as well
      // as the markup. Reassert both before every initial/resume attempt.
      video.defaultMuted = true;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");

      const playAttempt = video.play();
      if (playAttempt) playAttempt.then(markPlaying, showFallback);
      else if (!video.paused) markPlaying();
    };
    const onVisibilityChange = () => syncPlayback();

    video.addEventListener("playing", markPlaying);
    video.addEventListener("error", showFallback);
    window.addEventListener("pageshow", syncPlayback);
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("pointerdown", syncPlayback, {
      capture: true,
      passive: true,
      once: true,
    });
    document.addEventListener("touchstart", syncPlayback, {
      capture: true,
      passive: true,
      once: true,
    });
    if (typeof motionPreference.addEventListener === "function") {
      motionPreference.addEventListener("change", syncPlayback);
    } else {
      motionPreference.addListener(syncPlayback);
    }

    syncPlayback();

    return () => {
      video.removeEventListener("playing", markPlaying);
      video.removeEventListener("error", showFallback);
      window.removeEventListener("pageshow", syncPlayback);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("pointerdown", syncPlayback, true);
      document.removeEventListener("touchstart", syncPlayback, true);
      if (typeof motionPreference.removeEventListener === "function") {
        motionPreference.removeEventListener("change", syncPlayback);
      } else {
        motionPreference.removeListener(syncPlayback);
      }
      video.pause();
      showFallback();
    };
  }, []);

  return (
    <div className="heroV2Media" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="heroV2Poster" src="/media/hero-poster.jpg" alt="" fetchPriority="high" />
      {/* The mobile Figma frame uses a different, portrait crop and still. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="heroV2MobilePoster"
        src="/assets/v3/hero-mobile-figma.png"
        alt=""
        width={1080}
        height={1308}
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
        <source src="/media/hero.mp4" type="video/mp4" />
        <source src="/media/hero.webm" type="video/webm" />
      </video>
    </div>
  );
}
