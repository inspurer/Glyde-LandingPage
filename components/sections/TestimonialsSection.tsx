import { testimonials } from "@/lib/content";

// Testimonials — rebuilt from the current desktop/mobile landing-page frames.
// Both breakpoints keep all four reviews. On mobile the native horizontal rail
// uses Figma 725:319's 351×380 cards, beginning at x60 with a 20px gap on the
// 1080-wide board.

export function TestimonialsSection() {
  return (
    <section className="s2 s2Quotes" aria-labelledby="testimonials-title">
      <p className="s2QuotesEyebrow">What Users Say</p>
      <h2 id="testimonials-title" className="s2QuotesTitle">
        See Why Customers <span className="s2Accent">Love GLYDE.</span>
      </h2>

      <div
        className="s2QuotesGrid"
        role="region"
        aria-label="Customer reviews"
        tabIndex={0}
      >
        {testimonials.map((quote, index) => {
          const filled = quote.rating;
          return (
            <article className="s2QuoteCard" key={quote.id}>
              <div
                className="s2QuoteStars"
                role="img"
                aria-label={`${filled} out of 5 stars`}
                data-rating={filled}
              >
                {Array.from({ length: 5 }, (_, star) => (
                  <span key={star} data-off={star >= filled} aria-hidden="true" />
                ))}
              </div>
              <p className="s2QuoteText">
                {index === 2 ? (
                  <>
                    &quot;<span className="s2QuoteInitial">I</span>
                    {quote.quote.slice(2)}
                  </>
                ) : (
                  quote.quote
                )}
              </p>
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
