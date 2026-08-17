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

export function ManualModeSection() {
  const [index, setIndex] = useState(DEFAULT_INDEX);
  const wheelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startIndex: number } | null>(null);
  const wheelAccum = useRef(0);

  const clamp = (n: number) => Math.max(0, Math.min(VALUES.length - 1, n));

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
      dragRef.current = { startY: event.clientY, startIndex: index };
      node.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      event.preventDefault();
      // 126px is one step at the centre of the wheel.
      const steps = Math.round((event.clientY - drag.startY) / 42);
      setIndex(clamp(drag.startIndex - steps));
    };

    const endDrag = (event: PointerEvent) => {
      dragRef.current = null;
      if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    node.addEventListener("pointerdown", onPointerDown);
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
  }, [index]);

  return (
    <section className="s2 s2Manual" aria-labelledby="manual-title">
      <div className="s2ManualGrid">
        <div>
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
          onKeyDown={onKeyDown}
        >
          {VALUES.map((value, i) => {
            const { offset, scale, opacity } = placement(i - index);
            const sign = i - index === 0 ? 0 : i > index ? 1 : -1;
            return (
              <div
                key={value}
                id={`blade-${value}`}
                className="s2WheelOption"
                role="option"
                aria-selected={i === index}
                style={{
                  opacity,
                  transform: `translateY(calc(-50% + ${sign * offset} / 1920 * 100vw)) scale(${scale})`,
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
