const FEATURES = [
  {
    desktopImage: "/assets/v3/feature-desktop-guided.png",
    mobileImage: "/assets/v3/feature-mobile-guided.png",
    title: "Guided as you move",
    body: 'Follow the on-screen "guide" to maintain the proper cutting position and angle.',
    className: "featureShowcaseWide",
  },
  {
    desktopImage: "/assets/v3/feature-desktop-cable.png",
    mobileImage: "/assets/v3/feature-mobile-cable.png",
    title: "One cable. Less clutter.",
    body: "USB-C charging makes it easy to power up at home or on the go.",
    className: "featureShowcaseNarrow",
  },
  {
    desktopImage: "/assets/v3/feature-desktop-hand.png",
    mobileImage: "/assets/v3/feature-mobile-hand.png",
    title: "Shaped for the hand.",
    mobileTitle: "Shaped for the hand",
    body: "Proportions, balance and curves are designed for a natural, secure grip.",
    className: "featureShowcaseWide",
  },
  {
    desktopImage: "/assets/v3/feature-desktop-colors.png",
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
