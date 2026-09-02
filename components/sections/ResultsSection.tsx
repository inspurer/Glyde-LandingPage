"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type TransitionEvent as ReactTransitionEvent,
} from "react";

import { trackEvent } from "../Analytics";

// The initial visual order is the one shown in Figma: 4, 1, 2, 3, 5. This is
// also what makes the requested example exact: selecting 5 carries it past 3
// into the centre while 1 exits through the 4 slot and wraps into 5's old slot.
const VIDEOS = [
  {
    number: 4,
    id: "QYMGFUHt1Zg",
    title: "GLYDE's first seed user cuts his own hair at home",
    poster: "/assets/v2/result-04-QYMGFUHt1Zg.webp",
  },
  {
    number: 1,
    id: "PKtwA1m1qLM",
    title: "GLYDE Auto-Fade Haircut | Before & After",
    poster: "/assets/v3/result-01-cover.png",
  },
  {
    number: 2,
    id: "XFo8fvejvvU",
    title: "1M YouTuber CyrusJanssen tried GLYDE at our office",
    poster: "/assets/v3/result-02-cover.png",
  },
  {
    number: 3,
    id: "HCN69rdEesY",
    title: "See What GLYDE Can Do on a First Try",
    poster: "/assets/v2/result-03-HCN69rdEesY.webp",
  },
  {
    number: 5,
    id: "YoZhPBRnH9Q",
    title: "A Great Fade Made Simple | GLYDE Before & After",
    poster: "/assets/v2/result-05-YoZhPBRnH9Q.webp",
  },
] as const;

const INITIAL_CENTER_INDEX = 2;
const STEP_TRANSITION_MS = 420;
const WRAP_FADE_MS = 120;
const DRAG_AXIS_LOCK_PX = 8;
const DRAG_AXIS_DOMINANCE = 1.2;
const DRAG_RESISTANCE = 0.82;
const DRAG_VELOCITY_THRESHOLD = 0.45;
const DRAG_MIN_FLICK_PX = 24;
const DRAG_CLICK_SUPPRESSION_MS = 450;
const WHEEL_AXIS_THRESHOLD = 18;
const WHEEL_GESTURE_END_MS = 180;

type Direction = -1 | 1;
type MotionPhase = "exit" | "relocate" | "enter";
type PlaybackTrigger = "center-card" | "moved-card";
type NavigationTrigger = "arrow" | "keyboard" | "swipe" | "trackpad";
type DragAxis = "pending" | "horizontal";

type Motion = {
  direction: Direction;
  fromCenter: number;
  phase: MotionPhase;
  toCenter: number;
  token: number;
  wrappingId: string;
};

type MoveRequest = {
  playAfterMove: boolean;
  targetIndex: number;
};

type PointerDrag = {
  axis: DragAxis;
  lastTime: number;
  lastX: number;
  pointerId: number;
  startX: number;
  startY: number;
  velocityX: number;
};

function wrapIndex(index: number): number {
  return (index + VIDEOS.length) % VIDEOS.length;
}

/** Signed shortest distance around the five-item ring, always in [-2, 2]. */
function shortestDistance(from: number, to: number): number {
  const forward = wrapIndex(to - from);
  return forward > VIDEOS.length / 2 ? forward - VIDEOS.length : forward;
}

function slotFor(itemIndex: number, centerIndex: number): number {
  return shortestDistance(centerIndex, itemIndex);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

export function ResultsSection() {
  const [centerIndex, setCenterIndex] = useState(INITIAL_CENTER_INDEX);
  // One at a time: moving to another card unmounts the current player before a
  // new one is inserted, so there can never be two YouTube iframes or two audio
  // streams alive beneath the carousel.
  const [playing, setPlaying] = useState<string | null>(null);
  const [motion, setMotion] = useState<Motion | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const centerIndexRef = useRef(INITIAL_CENTER_INDEX);
  // Tracks the requested destination as well as the rendered centre so repeated
  // ArrowRight/ArrowLeft presses accumulate even while a previous step moves.
  const destinationIndexRef = useRef(INITIAL_CENTER_INDEX);
  const movingRef = useRef(false);
  const mountedRef = useRef(true);
  const motionTokenRef = useRef(0);
  // A new request replaces an older queued request. The current one-card step
  // is allowed to finish cleanly, then the ring takes the shortest route from
  // its new centre to the latest requested card.
  const queuedMoveRef = useRef<MoveRequest | null>(null);
  const reducedMotionRef = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pointerDragRef = useRef<PointerDrag | null>(null);
  const suppressClickUntilRef = useRef(0);
  const wheelNavigateRef = useRef<(direction: Direction) => void>(() => undefined);

  useEffect(() => {
    // React development Strict Mode runs an effect setup/cleanup/setup cycle.
    // Restore the latch here so that the second setup behaves like the real
    // mount rather than leaving every queued interaction permanently cancelled.
    mountedRef.current = true;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      reducedMotionRef.current = preference.matches;
      setReducedMotion(preference.matches);
    };

    syncPreference();
    preference.addEventListener?.("change", syncPreference);

    return () => {
      mountedRef.current = false;
      queuedMoveRef.current = null;
      motionTokenRef.current += 1;
      preference.removeEventListener?.("change", syncPreference);
    };
  }, []);

  function startPlayback(index: number, trigger: PlaybackTrigger) {
    const video = VIDEOS[index];
    setPlaying(video.id);
    trackEvent("video_play", {
      label: video.title,
      props: { id: video.id, provider: "youtube", trigger },
    });
  }

  async function animateStep(direction: Direction): Promise<boolean> {
    const fromCenter = centerIndexRef.current;
    const toCenter = wrapIndex(fromCenter + direction);
    // Moving to the next centre shifts every card left, so the old -2 card is
    // the one that disappears and re-enters at +2. Previous does the inverse.
    const outgoingSlot = direction === 1 ? -2 : 2;
    const wrappingIndex = VIDEOS.findIndex(
      (_, itemIndex) => slotFor(itemIndex, fromCenter) === outgoingSlot,
    );
    const token = motionTokenRef.current + 1;
    motionTokenRef.current = token;
    const baseMotion = {
      direction,
      fromCenter,
      toCenter,
      token,
      wrappingId: VIDEOS[wrappingIndex].id,
    };

    // CSS uses these three phases to fade the boundary card at its old edge,
    // relocate it invisibly, and reveal it at the opposite edge. The remaining
    // four cards transition normally between their from/to slots.
    setMotion({ ...baseMotion, phase: "exit" });
    await wait(WRAP_FADE_MS);
    if (!mountedRef.current || motionTokenRef.current !== token) return false;

    centerIndexRef.current = toCenter;
    setCenterIndex(toCenter);
    setMotion({ ...baseMotion, phase: "relocate" });
    await nextFrame();
    if (!mountedRef.current || motionTokenRef.current !== token) return false;

    setMotion({ ...baseMotion, phase: "enter" });
    await wait(STEP_TRANSITION_MS);
    if (!mountedRef.current || motionTokenRef.current !== token) return false;

    setMotion(null);
    return true;
  }

  async function drainMoveQueue() {
    if (movingRef.current) return;

    movingRef.current = true;
    setIsAnimating(true);

    try {
      while (mountedRef.current && queuedMoveRef.current) {
        const request = queuedMoveRef.current;
        queuedMoveRef.current = null;

        if (reducedMotionRef.current) {
          centerIndexRef.current = request.targetIndex;
          setCenterIndex(request.targetIndex);
          setMotion(null);
        } else {
          while (
            mountedRef.current &&
            centerIndexRef.current !== request.targetIndex &&
            !queuedMoveRef.current
          ) {
            const distance = shortestDistance(
              centerIndexRef.current,
              request.targetIndex,
            );
            const completed = await animateStep(distance > 0 ? 1 : -1);
            if (!completed) break;
          }
        }

        // A newer click wins. Otherwise, a card that was clicked off-centre is
        // now the centre card and can mount the sole autoplaying iframe.
        if (
          !queuedMoveRef.current &&
          centerIndexRef.current === request.targetIndex &&
          request.playAfterMove
        ) {
          startPlayback(request.targetIndex, "moved-card");
        }
      }
    } finally {
      movingRef.current = false;
      if (mountedRef.current) {
        setMotion(null);
        setIsAnimating(false);
        // Covers the narrow race in which a click lands after the loop observes
        // an empty queue but before `movingRef` is cleared.
        if (queuedMoveRef.current) void drainMoveQueue();
      }
    }
  }

  function requestMove(targetIndex: number, playAfterMove: boolean) {
    const normalizedTarget = wrapIndex(targetIndex);
    destinationIndexRef.current = normalizedTarget;

    if (!movingRef.current && centerIndexRef.current === normalizedTarget) {
      if (playAfterMove) startPlayback(normalizedTarget, "center-card");
      return;
    }

    // Playback belongs only to the centre. Stop the current iframe before any
    // spatial movement begins, then mount the requested one after arrival.
    setPlaying(null);
    queuedMoveRef.current = { playAfterMove, targetIndex: normalizedTarget };
    void drainMoveQueue();
  }

  function moveRelative(direction: Direction, trigger: NavigationTrigger) {
    const fromIndex = destinationIndexRef.current;
    const targetIndex = wrapIndex(fromIndex + direction);

    trackEvent("carousel_navigate", {
      label: "See The Results",
      value: VIDEOS[targetIndex].number,
      props: {
        direction: direction === 1 ? "next" : "previous",
        from: VIDEOS[fromIndex].number,
        method: trigger,
        to: VIDEOS[targetIndex].number,
      },
    });
    requestMove(targetIndex, false);
  }

  function resetPointerDrag(
    suppressClick: boolean,
    eventTime: number,
    continueIntoStep = false,
  ) {
    const gesture = pointerDragRef.current;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    pointerDragRef.current = null;

    if (gesture && viewport?.hasPointerCapture(gesture.pointerId)) {
      viewport.releasePointerCapture(gesture.pointerId);
    }
    viewport?.removeAttribute("data-dragging");
    if (continueIntoStep) {
      viewport?.setAttribute("data-drag-committed", "true");
    } else {
      viewport?.removeAttribute("data-drag-committed");
    }
    track?.style.setProperty("--result-drag-offset", "0px");

    if (suppressClick) {
      suppressClickUntilRef.current = eventTime + DRAG_CLICK_SUPPRESSION_MS;
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest(".s2ResultsArrow, .s2ResultsReserve")) return;
    if (event.pointerType !== "mouse" && !target.closest(".s2ResultSlot")) return;
    event.currentTarget.removeAttribute("data-drag-committed");

    // Leave a narrow touch-only edge free for the browser's system back gesture.
    const bounds = event.currentTarget.getBoundingClientRect();
    if (
      event.pointerType !== "mouse" &&
      (event.clientX - bounds.left < 20 || bounds.right - event.clientX < 20)
    ) {
      return;
    }

    pointerDragRef.current = {
      axis: "pending",
      lastTime: event.timeStamp,
      lastX: event.clientX,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      velocityX: 0,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = pointerDragRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    const absoluteX = Math.abs(deltaX);
    const absoluteY = Math.abs(deltaY);

    if (gesture.axis === "pending") {
      if (Math.max(absoluteX, absoluteY) < DRAG_AXIS_LOCK_PX) return;

      if (absoluteY > absoluteX * DRAG_AXIS_DOMINANCE) {
        // A vertical gesture belongs to the page, not the carousel.
        pointerDragRef.current = null;
        return;
      }
      if (absoluteX <= absoluteY * DRAG_AXIS_DOMINANCE) return;

      gesture.axis = "horizontal";
      // Touch/pen already receive implicit pointer capture. Explicitly taking
      // capture there can be dropped by WebKit/embedded browsers after the
      // first move; mouse needs it so a fast drag can leave the viewport.
      if (event.pointerType === "mouse") {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      event.currentTarget.setAttribute("data-dragging", "true");
    }

    event.preventDefault();
    const elapsed = Math.max(1, event.timeStamp - gesture.lastTime);
    gesture.velocityX = (event.clientX - gesture.lastX) / elapsed;
    gesture.lastX = event.clientX;
    gesture.lastTime = event.timeStamp;

    const maximumOffset = Math.min(420, event.currentTarget.clientWidth * 0.28);
    const resistedOffset = Math.max(
      -maximumOffset,
      Math.min(maximumOffset, deltaX * DRAG_RESISTANCE),
    );
    trackRef.current?.style.setProperty("--result-drag-offset", `${resistedOffset}px`);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = pointerDragRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;

    const deltaX = event.clientX - gesture.startX;
    const absoluteX = Math.abs(deltaX);
    const threshold = Math.min(
      96,
      Math.max(42, event.currentTarget.clientWidth * 0.08),
    );
    const wasHorizontal = gesture.axis === "horizontal";
    const shouldMove =
      wasHorizontal &&
      (absoluteX >= threshold ||
        (absoluteX >= DRAG_MIN_FLICK_PX &&
          Math.abs(gesture.velocityX) > DRAG_VELOCITY_THRESHOLD));

    // The first committed gesture lets the dragged track continue directly
    // into the existing 120ms wrap fade + 420ms slot transition. If another
    // step is already moving, use the short neutral return and let its queue
    // safely accumulate the new destination.
    resetPointerDrag(
      wasHorizontal,
      event.timeStamp,
      shouldMove && !movingRef.current,
    );
    if (shouldMove) moveRelative(deltaX < 0 ? 1 : -1, "swipe");
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = pointerDragRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    resetPointerDrag(gesture.axis === "horizontal", event.timeStamp);
  }

  function handleLostPointerCapture(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = pointerDragRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    resetPointerDrag(gesture.axis === "horizontal", event.timeStamp);
  }

  function handleClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.timeStamp > suppressClickUntilRef.current) return;
    suppressClickUntilRef.current = 0;
    event.preventDefault();
    event.stopPropagation();
  }

  function handleTrackTransitionEnd(event: ReactTransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== "transform") return;
    viewportRef.current?.removeAttribute("data-drag-committed");
  }

  function handleCarouselKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveRelative(-1, "keyboard");
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveRelative(1, "keyboard");
    }
  }

  useEffect(() => {
    wheelNavigateRef.current = (direction) => moveRelative(direction, "trackpad");
  });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let wheelGestureActive = false;
    let wheelGestureTimer = 0;
    const endWheelGesture = () => {
      wheelGestureActive = false;
      wheelGestureTimer = 0;
    };
    const handleWheel = (event: WheelEvent) => {
      const absoluteX = Math.abs(event.deltaX);
      const absoluteY = Math.abs(event.deltaY);
      if (absoluteX <= absoluteY || absoluteX < WHEEL_AXIS_THRESHOLD) return;

      event.preventDefault();
      window.clearTimeout(wheelGestureTimer);
      wheelGestureTimer = window.setTimeout(endWheelGesture, WHEEL_GESTURE_END_MS);
      if (wheelGestureActive) return;

      wheelGestureActive = true;
      wheelNavigateRef.current(event.deltaX > 0 ? 1 : -1);
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
      window.clearTimeout(wheelGestureTimer);
    };
  }, []);

  const directionName = motion?.direction === 1 ? "next" : motion ? "previous" : "none";

  return (
    <section
      className="s2 s2Results"
      aria-labelledby="results-title"
      data-carousel-animating={isAnimating ? "true" : "false"}
      data-carousel-direction={directionName}
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
      <header className="s2Head s2ResultsHead">
        <p className="s2Eyebrow">Real People, Real Cuts</p>
        <h2 id="results-title" className="s2Title">
          See The <span className="s2Accent">Results</span>
        </h2>
        <p className="s2ResultsSub">First-Time Users. No Touch-Ups. Just GLYDE.</p>
        <p className="s2Count" aria-live="polite" aria-atomic="true">
          <b>{String(VIDEOS[centerIndex].number).padStart(2, "0")}</b> /{" "}
          {String(VIDEOS.length).padStart(2, "0")}
        </p>
      </header>

      <div
        ref={viewportRef}
        className="s2ResultsViewport s2ResultsCarousel"
        role="region"
        aria-roledescription="carousel"
        aria-label="GLYDE haircut result videos"
        aria-describedby="results-carousel-instructions"
        aria-busy={isAnimating}
        tabIndex={0}
        onClickCapture={handleClickCapture}
        onKeyDown={handleCarouselKeyDown}
        onLostPointerCapture={handleLostPointerCapture}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <p id="results-carousel-instructions" className="srOnly">
          Drag, swipe, use a horizontal trackpad gesture, or use the left and right arrow keys to
          select a result. Select the centre card to play it.
        </p>

        <div
          ref={trackRef}
          className="s2ResultsTrack s2ResultsRing"
          data-motion-phase={motion?.phase ?? "idle"}
          data-motion-token={motion?.token ?? 0}
          onTransitionEnd={handleTrackTransitionEnd}
          style={
            {
              "--result-step-duration": `${STEP_TRANSITION_MS}ms`,
              "--result-wrap-duration": `${WRAP_FADE_MS}ms`,
            } as CSSProperties
          }
        >
          {VIDEOS.map((video, itemIndex) => {
            const slot = slotFor(itemIndex, centerIndex);
            const isCenter = slot === 0;
            const isPlaying = isCenter && playing === video.id;
            const isWrapping = motion?.wrappingId === video.id;
            const fromSlot = motion ? slotFor(itemIndex, motion.fromCenter) : slot;
            const toSlot = motion ? slotFor(itemIndex, motion.toCenter) : slot;
            const wrapDirection = isWrapping
              ? motion.direction === 1
                ? "start-to-end"
                : "end-to-start"
              : "none";
            const cardClassName = [
              "s2ResultCard",
              "s2ResultSlot",
              isCenter ? "s2ResultCard--center" : "",
              isPlaying ? "s2ResultCard--playing" : "",
              isWrapping ? "s2ResultCard--wrapping" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <article
                className={cardClassName}
                key={video.id}
                aria-current={isCenter ? "true" : undefined}
                aria-label={`Result ${video.number} of ${VIDEOS.length}: ${video.title}`}
                data-center={isCenter ? "true" : "false"}
                data-from-slot={fromSlot}
                data-motion-phase={motion?.phase ?? "idle"}
                data-playing={isPlaying ? "true" : "false"}
                data-slot={slot}
                data-to-slot={toSlot}
                data-video-number={video.number}
                data-wrap={wrapDirection}
                style={
                  {
                    "--result-from-slot": fromSlot,
                    "--result-slot": slot,
                    "--result-to-slot": toSlot,
                  } as CSSProperties
                }
              >
                {isPlaying ? (
                  <iframe
                    className="s2ResultPlayer"
                    src={`https://www.youtube.com/embed/${video.id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
                    title={video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                ) : (
                  <button
                    type="button"
                    className="s2ResultFacade"
                    aria-label={
                      isCenter
                        ? `Play: ${video.title}`
                        : `Move to centre and play: ${video.title}`
                    }
                    onClick={() => requestMove(itemIndex, true)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={video.poster}
                      alt=""
                      width={720}
                      height={1280}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                    <span className="s2ResultPlay" aria-hidden="true">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" />
                      </svg>
                    </span>
                  </button>
                )}
              </article>
            );
          })}
        </div>

        <button
          type="button"
          className="s2Arrow s2ResultsArrow"
          onClick={() => moveRelative(1, "arrow")}
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

        <a className="s2ResultsReserve" href="/deposit">
          Reserve Now
        </a>
      </div>
    </section>
  );
}
