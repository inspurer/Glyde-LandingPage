import { faqs } from "@/lib/content";
import {
  CONTACT_EMAIL,
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
} from "@/lib/links";
import { HeroVideo } from "./HeroVideo";
import { AutoFadeSection } from "./sections/AutoFadeSection";
import { DesignCraftSection } from "./sections/DesignCraftSection";
import { ManualModeSection } from "./sections/ManualModeSection";
import { ResultsSection } from "./sections/ResultsSection";
import { SmartModeSection } from "./sections/SmartModeSection";
import { TestimonialsSection } from "./sections/TestimonialsSection";
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
      <SmartModeSection />
      <ManualModeSection />
      <DesignCraftSection />
      <TestimonialsSection />
      <FaqSection />
      <FinalCta />
    </div>
  );
}
