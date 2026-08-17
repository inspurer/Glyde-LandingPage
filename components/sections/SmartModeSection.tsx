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
    body: "Browse Styles In The App And Pick What You Want — Or Customize Your Own Look.",
    image: "/assets/v2/smart-01-choose-style.webp",
  },
  {
    n: "02",
    title: "Set The Fade-Band",
    body: "The Fade-Band Is Your Starting Line — It Tells GLYDE Exactly Where The Fade Begins So Every Cut Is Positioned Right.",
    video: "/media/v2/smart-02-fade-band",
  },
  {
    n: "03",
    title: "Start Cutting",
    body: "Turn On GLYDE And Glide Upward — The Blade Adjusts Automatically As You Move.",
    video: "/media/v2/smart-03-start-cutting",
  },
  {
    n: "04",
    title: "Finished Clipping",
    body: "Clean Fade, Every Time. No Barber Needed.",
    video: "/media/v2/smart-04-finished",
  },
];

export function SmartModeSection() {
  return (
    <section className="s2 s2Smart" aria-labelledby="smart-mode-title">
      {/* Two separate runs, as the design has them: the kicker sits on its own
          line ending at x1758, while the sentence below is left-aligned at x920.
          A single right-aligned block cannot produce both. */}
      <header className="s2SmartHead">
        <p className="s2SmartKicker">Just A Few Steps To</p>
        <h2 id="smart-mode-title" className="s2SmartName">
          Smart Mode
        </h2>
        <p className="s2SmartLead">
          <b>A</b> <em>Clean Cut.</em> Every Detail Designed Around Your Daily Routine.
        </p>
      </header>

      <div className="s2SmartGrid">
        {CARDS.map((card) => (
          <article className="s2SmartCard" key={card.n}>
            <div className="s2SmartMedia">
              {card.video ? (
                <LoopingVideo
                  src={card.video}
                  poster={`${card.video}-poster.jpg`}
                  label={card.title}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.image} alt={card.title} loading="lazy" decoding="async" />
              )}
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
