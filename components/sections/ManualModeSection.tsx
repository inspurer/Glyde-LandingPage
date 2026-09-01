"use client";

import type {
  KeyboardEvent as ReactKeyboardEvent,
  SyntheticEvent as ReactSyntheticEvent,
} from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const STOPS = [
  { value: "01", image: "/assets/v3/manual-01.webp" },
  { value: "04", image: "/assets/v3/manual-04.webp" },
  { value: "08", image: "/assets/v3/manual-08.webp" },
  { value: "12", image: "/assets/v3/manual-12.webp" },
  { value: "16", image: "/assets/v3/manual-16.webp" },
  { value: "20", image: "/assets/v3/manual-20.webp" },
  { value: "25", image: "/assets/v3/manual-25.webp" },
] as const;

const DEFAULT_INDEX = 3;
const PIXELS_PER_WHEEL_NOTCH = 100;
const LINES_PER_WHEEL_NOTCH = 3;
const WHEEL_IDLE_RESET_MS = 180;
const WHEEL_STEP_THROTTLE_MS = 90;
const FRAME_DISSOLVE_MS = 360;

const GEOMETRY = [
  { offset: 0, scale: 1, opacity: 1 },
  { offset: 126, scale: 0.75, opacity: 0.6 },
  { offset: 219.5, scale: 0.55, opacity: 0.3 },
  { offset: 281, scale: 0.3, opacity: 0.3 },
];

function clampPosition(value: number) {
  return Math.max(0, Math.min(STOPS.length - 1, value));
}

/** Interpolated placement for an option `distance` stops from the centre. */
function placement(distance: number) {
  const absoluteDistance = Math.abs(distance);
  if (absoluteDistance >= GEOMETRY.length - 1) {
    const overflow = absoluteDistance - (GEOMETRY.length - 1);
    return {
      offset: GEOMETRY[3].offset + overflow * 48,
      scale: Math.max(0.16, GEOMETRY[3].scale - overflow * 0.08),
      opacity: Math.max(0, GEOMETRY[3].opacity - overflow * 0.3),
    };
  }

  const lower = Math.floor(absoluteDistance);
  const upper = Math.ceil(absoluteDistance);
  const progress = absoluteDistance - lower;
  const interpolate = (from: number, to: number) => from + (to - from) * progress;

  return {
    offset: interpolate(GEOMETRY[lower].offset, GEOMETRY[upper].offset),
    scale: interpolate(GEOMETRY[lower].scale, GEOMETRY[upper].scale),
    opacity: interpolate(GEOMETRY[lower].opacity, GEOMETRY[upper].opacity),
  };
}

function dragStepDistance(wheelHeight: number) {
  return Math.min(60, Math.max(26, wheelHeight * (42 / 581)));
}

/**
 * Normalize every WheelEvent deltaMode to physical wheel-notch units.
 * Common mice emit about 100 pixels or three lines for one detent. Trackpads
 * emit smaller pixel deltas, which are accumulated by the section listener.
 */
function wheelNotches(event: WheelEvent) {
  if (event.deltaMode === 1) return event.deltaY / LINES_PER_WHEEL_NOTCH;
  if (event.deltaMode === 2) return event.deltaY;
  return event.deltaY / PIXELS_PER_WHEEL_NOTCH;
}

function easeOutQuart(progress: number) {
  return 1 - (1 - progress) ** 4;
}

export function ManualModeSection() {
  const [position, setPosition] = useState(DEFAULT_INDEX);
  const [visualPosition, setVisualPosition] = useState(DEFAULT_INDEX);
  const [dragging, setDragging] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(DEFAULT_INDEX);
  const reducedMotionRef = useRef(false);
  const cancelWheelInputRef = useRef<() => void>(() => undefined);
  const readyFramesRef = useRef(STOPS.map(() => false));
  const decodingFramesRef = useRef(STOPS.map(() => false));
  const pendingVisualPositionRef = useRef(DEFAULT_INDEX);
  const visualPositionRef = useRef(DEFAULT_INDEX);
  const visualTargetRef = useRef(DEFAULT_INDEX);
  const visualAnimationFrameRef = useRef<number | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    pointerType: string;
    startX: number;
    startY: number;
    startPosition: number;
    step: number;
    moved: boolean;
  } | null>(null);

  const selectedIndex = Math.round(position);
  const frameBase = Math.floor(visualPosition);
  const frameFraction = visualPosition - frameBase;

  const cancelVisualAnimation = useCallback(() => {
    if (visualAnimationFrameRef.current !== null) {
      cancelAnimationFrame(visualAnimationFrameRef.current);
      visualAnimationFrameRef.current = null;
    }
  }, []);

  const commitVisualPosition = useCallback((nextPosition: number) => {
    visualPositionRef.current = nextPosition;
    setVisualPosition(nextPosition);
  }, []);

  const queueVisualPosition = useCallback(
    (nextPosition: number) => {
      const target = clampPosition(nextPosition);
      pendingVisualPositionRef.current = target;

      // A multi-stop animation passes through every frame between the currently
      // visible pair and its target. Keep the last decoded composite on screen
      // until that entire path is ready, not only the destination frame.
      const current = visualPositionRef.current;
      const firstRequiredFrame = Math.floor(Math.min(current, target));
      const lastRequiredFrame = Math.ceil(Math.max(current, target));
      for (let index = firstRequiredFrame; index <= lastRequiredFrame; index += 1) {
        if (!readyFramesRef.current[index]) return;
      }

      const changeImmediately = reducedMotionRef.current || dragRef.current?.moved === true;
      if (changeImmediately || Math.abs(target - current) < 0.0001) {
        cancelVisualAnimation();
        visualTargetRef.current = target;
        commitVisualPosition(target);
        return;
      }

      // Decoding another eager frame can retry the pending target. Do not
      // restart an animation that is already travelling to that same target.
      if (
        visualAnimationFrameRef.current !== null &&
        visualTargetRef.current === target
      ) {
        return;
      }

      // Retarget from the exact rendered position, so rapid wheel, keyboard or
      // tap input is safely interruptible without an opacity jump.
      cancelVisualAnimation();
      visualTargetRef.current = target;
      const animationStart = performance.now();
      const animationFrom = visualPositionRef.current;

      const animate = (now: number) => {
        const progress = Math.min(1, (now - animationStart) / FRAME_DISSOLVE_MS);
        const nextVisualPosition =
          animationFrom + (target - animationFrom) * easeOutQuart(progress);
        commitVisualPosition(progress === 1 ? target : nextVisualPosition);

        if (progress < 1) {
          visualAnimationFrameRef.current = requestAnimationFrame(animate);
        } else {
          visualAnimationFrameRef.current = null;
        }
      };

      visualAnimationFrameRef.current = requestAnimationFrame(animate);
    },
    [cancelVisualAnimation, commitVisualPosition],
  );

  useEffect(() => cancelVisualAnimation, [cancelVisualAnimation]);

  const markFrameReady = useCallback(
    (index: number) => {
      readyFramesRef.current[index] = true;
      queueVisualPosition(pendingVisualPositionRef.current);
    },
    [queueVisualPosition],
  );

  const prepareFrame = useCallback(
    (image: HTMLImageElement, index: number) => {
      if (
        readyFramesRef.current[index] ||
        decodingFramesRef.current[index] ||
        !image.complete ||
        image.naturalWidth === 0
      ) {
        return;
      }

      if (typeof image.decode !== "function") {
        markFrameReady(index);
        return;
      }

      decodingFramesRef.current[index] = true;
      void image.decode().then(
        () => {
          decodingFramesRef.current[index] = false;
          markFrameReady(index);
        },
        () => {
          // `load`/`complete` already proved the resource is usable. Some older
          // engines reject decode() for an image they have already rasterized.
          decodingFramesRef.current[index] = false;
          markFrameReady(index);
        },
      );
    },
    [markFrameReady],
  );

  const updatePosition = useCallback(
    (next: number | ((current: number) => number)) => {
      const resolved = typeof next === "function" ? next(positionRef.current) : next;
      const clamped = clampPosition(resolved);
      positionRef.current = clamped;
      setPosition(clamped);
      queueVisualPosition(clamped);
    },
    [queueVisualPosition],
  );

  const updateIndex = useCallback(
    (next: number | ((current: number) => number)) => {
      updatePosition((currentPosition) => {
        const currentIndex = Math.round(currentPosition);
        return typeof next === "function" ? next(currentIndex) : next;
      });
    },
    [updatePosition],
  );

  // A cached image can finish before hydration attaches its `load` handler.
  // Checking `complete` after mount closes that race while onLoad covers normal
  // network arrivals. The old decoded frame remains visible until both frames
  // needed by a dissolve are ready.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    for (const image of section.querySelectorAll<HTMLImageElement>(".s2ManualFrame")) {
      const index = Number(image.dataset.index ?? -1);
      if (index >= 0 && index < STOPS.length) prepareFrame(image, index);
    }
  }, [prepareFrame]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      cancelWheelInputRef.current();
      reducedMotionRef.current = media.matches;
      setReducedMotion(media.matches);
      if (media.matches) cancelVisualAnimation();
      queueVisualPosition(pendingVisualPositionRef.current);
    };
    syncPreference();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", syncPreference);
      return () => media.removeEventListener("change", syncPreference);
    }

    // Safari versions predating MediaQueryListEvent still use this API.
    media.addListener(syncPreference);
    return () => media.removeListener(syncPreference);
  }, [cancelVisualAnimation, queueVisualPosition]);

  /**
   * The whole desktop section acts as the wheel target. Seven ordinary mouse
   * detents visit all seven frames when starting at an end: each detent yields
   * one discrete stop, while high-resolution trackpad deltas accumulate. A
   * short throttle prevents momentum packets from causing several React state
   * changes in one visual beat. Once the picker reaches either end, an outward
   * wheel packet is released immediately so the same continuous gesture can
   * carry on scrolling the page; reversing direction still controls the picker.
   */
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const desktopPointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let accumulator = 0;
    let accumulatorDirection = 0;
    let lastInputAt = 0;
    let lastStepAt = -Infinity;
    let drainTimer: ReturnType<typeof setTimeout> | null = null;

    const clearQueuedSteps = () => {
      if (drainTimer !== null) clearTimeout(drainTimer);
      drainTimer = null;
      accumulator = 0;
      accumulatorDirection = 0;
    };

    const resetWheel = () => {
      clearQueuedSteps();
      lastInputAt = 0;
    };
    cancelWheelInputRef.current = resetWheel;

    const scheduleDrain = () => {
      if (drainTimer !== null || Math.abs(accumulator) < 1) return;
      const delay = Math.max(0, WHEEL_STEP_THROTTLE_MS - (performance.now() - lastStepAt));
      if (delay === 0) {
        drainWheel();
        return;
      }
      drainTimer = setTimeout(() => {
        drainTimer = null;
        drainWheel();
      }, delay);
    };

    const drainWheel = () => {
      if (Math.abs(accumulator) < 1) return;
      const direction = accumulator > 0 ? 1 : -1;
      const currentIndex = Math.round(positionRef.current);
      const canMove = direction > 0 ? currentIndex < STOPS.length - 1 : currentIndex > 0;

      if (!canMove) {
        // The picker has reached an end. Discard any queued overshoot so the
        // next outward packet is free to continue scrolling the document.
        clearQueuedSteps();
        return;
      }

      updateIndex(currentIndex + direction);
      accumulator -= direction;
      lastStepAt = performance.now();
      scheduleDrain();
    };

    const onWheel = (event: WheelEvent) => {
      if (
        !desktopPointer.matches ||
        dragRef.current ||
        event.ctrlKey ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ) {
        return;
      }

      const normalized = wheelNotches(event);
      if (!Number.isFinite(normalized) || normalized === 0) return;

      const direction = normalized > 0 ? 1 : -1;
      const now = performance.now();
      const idle = lastInputAt === 0 || now - lastInputAt >= WHEEL_IDLE_RESET_MS;
      const directionChanged =
        accumulatorDirection !== 0 && accumulatorDirection !== direction;

      const currentIndex = Math.round(positionRef.current);

      if (reducedMotionRef.current) {
        if (directionChanged || (idle && Math.abs(accumulator) < 1)) {
          clearQueuedSteps();
        }
        accumulatorDirection = direction;
        lastInputAt = now;

        const remainingSteps =
          direction > 0 ? STOPS.length - 1 - currentIndex : currentIndex;
        const availableQueueCapacity = Math.max(0, remainingSteps - Math.abs(accumulator));
        if (availableQueueCapacity === 0) return;

        accumulator +=
          direction * Math.min(availableQueueCapacity, Math.abs(normalized));
        const immediateSteps = Math.trunc(accumulator);
        if (immediateSteps !== 0) {
          updateIndex(currentIndex + immediateSteps);
          accumulator -= immediateSteps;
          lastStepAt = now;
        }
        // Reduced-motion keeps the wheel mapping but never holds the document
        // or queues a timed visual sequence: the selected frame changes at once
        // while the page continues its native scroll.
        return;
      }

      const remainingSteps =
        direction > 0 ? STOPS.length - 1 - currentIndex : currentIndex;

      if (remainingSteps === 0) {
        // Never scroll-lock the visitor at 01 or 25. Clearing queued picker
        // work and leaving this event uncancelled lets mouse-wheel and trackpad
        // momentum continue natively into the surrounding page immediately.
        resetWheel();
        return;
      }

      if (directionChanged || (idle && Math.abs(accumulator) < 1)) {
        clearQueuedSteps();
      }

      accumulatorDirection = direction;
      lastInputAt = now;

      const availableQueueCapacity = Math.max(0, remainingSteps - Math.abs(accumulator));

      // A full queue still belongs to the active gesture. Preventing here is
      // what stops the momentum tail from moving both picker and page.
      event.preventDefault();
      if (availableQueueCapacity === 0) return;

      // Browsers may combine several physical detents into one WheelEvent. Keep
      // that magnitude, then drain it one stop per throttle interval rather
      // than treating a delta of 600px as the same input as a delta of 100px.
      accumulator +=
        direction * Math.min(availableQueueCapacity, Math.abs(normalized));
      scheduleDrain();
    };

    section.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      section.removeEventListener("wheel", onWheel);
      resetWheel();
      cancelWheelInputRef.current = () => undefined;
    };
  }, [updateIndex]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const stepByKey: Partial<Record<string, number>> = {
        ArrowLeft: -1,
        ArrowUp: -1,
        ArrowRight: 1,
        ArrowDown: 1,
        PageUp: -2,
        PageDown: 2,
      };

      if (event.key === "Home") {
        event.preventDefault();
        cancelWheelInputRef.current();
        updateIndex(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        cancelWheelInputRef.current();
        updateIndex(STOPS.length - 1);
        return;
      }

      const delta = stepByKey[event.key];
      if (delta === undefined) return;
      event.preventDefault();
      cancelWheelInputRef.current();
      updateIndex((current) => current + delta);
    },
    [updateIndex],
  );

  /** Mouse and touch share pointer capture, so drag, swipe and tap agree. */
  useEffect(() => {
    const node = wheelRef.current;
    if (!node) return;

    const onPointerDown = (event: PointerEvent) => {
      if (dragRef.current) return;
      if (!event.isPrimary) return;
      if (event.button !== 0 && event.pointerType === "mouse") return;

      cancelWheelInputRef.current();
      dragRef.current = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startX: event.clientX,
        startY: event.clientY,
        startPosition: positionRef.current,
        step: dragStepDistance(node.getBoundingClientRect().height),
        moved: false,
      };
      node.focus({ preventScroll: true });
      node.setPointerCapture(event.pointerId);
      if (event.pointerType !== "touch" && event.cancelable) event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      // A mouse follows the visible vertical rail. Touch uses a horizontal
      // swipe so a vertical gesture that begins on the control can still scroll
      // the page (`touch-action: pan-y` below); tapping any visible stop remains
      // available on both input types.
      const touch = drag.pointerType === "touch";
      const travel = touch ? event.clientX - drag.startX : event.clientY - drag.startY;
      const crossAxisTravel = touch
        ? event.clientY - drag.startY
        : event.clientX - drag.startX;
      if (!drag.moved && touch && Math.abs(crossAxisTravel) >= Math.abs(travel)) return;
      if (!drag.moved && Math.abs(travel) <= 4) return;

      if (!drag.moved) {
        drag.moved = true;
        setDragging(true);
      }
      if (event.cancelable) event.preventDefault();
      const nextPosition = drag.startPosition - travel / drag.step;
      updatePosition(reducedMotionRef.current ? Math.round(nextPosition) : nextPosition);
    };

    const finishPointer = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      dragRef.current = null;
      if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);

      if (drag.moved) {
        setDragging(false);
        const nextIndex =
          event.type === "pointerup"
            ? Math.round(positionRef.current)
            : Math.round(drag.startPosition);
        updateIndex(nextIndex);
        return;
      }

      setDragging(false);
      if (event.type !== "pointerup") return;

      // Options deliberately do not own pointer events: resolving the nearest
      // visible option here makes the entire track draggable and clickable.
      let nearestIndex = -1;
      let nearestDistance = Infinity;
      for (const option of node.querySelectorAll<HTMLElement>(".s2WheelOption")) {
        if (Number(getComputedStyle(option).opacity) < 0.25) continue;
        const bounds = option.getBoundingClientRect();
        const distance = Math.abs(bounds.top + bounds.height / 2 - drag.startY);
        if (distance >= nearestDistance) continue;
        nearestDistance = distance;
        nearestIndex = Number(option.dataset.index ?? -1);
      }
      if (nearestIndex >= 0) updateIndex(nearestIndex);
    };

    node.addEventListener("pointerdown", onPointerDown, { passive: false });
    node.addEventListener("pointermove", onPointerMove, { passive: false });
    node.addEventListener("pointerup", finishPointer);
    node.addEventListener("pointercancel", finishPointer);
    node.addEventListener("lostpointercapture", finishPointer);

    return () => {
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", finishPointer);
      node.removeEventListener("pointercancel", finishPointer);
      node.removeEventListener("lostpointercapture", finishPointer);
    };
  }, [updateIndex, updatePosition]);

  return (
    <section
      ref={sectionRef}
      className="s2 s2Manual"
      aria-labelledby="manual-title"
      data-index={selectedIndex}
      data-value={STOPS[selectedIndex].value}
    >
      <div className="s2ManualScroller">
        <div className="s2ManualPin">
          <div
            className="s2ManualGrid"
            data-dragging={dragging}
            data-index={selectedIndex}
            data-reduced-motion={reducedMotion}
          >
            <div className="s2ManualIntro">
              <h2 id="manual-title" className="s2ManualName">
                Manual
                <br />
                Mode
              </h2>
              <p className="s2ManualCopy">
                <b>
                  Any Length. Zero<span className="s2ManualMobileBreak" /> Attachments.
                </b>{" "}
                Every Detail<span className="s2ManualMobileBreak" /> Designed Around Your Daily
                <span className="s2ManualMobileBreak" /> Routine.
              </p>
            </div>

            <div
              className="s2ManualDevice"
              data-index={selectedIndex}
              data-value={STOPS[selectedIndex].value}
            >
              {STOPS.map((stop, index) => {
                // Keep the lower frame opaque while the upper frame fades in.
                // Because the source frames have black backgrounds, this avoids
                // the dark dip that two half-transparent images would create.
                const opacity =
                  index === frameBase ? 1 : index === frameBase + 1 ? frameFraction : 0;

                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={stop.value}
                    className="s2ManualFrame"
                    src={stop.image}
                    alt={index === selectedIndex ? `GLYDE Manual Mode setting ${stop.value}` : ""}
                    loading="eager"
                    fetchPriority={index === DEFAULT_INDEX ? "high" : "auto"}
                    decoding="async"
                    draggable={false}
                    onLoad={(event: ReactSyntheticEvent<HTMLImageElement>) => {
                      prepareFrame(event.currentTarget, index);
                    }}
                    aria-hidden={index !== selectedIndex}
                    data-index={index}
                    data-value={stop.value}
                    data-active={index === selectedIndex}
                    style={{
                      opacity,
                      // `visualPosition` performs the dissolve itself. Keeping
                      // CSS interpolation off guarantees one fully opaque base
                      // frame at every RAF, avoiding the two-layer 75% dark dip.
                      transition: "none",
                    }}
                  />
                );
              })}
            </div>

            <div
              ref={wheelRef}
              className="s2Wheel"
              role="listbox"
              tabIndex={0}
              aria-label="Manual blade length setting"
              aria-orientation="vertical"
              aria-activedescendant={`manual-blade-${STOPS[selectedIndex].value}`}
              aria-describedby="manual-picker-instructions manual-picker-status"
              aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown PageUp PageDown Home End"
              data-index={selectedIndex}
              data-value={STOPS[selectedIndex].value}
              onKeyDown={onKeyDown}
              style={{ touchAction: "pan-y" }}
            >
              {STOPS.map((stop, index) => {
                const distance = index - position;
                const { offset, scale, opacity } = placement(distance);
                const direction = distance === 0 ? 0 : distance > 0 ? 1 : -1;

                return (
                  <div
                    key={stop.value}
                    id={`manual-blade-${stop.value}`}
                    className="s2WheelOption"
                    role="option"
                    aria-label={`Setting ${stop.value} millimeters`}
                    aria-selected={index === selectedIndex}
                    data-index={index}
                    data-value={stop.value}
                    data-active={index === selectedIndex}
                    style={{
                      opacity,
                      transform: `translateY(calc(-50% + ${direction * offset} * var(--wheel-unit))) scale(${scale})`,
                      transition: reducedMotion ? "none" : undefined,
                    }}
                  >
                    {stop.value}
                  </div>
                );
              })}

              <span className="s2WheelUnit" aria-hidden="true">
                mm
              </span>
            </div>
            <span id="manual-picker-instructions" className="srOnly">
              Drag, swipe sideways, or select a setting. Use the arrow keys to change it,
              Page Up or Page Down to skip two settings, Home for the first setting, and End
              for the last setting.
            </span>
            <span id="manual-picker-status" className="srOnly" aria-live="polite" aria-atomic="true">
              Setting {STOPS[selectedIndex].value} millimeters selected.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
