import { testimonials } from "@/lib/content";

// "Don't Take Our Word For It" — rebuilt from Figma node 497-283.
// Four 351×364 cards from x228 with a 21px gap, centred on the 1920 grid.

const ASSETS = "/assets/figma";

export function TestimonialsSection() {
  return (
    <section className="s2 s2Quotes" aria-labelledby="testimonials-title">
      <p className="s2QuotesEyebrow">What Users Say</p>
      <h2 id="testimonials-title" className="s2QuotesTitle">
        Don&apos;t Take Our <span className="s2Accent">Word For It</span>.
      </h2>

      <div className="s2QuotesGrid">
        {testimonials.map((quote) => {
          const filled = quote.rating;
          return (
            <article className="s2QuoteCard" key={quote.id}>
              <div
                className="s2QuoteStars"
                role="img"
                aria-label={`${filled} out of 5 stars`}
              >
                {Array.from({ length: 5 }, (_, star) => (
                  <span key={star} data-off={star >= filled} aria-hidden="true" />
                ))}
              </div>
              <p className="s2QuoteText">{quote.quote}</p>
              <div className="s2QuoteBy">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${ASSETS}/avatar-person.png`} alt="" loading="lazy" />
                <div>
                  <span className="s2QuoteName">{quote.name}</span>
                  <small className="s2QuoteMeta">{quote.meta}</small>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
