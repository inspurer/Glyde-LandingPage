const FEATURES = [
  {
    desktopImage: "/assets/v3/feature-guided.png",
    mobileImage: "/assets/v3/feature-mobile-guided.png",
    title: "Guided as you move",
    body: 'Follow the on-screen "guide" to maintain the proper cutting position and angle.',
    className: "featureShowcaseWide",
  },
  {
    desktopImage: "/assets/v3/feature-cable.png",
    mobileImage: "/assets/v3/feature-mobile-cable.png",
    title: "One cable. Less clutter.",
    body: "USB-C charging makes it easy to power up at home or on the go.",
    className: "featureShowcaseNarrow",
  },
  {
    desktopImage: "/assets/v3/feature-hand.png",
    // Figma 724:276 is a composite: the 724:278 masked product sits over
    // the card's black 724:277 surface. Exporting 724:278 by itself leaves a
    // light strip across the rounded top edge, so use the complete card crop.
    mobileImage: "/assets/v3/feature-mobile-hand-724-276.png",
    title: "Shaped for the hand.",
    mobileTitle: "Shaped for the hand",
    body: "Proportions, balance and curves are designed for a natural, secure grip.",
    className: "featureShowcaseWide",
  },
  {
    desktopImage: "/assets/v3/feature-colors.png",
    mobileImage: "/assets/v3/feature-mobile-colors.png",
    title: "Made to match your style.",
    body: "Choose from three distinctive finishes.",
    className: "featureShowcaseNarrow",
  },
] as const;

/** The 2×2 product-detail composition in Figma node 685:31. */
export function FeatureShowcaseSection() {
  return (
    <section className="featureShowcase" aria-labelledby="feature-showcase-title">
      <header className="featureShowcaseHead">
        <p>Design &amp; Craft</p>
        <h2 id="feature-showcase-title">
          Built To Feel <em>Right.</em>
        </h2>
        <span>Every Detail Designed Around Your Daily Routine.</span>
      </header>
      <div className="featureShowcaseGrid">
        {FEATURES.map((feature) => (
          <article
            className={`featureShowcaseCard ${feature.className}`}
            key={feature.title}
            aria-label={`${feature.title} ${feature.body}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="featureShowcaseDesktopArt"
              src={feature.desktopImage}
              alt=""
              loading="lazy"
              decoding="async"
            />
            {/* Mobile uses four independently composed 468×480 Figma crops. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="featureShowcaseMobileArt"
              src={feature.mobileImage}
              alt=""
              width={468}
              height={480}
              loading="lazy"
              decoding="async"
            />
            <div className="featureShowcaseCopy">
              <h2>{"mobileTitle" in feature ? feature.mobileTitle : feature.title}</h2>
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
