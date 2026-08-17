"use client";

import { useEffect, useRef } from "react";

// A muted, looping, decorative background video.
//
// `muted` is not a preference: browsers refuse to autoplay a video that has
// sound, so an unmuted one never starts. Every source here is encoded without
// an audio track, so there is nothing to unmute.
//
// Playback is gated on visibility. These sections sit far down a long page and
// there are five of these videos in total; decoding all of them from the moment
// the page loads would burn bandwidth and battery on footage nobody has
// scrolled to yet. An IntersectionObserver plays what is on screen and pauses
// what is not.

export function LoopingVideo({
  src,
  poster,
  label,
}: {
  /** Path without extension; .webm and .mp4 are both served. */
  src: string;
  poster: string;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            video.play().catch(() => undefined);
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      loop
      muted
      playsInline
      preload="none"
      poster={poster}
      aria-label={label}
    >
      <source src={`${src}.webm`} type="video/webm" />
      <source src={`${src}.mp4`} type="video/mp4" />
    </video>
  );
}
