import { testimonials } from "@/lib/content";

// Testimonials — rebuilt from the current desktop/mobile landing-page frames.
// Four 351×364 cards from x228 with a 21px gap, centred on the 1920 grid.

export function TestimonialsSection() {
  return (
    <section className="s2 s2Quotes" aria-labelledby="testimonials-title">
      <p className="s2QuotesEyebrow">What Users Say</p>
      <h2 id="testimonials-title" className="s2QuotesTitle">
        See Why Customers <span className="s2Accent">Love GLYDE.</span>
      </h2>

      <div className="s2QuotesGrid">
        {testimonials.map((quote, index) => {
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
                <img src={`/assets/v3/avatar-${index + 1}.png`} alt="" loading="lazy" />
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
