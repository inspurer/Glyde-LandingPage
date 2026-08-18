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
// The centre image follows the selection: nine frames of the clipper at each
// blade length, ~10KB each as WebP, all mounted so a change never waits on a
// decode. They dissolve rather than swap, driven by the same fractional
// position the wheel uses, so dragging reads as one continuous change of length
// instead of a series of cuts between stills.

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
  // The two frames the device image dissolves between, and how far along.
  const base = Math.floor(position);
  const fraction = position - base;

  const wheelRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startY: number;
    startPosition: number;
    step: number;
    moved: boolean;
    touch: boolean;
  } | null>(null);
  // The drag reads the selection at gesture start. Holding it in a ref keeps the
  // listeners off React's render cycle, so they are bound once instead of being
  // torn down and rebuilt on every stop — a swap that used to land mid-gesture.
  const positionRef = useRef(DEFAULT_INDEX);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const clamp = (n: number) => Math.max(0, Math.min(VALUES.length - 1, n));

  // Scroll drives the blade length while the section is pinned.
  //
  // The section is a runway one viewport taller than its content, with the
  // content stuck to the top of it. Scrolling through that extra height does
  // not move the content — it moves the value, 0.1 through 0.9, and the page
  // carries on normally once the far end is reached.
  //
  // Done with `position: sticky` and a read of where the runway sits, rather
  // than by capturing wheel and touch events and holding the page still. The
  // page is never actually blocked, so this reverses when scrolled back up,
  // behaves the same for a wheel, a trackpad, a finger, a keyboard or a
  // scrollbar drag, and cannot strand anyone inside the section.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const update = () => {
      const runway = scroller.offsetHeight - window.innerHeight;
      if (runway <= 0) return;
      const top = scroller.getBoundingClientRect().top;
      // Above the section it holds the design's default; the hop from there to
      // 0.1 as it engages is the transition doing its job, not a jump.
      // Rounded to whole stops rather than scrubbed continuously. A fractional
      // position leaves the wheel parked between two numbers for most of the
      // runway, and the "Inch" label is pinned to the wheel's centre, so it
      // drifts off whichever digit is emphasised. Stepping also reads the way
      // the value actually behaves — 0.1, 0.2, 0.3 — with the existing
      // transitions easing each hop.
      const next = top > 0
        ? DEFAULT_INDEX
        : Math.round(clamp((-top / runway) * (VALUES.length - 1)));
      // Re-rendering on every scroll event would be wasteful for a change too
      // small to see.
      if (Math.abs(next - positionRef.current) < 0.005) return;
      setPosition(next);
    };

    update();
    // Deliberately not rAF-throttled: rAF does not fire in a background tab, so
    // a "pending frame" flag set just before the tab is hidden never clears and
    // the handler goes silent for the rest of the page's life. One rect read
    // per scroll event is cheap enough not to need the guard.
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
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

  // Attached natively rather than through React props so the move listener can
  // be non-passive: a passive handler cannot preventDefault, and a mouse drag
  // needs that to stop the browser turning it into a text selection.
  useEffect(() => {
    const node = wheelRef.current;
    if (!node) return;

    const onPointerDown = (event: PointerEvent) => {
      const touch = event.pointerType === "touch";
      dragRef.current = {
        startY: event.clientY,
        startPosition: positionRef.current,
        step: stepDistance(node.getBoundingClientRect().height),
        moved: false,
        touch,
      };
      // A finger dragging this and a finger scrolling the page are the same
      // gesture on the same axis, and there is no way to tell them apart in
      // time. The page wins: a touch here is only ever a tap, resolved on
      // pointerup below. Dragging stays on the mouse, where it costs the page
      // nothing because a held button is unambiguous.
      if (touch) return;
      node.setPointerCapture(event.pointerId);
      setDragging(true);
      // Stops the long-press text/callout selection the digits otherwise
      // trigger, which would abort the drag on its way in.
      if (event.cancelable) event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.touch) {
        // Not adjusting anything — only noting that the finger travelled, so a
        // page scroll that started here is not mistaken for a tap on release.
        if (Math.abs(event.clientY - drag.startY) > 8) drag.moved = true;
        return;
      }
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

    node.addEventListener("pointerdown", onPointerDown, { passive: false });
    node.addEventListener("pointermove", onPointerMove, { passive: false });
    node.addEventListener("pointerup", endDrag);
    node.addEventListener("pointercancel", endDrag);

    return () => {
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", endDrag);
      node.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  return (
    <section className="s2 s2Manual" aria-labelledby="manual-title">
      <div className="s2ManualScroller" ref={scrollerRef}>
        <div className="s2ManualPin">
          <div className="s2ManualGrid" data-dragging={dragging}>
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
          {VALUES.map((value, i) => {
            // A true dissolve rather than a swap. The frame below the current
            // position stays fully opaque and only the one above it fades in, by
            // exactly the fraction the wheel has travelled — stacking two
            // half-transparent frames instead would dim the composite through
            // the middle of every transition. DOM order does the rest: image
            // i+1 already paints above image i, so no z-index is needed.
            const opacity = i === base ? 1 : i === base + 1 ? fraction : 0;
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={value}
                src={`/assets/v2/blade/${value}.webp`}
                alt={i === index ? `GLYDE blade set to ${value} inches` : ""}
                style={{ opacity }}
                loading={i === DEFAULT_INDEX ? "eager" : "lazy"}
                decoding="async"
                aria-hidden={i !== index}
              />
            );
          })}
        </div>

        <div
          ref={wheelRef}
          className="s2Wheel"
          role="listbox"
          tabIndex={0}
          aria-label="Blade length in inches"
          aria-activedescendant={`blade-${VALUES[index]}`}
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
        </div>
      </div>
    </section>
  );
}
