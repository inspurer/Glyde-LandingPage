import { featureCards } from "@/lib/content";

const MEDIA = [
  "/assets/figma/feature-person.png",
  "/assets/figma/feature-device.png",
  "/assets/figma/feature-device.png",
  null,
] as const;

/** Mobile-only section from Figma node 710:281. */
export function BuiltDifferentSection() {
  return (
    <section className="builtDifferent" aria-labelledby="built-different-title">
      <header className="builtDifferentHead">
        <p>8 Ways Different</p>
        <h2 id="built-different-title">
          GLYDE Handles The <em>Hard Parts</em> For You.
        </h2>
      </header>
      <div className="builtDifferentGrid">
        {featureCards.map((card, index) => (
          <article className="builtDifferentCard" key={card.id}>
            {MEDIA[index] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={MEDIA[index]} alt="" loading={index < 2 ? "eager" : "lazy"} decoding="async" />
            ) : null}
            <div>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
