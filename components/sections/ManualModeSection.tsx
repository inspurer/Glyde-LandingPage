"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// "Manual Mode" — rebuilt from Figma node 497-283.
//
// Nine stops, 0.1 to 0.9. The design shows seven at a time, which is what the
// geometry below produces: anything more than three places from the centre is
// scaled and faded out of sight rather than removed, so dragging stays smooth.
//
// The offsets and scales are the design's own, measured off the reference
// export — neighbours sit 126 / 219.5 / 281px from the centre at scale
// .75 / .55 / .3. They match the picker the Shopify theme already ships, which
// is a good sign the design and that component came from the same source.
//
// The centre image swaps with the selection: nine frames of the clipper at each
// blade length, ~10KB each as WebP, all mounted so the swap cannot flash.

const VALUES = ["0.1", "0.2", "0.3", "0.4", "0.5", "0.6", "0.7", "0.8", "0.9"];
const DEFAULT_INDEX = 4; // 0.5, as the design shows

const GEOMETRY = [
  { offset: 0, scale: 1, opacity: 1 },
  { offset: 126, scale: 0.75, opacity: 0.6 },
  { offset: 219.5, scale: 0.55, opacity: 0.3 },
  { offset: 281, scale: 0.3, opacity: 0.3 },
];

/** Interpolated placement for a stop `distance` steps from the centre. */
function placement(distance: number) {
  const d = Math.abs(distance);
  if (d >= GEOMETRY.length - 1) {
    const overflow = d - (GEOMETRY.length - 1);
    return {
      offset: GEOMETRY[3].offset + overflow * 48,
      scale: Math.max(0.16, GEOMETRY[3].scale - overflow * 0.08),
      opacity: Math.max(0, GEOMETRY[3].opacity - overflow * 0.3),
    };
  }
  const lo = Math.floor(d);
  const hi = Math.ceil(d);
  const t = d - lo;
  const mix = (a: number, b: number) => a + (b - a) * t;
  return {
    offset: mix(GEOMETRY[lo].offset, GEOMETRY[hi].offset),
    scale: mix(GEOMETRY[lo].scale, GEOMETRY[hi].scale),
    opacity: mix(GEOMETRY[lo].opacity, GEOMETRY[hi].opacity),
  };
}

/**
 * Pixels of drag per stop.
 *
 * The design's wheel is 581px tall and one stop is 42px of travel, so the ratio
 * is the constant below. On a phone that ratio comes out at ~23px, which is
 * finer than a fingertip can aim, so it is floored; desktop lands on 42 either
 * way, which is what it has always been.
 */
function stepDistance(wheelHeight: number) {
  return Math.min(60, Math.max(26, wheelHeight * (42 / 581)));
}

export function ManualModeSection() {
  // Fractional while a drag is in flight: the wheel follows the finger
  // continuously and snaps on release. A threshold with no movement until it is
  // crossed reads as a dead control on a phone — nothing happens for the first
  // 30px, so the gesture feels like it was not picked up at all. `placement`
  // already interpolates between stops, so a fractional position renders for
  // free. The committed selection is this value rounded.
  const [position, setPosition] = useState(DEFAULT_INDEX);
  const [dragging, setDragging] = useState(false);
  const index = Math.round(position);

  const wheelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startY: number;
    startPosition: number;
    step: number;
    moved: boolean;
  } | null>(null);
  const wheelAccum = useRef(0);
  // The drag reads the selection at gesture start. Holding it in a ref keeps the
  // listeners off React's render cycle, so they are bound once instead of being
  // torn down and rebuilt on every stop — a swap that used to land mid-gesture.
  const positionRef = useRef(DEFAULT_INDEX);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const clamp = (n: number) => Math.max(0, Math.min(VALUES.length - 1, n));
  const setIndex = (next: number | ((current: number) => number)) =>
    setPosition((current) =>
      typeof next === "function" ? next(Math.round(current)) : next,
    );

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    const step: Record<string, number> = {
      ArrowUp: -1,
      ArrowDown: 1,
      PageUp: -2,
      PageDown: 2,
    };
    if (event.key === "Home") {
      event.preventDefault();
      setIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setIndex(VALUES.length - 1);
      return;
    }
    const delta = step[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    setIndex((current) => clamp(current + delta));
  }, []);

  // Wheel and drag are attached natively rather than through React props so the
  // listeners can be non-passive; a passive handler cannot preventDefault, and
  // without that the page scrolls away underneath the picker.
  useEffect(() => {
    const node = wheelRef.current;
    if (!node) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      wheelAccum.current += event.deltaY;
      if (Math.abs(wheelAccum.current) < 40) return;
      const direction = wheelAccum.current > 0 ? 1 : -1;
      wheelAccum.current = 0;
      setIndex((current) => clamp(current + direction));
    };

    const onPointerDown = (event: PointerEvent) => {
      dragRef.current = {
        startY: event.clientY,
        startPosition: positionRef.current,
        step: stepDistance(node.getBoundingClientRect().height),
        moved: false,
      };
      node.setPointerCapture(event.pointerId);
      setDragging(true);
      // Stops the long-press text/callout selection a finger triggers on the
      // digits, which otherwise aborts the drag on its way in.
      if (event.cancelable) event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (event.cancelable) event.preventDefault();
      const travel = event.clientY - drag.startY;
      if (Math.abs(travel) > 4) drag.moved = true;
      // Fractional, so the digits move with the finger from the first pixel
      // rather than jumping once a threshold is crossed.
      setPosition(clamp(drag.startPosition - travel / drag.step));
    };

    const endDrag = (event: PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      setDragging(false);
      if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
      // Settle on a stop; the transition returns with `dragging` cleared, so
      // this last hop is animated even though the drag itself was not.
      if (drag?.moved) setPosition((current) => Math.round(current));

      // A tap, not a drag. Reaching for the number you want is the first thing a
      // phone user tries, and the options themselves cannot receive the tap —
      // they are `pointer-events: none` so they never interrupt a drag — so the
      // wheel resolves it here by picking whichever option was closest.
      //
      // Measured against the pointerdown position, not this event's: a tap has
      // not moved by definition, and a touch-generated pointerup does not
      // reliably carry the release coordinates.
      if (!drag || drag.moved || event.type !== "pointerup") return;
      let nearest = -1;
      let best = Infinity;
      for (const option of node.querySelectorAll<HTMLElement>(".s2WheelOption")) {
        // Skip what the geometry has faded out: those stops are invisible, and
        // one of them is always the closest to a tap near the wheel's edge.
        if (Number(getComputedStyle(option).opacity) < 0.25) continue;
        const box = option.getBoundingClientRect();
        const distance = Math.abs(box.top + box.height / 2 - drag.startY);
        if (distance < best) {
          best = distance;
          nearest = VALUES.indexOf(option.textContent?.trim() ?? "");
        }
      }
      if (nearest >= 0) setIndex(nearest);
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    node.addEventListener("pointerdown", onPointerDown, { passive: false });
    node.addEventListener("pointermove", onPointerMove, { passive: false });
    node.addEventListener("pointerup", endDrag);
    node.addEventListener("pointercancel", endDrag);

    return () => {
      node.removeEventListener("wheel", onWheel);
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", endDrag);
      node.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  return (
    <section className="s2 s2Manual" aria-labelledby="manual-title">
      <div className="s2ManualGrid">
        {/* The phone layout puts the heading, the device and the copy in three
            separate grid rows. This wrapper would be the grid item instead of
            its two children, so `display: contents` on it below 900px promotes
            them; without that the copy landed above the device and the row the
            grid had reserved for it stayed empty. */}
        <div className="s2ManualIntro">
          <h2 id="manual-title" className="s2ManualName">
            Manual
            <br />
            Mode
          </h2>
          <p className="s2ManualCopy">
            <b>Any Length. Zero Attachments.</b> Every Detail Designed Around Your Daily Routine.
          </p>
        </div>

        <div className="s2ManualDevice">
          {VALUES.map((value, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={value}
              src={`/assets/v2/blade/${value}.webp`}
              alt={i === index ? `GLYDE blade set to ${value} inches` : ""}
              data-active={i === index}
              loading={i === DEFAULT_INDEX ? "eager" : "lazy"}
              decoding="async"
              aria-hidden={i !== index}
            />
          ))}
        </div>

        <div
          ref={wheelRef}
          className="s2Wheel"
          role="listbox"
          tabIndex={0}
          aria-label="Blade length in inches"
          aria-activedescendant={`blade-${VALUES[index]}`}
          data-dragging={dragging}
          onKeyDown={onKeyDown}
        >
          {VALUES.map((value, i) => {
            // Against the fractional position, not the rounded index: this is
            // what lets the stack follow the finger between stops.
            const distance = i - position;
            const { offset, scale, opacity } = placement(distance);
            const sign = distance === 0 ? 0 : distance > 0 ? 1 : -1;
            return (
              <div
                key={value}
                id={`blade-${value}`}
                className="s2WheelOption"
                role="option"
                aria-selected={i === index}
                style={{
                  opacity,
                  // `--wheel-unit` is one unit of the design's 1920 grid. On
                  // desktop that is literally 1/1920 of the viewport; on a phone
                  // the stylesheet reties it to the wheel's own height, because
                  // scaling these offsets by viewport width there collapses all
                  // nine digits into a 140px pile.
                  transform: `translateY(calc(-50% + ${sign * offset} * var(--wheel-unit))) scale(${scale})`,
                }}
              >
                {value}
              </div>
            );
          })}
          <span className="s2WheelUnit" aria-hidden="true">
            Inch
          </span>
        </div>
      </div>
    </section>
  );
}
