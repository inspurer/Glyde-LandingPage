import { LoopingVideo } from "./LoopingVideo";

// "Smart Mode" — rebuilt from Figma node 497-283.
//
// Four 420×520 cards from x78 with a 21px gap. The first is a still of the app
// screen, exported from the design; the other three are the 佩戴发带 / 上推 /
// 整体效果 clips. That pairing was confirmed by matching a frame from each
// video against the design's own card artwork, not by filename alone.

const CARDS = [
  {
    n: "01",
    title: "Choose Style",
    body: "Browse styles in the app and pick what you want — or customize your own look.",
    deviceImage: "/assets/v3/how-to-use-01-device-686-342.png",
    screenImage: "/assets/v3/how-to-use-01-screen-686-373.png",
  },
  {
    n: "02",
    title: "Set the fade-band",
    body: "The fade-band is your starting line — it tells GLYDE exactly where the fade begins so every cut is positioned right.",
    video: "/media/v2/smart-02-fade-band",
    poster: "/assets/v3/how-to-use-02-poster.png",
  },
  {
    n: "03",
    title: "Start cutting",
    body: "Turn on GLYDE and glide upward — the blade adjusts automatically as you move.",
    video: "/media/v2/smart-03-start-cutting",
    poster: "/assets/v3/how-to-use-03-poster.png",
  },
  {
    n: "04",
    title: "Finished clipping",
    body: "Clean fade, every time. No barber needed.",
    video: "/media/v2/smart-04-finished",
    poster: "/assets/v3/how-to-use-04-poster.png",
  },
];

export function SmartModeSection() {
  return (
    <section className="s2 s2Smart" aria-labelledby="smart-mode-title">
      <header className="s2SmartHead s2SmartHeadDesktop">
        <p className="s2SmartDesktopEyebrow">How To Use</p>
        <h2 id="smart-mode-title" className="s2SmartDesktopTitle">
          Just A Few Steps To A <em>Clean Cut.</em>
        </h2>
        <p className="s2SmartDesktopSub">No Training. No Experience. Just Follow Along.</p>
      </header>

      <header className="s2SmartHeadMobile" aria-hidden="true">
        <h2>Smart Mode</h2>
        <p>Just A Few Steps To</p>
        <strong>
          A <em>Clean Cut.</em> Every Detail Designed Around Your Daily Routine.
        </strong>
      </header>

      <div className="s2SmartGrid">
        {CARDS.map((card) => (
          <article className="s2SmartCard" key={card.n}>
            <div
              className={`s2SmartMedia${"deviceImage" in card ? " s2SmartMediaComposite" : ""}`}
            >
              {"deviceImage" in card ? (
                <>
                  {/* Figma 686:342: adjusted transparent hand/device layer. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="s2SmartDeviceLayer"
                    src={card.deviceImage}
                    alt={card.title}
                    loading="lazy"
                    decoding="async"
                  />
                  {/* Figma 686:373, clipped by the exact phone-screen mask. */}
                  <span className="s2SmartScreenMask" aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="s2SmartScreenLayer"
                      src={card.screenImage}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  </span>
                </>
              ) : card.video ? (
                <LoopingVideo
                  src={card.video}
                  poster={card.poster}
                  label={card.title}
                />
              ) : null}
            </div>
            <div className="s2SmartCopy">
              <span className="s2SmartNum">{card.n}</span>
              <h3 className="s2SmartTitle">{card.title}</h3>
              <p className="s2SmartDesc">{card.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
