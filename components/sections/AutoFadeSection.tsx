import { LoopingVideo } from "./LoopingVideo";
import { autoFadeSteps } from "@/lib/content";

// "How Auto-Fade Works" — rebuilt from Figma node 497-283.
//
// The previous version was a phone mock with three step tabs. This one is a
// right-aligned heading over a single full-width video (Figma node 497-326,
// 1759×823, 24px radius) — the studio banner cut.
//
// The footage is delivered 16:9, which is taller than that box. `object-fit:
// cover` would crop it centred in the browser and still pay to decode the rows
// it hides, so the crop is baked into the encode instead — and biased upward,
// because a centred one leaves the GLYDE mark on the cape in the closing shot
// touching the bottom edge.
//
// "Auto-Fade" is painted with a radial gradient rather than a flat colour; see
// .s2AutoFadeTitle em in sections.css.

export function AutoFadeSection() {
  return (
    <section className="s2 s2AutoFade" aria-labelledby="autofade-title">
      <header className="s2AutoFadeHead">
        <p className="s2AutoFadeEyebrow">Inside GLYDE</p>
        <h2 id="autofade-title" className="s2AutoFadeTitle">
          How <em>Auto-Fade</em> Works.{" "}
          <span>From Style Selection To The Final Cut — Here&apos;s What Happens At Every Step.</span>
        </h2>
      </header>

      <div className="s2AutoFadeMedia">
        <LoopingVideo
          src="/media/v2/autofade-wide"
          poster="/media/v2/autofade-wide-poster.jpg"
          label="GLYDE fading the back of a head, then the finished cut"
        />
        <div className="s2AutoFadeMobileArt" aria-hidden="true">
          {/* The mobile board uses the app tutorial inside a hand-held phone,
              while the desktop board keeps the wide cutting footage. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="s2AutoFadeMobileScene"
            src="/assets/figma/autofade-scene.png"
            alt=""
            width={1610}
            height={2000}
            loading="lazy"
            decoding="async"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="s2AutoFadeMobilePhone"
            src="/assets/figma/autofade-phone.png"
            alt=""
            width={1206}
            height={2622}
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>

      <ol className="s2AutoFadeSteps" aria-label="How Auto-Fade works">
        {autoFadeSteps.map((step, index) => (
          <li key={step.number} data-active={index === 0 ? "true" : "false"}>
            <span>{step.number}</span>
            <strong>{step.title}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}
