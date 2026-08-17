import { faqs } from "@/lib/content";
import {
  CONTACT_EMAIL,
  DEPOSIT_URL,
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
} from "@/lib/links";
import { HeroVideo } from "./HeroVideo";
import { WaitlistForm } from "./WaitlistForm";

// This renders the same DOM as theme/sections/glyde-landing.liquid so that
// public/theme/glyde-landing.css and .js — copied verbatim from the Shopify
// theme by `npm run sync:theme` — produce the same page here.
//
// Keep the class names, data- attributes and element order in step with the
// Liquid section. The script binds behaviour through the data- attributes and
// the stylesheet positions several elements absolutely, so a "harmless"
// structural change here can silently break the carousel or the length picker.

const ASSETS = "/assets/figma";

// Plain <img> rather than next/image: the theme ships plain markup and its
// stylesheet already reproduces the fill behaviour the design was signed off
// with. Routing these through the image optimizer would change the geometry.
const FILL_STYLE = { position: "absolute" as const, color: "transparent" };

// Widths measured off the 1920x1080 reference, one per outlet: the row is laid
// out by width, not by a shared height. Forcing a uniform height instead makes
// each mark scale by however much its own artwork was trimmed, and the row
// drifts wider than the design.
const PRESS = [
  { file: "the-verge.png", name: "The Verge", w: 128.3, href: "https://www.theverge.com/tech/854436/would-you-let-ai-cut-your-hair" },
  { file: "fox-news.png", name: "Fox News", w: 150.7, href: "https://www.foxnews.com/tech/ces-2026-showstoppers-10-gadgets-you-have-see" },
  { file: "daily-mail.png", name: "Daily Mail", w: 139.7, href: null },
  { file: "yahoo-finance.png", name: "Yahoo Finance", w: 78.7, href: null },
  { file: "zdnet.png", name: "ZDNet", w: 44.3, href: "https://www.zdnet.com/article/best-weird-tech-ces-2026/" },
  { file: "stuff.png", name: "Stuff", w: 98.0, href: null },
  { file: "euronews.png", name: "euronews", w: 241.7, href: null },
  { file: "upi.png", name: "UPI", w: 47.7, href: null },
];

// Rebuilt from Figma node 433-64. The previous hero — full-bleed photo, a
// "Reserve for $3" header button, the /01 product note, the trust list and the
// four text press links — is replaced wholesale; see public/hero.css for the
// measurements this markup is laid out against.
function Hero() {
  return (
    <section className="heroV2" aria-labelledby="hero-title">
      <HeroVideo />
      <div className="heroV2Scrim" aria-hidden="true" />

      <div className="heroV2Inner">
        <header className="heroV2Header">
          <a href="#top" aria-label="GLYDE home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="heroV2Logo"
              src="/assets/hero/logo-wordmark.png"
              width={1196}
              height={204}
              alt="GLYDE"
              loading="eager"
            />
          </a>
        </header>

        <div className="heroV2Copy">
          <h1 id="hero-title" className="heroV2Title">
            <span>Your first</span>
            <span className="heroV2TitleAccent">perfect fade</span>
            <span>at home</span>
          </h1>
          <p className="heroV2Lead">Auto-fade technology guides every cut. Zero skill needed.</p>
          <p className="heroV2Sub">The World&apos;s First Auto-Fade Clipper</p>

          <div className="heroV2Form formShell">
            <WaitlistForm location="hero" placeholder="Enter your email" />
          </div>
        </div>

        <ul className="heroV2Press" aria-label="Featured in">
          {PRESS.map((outlet) => (
            <li key={outlet.file} style={{ "--press-w": outlet.w } as React.CSSProperties}>
              {outlet.href ? (
                <a href={outlet.href} target="_blank" rel="noreferrer" aria-label={outlet.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/assets/press/${outlet.file}`} alt={outlet.name} loading="eager" />
                </a>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/assets/press/${outlet.file}`} alt={outlet.name} loading="eager" />
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const results = [
  {
    image: "result-person-b.png",
    quote:
      "\"It has saved me much time and money, and is the reason why I have been able to have a good haircut while being a first time father!\"",
    label: null,
  },
  {
    image: "result-person-a.png",
    quote:
      "\"I love that it's easy for me to do on my own, at home and that it saves me money and time. I don't plan on going back to a barber any time soon.\"",
    label: null,
  },
  {
    image: "result-person-b.png",
    quote:
      "\"It has saved me much time and money, and is the reason why I have been able to have a good haircut while being a first time father!\"",
    label: "User Reviews",
  },
];

function ResultsSection() {
  return (
    <section className="section results" aria-labelledby="results-title" data-glyde-results="">
      <header className="sectionHeading resultsHeading">
        <p>Real People, Real Cuts</p>
        <h2 id="results-title">
          See The <em>Results</em>
        </h2>
      </header>
      <div className="resultsToolbar">
        <span aria-live="polite" data-glyde-results-count="">
          01 / 03
        </span>
        <button
          type="button"
          aria-label="Next result"
          aria-controls="haircut-results"
          data-glyde-results-next=""
        >
          Next
        </button>
      </div>
      <div className="resultsViewport" id="haircut-results" aria-label="GLYDE haircut result examples">
        <div
          className="resultsTrack"
          style={{ "--active-result": 0 } as React.CSSProperties}
          data-glyde-results-track=""
        >
          {results.map((result, index) => (
            <article className="resultCard" data-glyde-result="" key={index}>
              <div className="resultPortrait">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${ASSETS}/${result.image}`}
                  alt={`GLYDE haircut result ${index + 1} of 3`}
                  width={864}
                  height={1384}
                  loading="lazy"
                  decoding="async"
                  style={FILL_STYLE}
                />
              </div>
              <div className="resultData">
                <dl>
                  <div>
                    <dt>Mode</dt>
                    <dd>Side and Back Fade</dd>
                  </div>
                  <div>
                    <dt>Mode</dt>
                    <dd>Straight Down</dd>
                  </div>
                  <div>
                    <dt>Haircut duration</dt>
                    <dd>15′24″</dd>
                  </div>
                  <div>
                    <dt>User Experience</dt>
                    <dd>01</dd>
                  </div>
                </dl>
                <blockquote>{result.quote}</blockquote>
                {result.label ? <p className="resultQuoteLabel">{result.label}</p> : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const autoFadeSteps = [
  { number: "01", title: "Choose Style" },
  { number: "02", title: "Smart Sensing" },
  { number: "03", title: "Auto Blade" },
];

function AutoFadeSection() {
  return (
    <section className="section autoFade" aria-labelledby="autofade-title" data-glyde-auto-fade="">
      <header className="sectionHeading rightHeading">
        <p>Inside GLYDE</p>
        <h2 id="autofade-title">
          How <em>Auto-Fade</em> Works.{" "}
          <span>
            From Style Selection To The Final Cut — Here&apos;s What Happens At Every Step.
          </span>
        </h2>
      </header>
      <div className="autoFadeLayout">
        <div className="autoFadeVisual" data-glyde-auto-fade-visual="" data-step="1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="handPhone"
            src={`${ASSETS}/autofade-scene.png`}
            alt="GLYDE app held in hand"
            width={1610}
            height={2000}
            loading="lazy"
            decoding="async"
            style={FILL_STYLE}
          />
          <div className="phoneScreen">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${ASSETS}/autofade-phone.png`}
              alt="GLYDE app guided haircut screen"
              width={1206}
              height={2622}
              loading="lazy"
              decoding="async"
              style={FILL_STYLE}
            />
          </div>
        </div>
        <div className="autoFadeTabs" aria-label="Auto-Fade steps">
          {autoFadeSteps.map((step, index) => (
            <button
              key={step.number}
              type="button"
              className={index === 0 ? "activeTab" : undefined}
              aria-pressed={index === 0}
              data-glyde-auto-fade-tab=""
              data-glyde-index={index}
            >
              <span>{step.number}</span>
              <strong>{step.title}</strong>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

const designCards = [
  { slot: "-2", featured: false, title: "Designed For Your Routine, Not Around It.", body: "Clean, grip, charge — every touchpoint simplified." },
  { slot: "-1", featured: false, title: "Designed For Your Routine, Not Around It.", body: "Clean, grip, charge — every touchpoint simplified." },
  { slot: "0", featured: true, title: "About Our Interaction Design", body: "Every Interaction Is Crafted For Seamless Flow." },
  { slot: "1", featured: false, title: "Designed For Your Routine, Not Around It.", body: "Clean, grip, charge — every touchpoint simplified." },
  { slot: "2", featured: false, title: "Designed For Your Routine, Not Around It.", body: "Clean, grip, charge — every touchpoint simplified." },
];

function DesignSection() {
  return (
    <section className="section design" aria-labelledby="design-title" data-glyde-design="">
      <header className="sectionHeading leftHeading">
        <p>Design &amp; Craft</p>
        <h2 id="design-title">
          Built To Feel <em>Right.</em>{" "}
          <span>Every Detail Designed Around Your Daily Routine.</span>
        </h2>
      </header>
      <div
        className="designViewport"
        role="region"
        aria-label="Design and craft details"
        tabIndex={0}
        data-glyde-design-viewport=""
      >
        <div className="designTrack">
          {designCards.map((card) => (
            <article
              key={card.slot}
              className={`designCard${card.featured ? " featuredDesignCard" : ""}`}
              data-glyde-design-card=""
              data-glyde-slot={card.slot}
            >
              <div>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="designControls">
        <button type="button" aria-label="Next design detail" data-glyde-design-next="">
          Next
        </button>
      </div>
    </section>
  );
}

const smartSteps = [
  { number: "01", title: "Choose Style" },
  { number: "02", title: "Set The Fade-Band" },
  { number: "03", title: "Start Cutting" },
  { number: "04", title: "Finished Clipping" },
];

function SmartModeSection() {
  return (
    <section className="section smartMode" aria-labelledby="smart-mode-title">
      <header className="sectionHeading smartHeading">
        <h2 id="smart-mode-title">Smart Mode</h2>
        <p>
          <span className="smartFirstLine">Just A Few Steps To</span>A <em>Clean Cut.</em>{" "}
          <span>
            Every Detail Designed
            <br />
            Around Your Daily Routine.
          </span>
        </p>
      </header>
      <div className="smartGrid">
        {smartSteps.map((step) => (
          <article className="smartCard" key={step.number}>
            {/* Media still pending, same as the theme's unset image_picker settings. */}
            <div className="smartVisual" aria-hidden="true" data-media-placeholder="true" />
            <div className="smartCopy">
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>Browse Styles In The App And Pick What You Want — Or Customize Your Own Look.</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const lengthOptions = ["0.2", "0.3", "0.4", "0.5", "0.6", "0.7", "0.8"];
const SELECTED_LENGTH_INDEX = 3;
// The Liquid template keys these off `section.id`; a constant serves the same
// purpose of keeping the ids unique on the page.
const PICKER_ID = "glyde-manual";

function ManualModeSection() {
  return (
    <section className="section manual" aria-labelledby="manual-title">
      <h2 id="manual-title">
        Manual
        <br />
        Mode
      </h2>
      <p className="manualCopy">
        <strong>Any Length. Zero Attachments.</strong> Every Detail Designed Around Your Daily
        Routine.
      </p>
      <div className="manualDevice">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${ASSETS}/body-image-1.png`}
          alt="GLYDE clipper with adjustable blade"
          width={1132}
          height={1315}
          loading="lazy"
          decoding="async"
          style={FILL_STYLE}
        />
      </div>
      <div className="lengthScale" data-glyde-length-picker="">
        <div
          className="lengthScaleViewport"
          data-glyde-length-picker-viewport=""
          role="listbox"
          tabIndex={0}
          aria-label="Blade length in inches"
          aria-describedby={`length-picker-help-${PICKER_ID}`}
          aria-activedescendant={`length-option-${PICKER_ID}-${SELECTED_LENGTH_INDEX}`}
        >
          <div className="lengthScaleTrack" data-glyde-length-picker-track="">
            {lengthOptions.map((value, index) => (
              <div
                key={value}
                className={`lengthScaleOption${index === SELECTED_LENGTH_INDEX ? " is-selected" : ""}`}
                id={`length-option-${PICKER_ID}-${index}`}
                data-glyde-length-option=""
                data-index={index}
                data-value={value}
                role="option"
                aria-selected={index === SELECTED_LENGTH_INDEX}
              >
                {value}
              </div>
            ))}
          </div>
          <strong className="lengthScaleUnit" aria-hidden="true">
            Inch
          </strong>
        </div>
        <p id={`length-picker-help-${PICKER_ID}`} className="srOnly">
          Swipe or drag vertically, scroll, or use the arrow keys to choose a blade length.
        </p>
        <output className="srOnly" data-glyde-length-picker-output="" aria-live="polite">
          0.5 inches
        </output>
      </div>
    </section>
  );
}

const TESTIMONIAL_QUOTE =
  "\"It has saved me much time and money, and is the reason why I have been able to have a good haircut while being a first time father!\"";

function Stars({ highlightLast }: { highlightLast: boolean }) {
  return (
    <div className="stars" role="img" aria-label={`${highlightLast ? 4 : 5} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={index}
          aria-hidden="true"
          src={`${ASSETS}/${highlightLast && index === 4 ? "star-highlight.svg" : "star.svg"}`}
          alt=""
          width={18}
          height={18}
          loading="lazy"
        />
      ))}
    </div>
  );
}

function TestimonialsSection() {
  return (
    <section className="section testimonials" aria-labelledby="testimonials-title">
      <header className="sectionHeading centerHeading">
        <p>What Users Say</p>
        <h2 id="testimonials-title">
          DON&apos;T TAKE OUR <em>WORD FOR IT</em>.
        </h2>
      </header>
      <div className="testimonialGrid">
        {[0, 1, 2, 3].map((index) => (
          <article className="testimonialCard" key={index}>
            <Stars highlightLast={index === 3} />
            <blockquote>{TESTIMONIAL_QUOTE}</blockquote>
            <div className="reviewer">
              <span className="avatar" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${ASSETS}/avatar-person.png`}
                  alt=""
                  width={72}
                  height={116}
                  loading="lazy"
                  style={FILL_STYLE}
                />
              </span>
              <div>
                <strong>Andreas M.</strong>
                <small>Sweden — Uses GLYDE 1–3x/month</small>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="section faq" id="faq" aria-labelledby="faq-title" data-glyde-faq="">
      <header className="sectionHeading centerHeading">
        <p>FAQ</p>
        <h2 id="faq-title">Questions You Might Have.</h2>
      </header>
      <div className="faqList">
        {faqs.map((faq) => (
          <article className="faqItem" data-glyde-faq-item="" key={faq.id}>
            <h3>
              <button
                id={`faq-${faq.id}-toggle`}
                type="button"
                aria-expanded="false"
                aria-controls={`answer-${faq.id}`}
                data-glyde-faq-button=""
              >
                <span>{faq.question}</span>
                <i aria-hidden="true" />
              </button>
            </h3>
            <div
              id={`answer-${faq.id}`}
              className="faqAnswer"
              role="region"
              aria-labelledby={`faq-${faq.id}-toggle`}
              aria-hidden="true"
              data-glyde-faq-answer=""
            >
              <p>{faq.answer}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const socialLinks = [
  { href: "https://www.facebook.com/GLYDEsmartclipper", icon: "social-facebook.svg", label: "GLYDE on Facebook" },
  { href: "https://www.instagram.com/glyde_smartclipper/", icon: "social-instagram.svg", label: "GLYDE on Instagram" },
  { href: "https://www.youtube.com/@smarthairclipper", icon: "social-youtube.svg", label: "GLYDE on YouTube" },
];

function FinalCta() {
  return (
    <section className="finalCta" aria-labelledby="final-title">
      <header className="sectionHeading centerHeading">
        <p>Join the waitlist</p>
        <h2 id="final-title">
          Ready For Your First <em>Perfect Fade?</em>
        </h2>
      </header>
      <p className="finalLead">Join The Waitlist Now. Early Subscribers Save $80 At Launch.</p>
      <div className="formShell footerFormShell">
        <WaitlistForm location="footer" />
      </div>
      <ul className="finalTrust" aria-label="Reservation benefits">
        <li>Secure checkout</li>
        <li>Early backer pricing</li>
        <li>Priority support</li>
      </ul>
      <nav className="socialLinks" aria-label="Social media">
        {socialLinks.map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noreferrer" aria-label={link.label}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${ASSETS}/${link.icon}`} alt="" width={100} height={100} loading="lazy" />
          </a>
        ))}
        <span className="socialUnavailable" role="img" aria-label="GLYDE on X — profile coming soon">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ASSETS}/social-x.svg`} alt="" width={100} height={100} loading="lazy" />
        </span>
      </nav>
      <footer className="footer">
        <p>© 2026 GLYDE By Kuaiku Innovation. All Rights Reserved.</p>
        <nav aria-label="Legal">
          <a href={PRIVACY_POLICY_URL}>Privacy Policy</a>
          <a href={TERMS_OF_SERVICE_URL}>Terms of Service</a>
          <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
        </nav>
      </footer>
    </section>
  );
}

export function LandingPage() {
  return (
    <div id="top" className="page" data-glyde-landing="">
      <Hero />
      {/* The "Built Different" section was removed from the page per Figma
          node 434-3, where it is greyed out and marked 隐藏. It is a removal,
          not a hidden element: nothing renders and nothing is downloaded for
          it. theme/sections/glyde-landing.liquid still contains it. */}
      <ResultsSection />
      <AutoFadeSection />
      <DesignSection />
      <SmartModeSection />
      <ManualModeSection />
      <TestimonialsSection />
      <FaqSection />
      <FinalCta />
    </div>
  );
}
