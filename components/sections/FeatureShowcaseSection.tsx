const FEATURES = [
  {
    image: "/assets/v3/feature-guided.png",
    title: "Guided As You Move",
    body: "Follow The On-Screen Ball To Maintain The Proper Cutting Position And Angle.",
    className: "featureShowcaseWide",
  },
  {
    image: "/assets/v3/feature-cable.png",
    title: "One Cable. Less Clutter.",
    body: "USB-C Charging Makes It Easy To Power Up At Home Or On The Go.",
    className: "featureShowcaseNarrow",
  },
  {
    image: "/assets/v3/feature-hand.png",
    title: "Shaped For The Hand.",
    body: "Proportions, Balance And Curves Are Designed For A Natural, Secure Grip.",
    className: "featureShowcaseWide",
  },
  {
    image: "/assets/v3/feature-colors.png",
    title: "Made To Match Your Style.",
    body: "Choose From Three Distinctive Finishes.",
    className: "featureShowcaseNarrow",
  },
] as const;

/** The 2×2 product-detail composition in Figma node 685:31. */
export function FeatureShowcaseSection() {
  return (
    <section className="featureShowcase" aria-label="GLYDE product details">
      <div className="featureShowcaseGrid">
        {FEATURES.map((feature) => (
          <article className={`featureShowcaseCard ${feature.className}`} key={feature.title}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={feature.image} alt="" loading="lazy" decoding="async" />
            <div className="featureShowcaseCopy">
              <h2>{feature.title}</h2>
              <p>{feature.body}</p>
            </div>
            {feature.title.startsWith("Made") ? (
              <div className="featureShowcaseSwatches" aria-label="Available in white, silver, and black">
                <i data-color="white" />
                <i data-color="silver" />
                <i data-color="black" />
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
