import { faqs } from "@/lib/content";
import {
  CONTACT_EMAIL,
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
} from "@/lib/links";
import { HeroVideo } from "./HeroVideo";
import { TopNav } from "./TopNav";
import { FeatureShowcaseSection } from "./sections/FeatureShowcaseSection";
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

// Widths measured off the 1920x1080 reference, one per outlet: the row is laid
// out by width, not by a shared height. Forcing a uniform height instead makes
// each mark scale by however much its own artwork was trimmed, and the row
// drifts wider than the design.
const PRESS = [
  { file: "daily-mail.png", name: "Daily Mail", w: 139.7, href: "https://www.dailymail.co.uk/sciencetech/article-15455353/AI-smart-clippers-automatic-haircut.html" },
  { file: "yahoo-finance.png", name: "Yahoo Finance", w: 78.7, href: "https://uk.finance.yahoo.com/news/ai-hair-clippers-self-opening-170814028.html" },
  { file: "the-verge.png", name: "The Verge", w: 128.3, href: null },
  { file: "euronews.png", name: "euronews", w: 241.7, href: "https://www.euronews.com/next/2026/01/07/from-musical-lollipops-to-ai-hair-clippers-heres-the-weirdest-tech-at-ces-2026-so-far" },
  { file: "zdnet.png", name: "ZDNet", w: 44.3, href: "https://www.zdnet.com/article/best-weird-tech-ces-2026/" },
  { file: "stuff.png", name: "Stuff", w: 98.0, href: "https://www.stuff.tv/features/i-let-a-man-thats-never-cut-hair-before-cut-mine-with-ai-guided-clippers/" },
  { file: "fox-news.png", name: "Fox News", w: 150.7, href: "https://www.foxnews.com/tech/ces-2026-showstoppers-10-gadgets-you-have-see" },
  { file: "upi.png", name: "UPI", w: 47.7, href: "https://www.upi.com/News_Photos/view/upi/3bfc4e5e2d575d67b1ce6d2568bc322d/2026-International-CES/" },
];

// Rebuilt from Figma node 433-64. The previous hero — full-bleed photo, a
// reservation header button, the /01 product note, the trust list and the
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
          <a className="heroV2Reserve" href="/deposit">
            Reserve For $5
          </a>
        </header>

        <div className="heroV2Copy">
          <h1 id="hero-title" className="heroV2Title">
            <span>Your first</span>
            <span className="heroV2TitleAccent">perfect fade</span>
            <span>at home</span>
          </h1>
          <p className="heroV2Lead">
            The first clipper with auto-fade technology. Guided cuts, consistent results, zero skill needed.
          </p>

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
  { href: "https://www.facebook.com/GLYDEsmartclipper", icon: "/assets/v3/social-facebook.svg", label: "GLYDE on Facebook" },
  { href: "https://www.instagram.com/glyde_smartclipper/", icon: "/assets/v3/social-instagram.svg", label: "GLYDE on Instagram" },
  { href: "https://www.youtube.com/@smarthairclipper", icon: "/assets/v3/social-youtube.svg", label: "GLYDE on YouTube" },
];

function FinalCta() {
  return (
    <section className="finalCta" aria-labelledby="final-title">
      <header className="sectionHeading centerHeading">
        <p>Join thewaitlist</p>
        <h2 id="final-title">
          Ready For Your First <em>Perfect Fade?</em>
        </h2>
      </header>
      <p className="finalLead">Join The Waitlist Now. Early Subscribers Save $80 At Launch.</p>
      <div className="formShell footerFormShell">
        <WaitlistForm location="footer" placeholder="Enter your email" />
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
            <img src={link.icon} alt="" width={80} height={80} loading="lazy" />
          </a>
        ))}
        <span className="socialUnavailable" role="img" aria-label="GLYDE on X — profile coming soon">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/v3/social-x.svg" alt="" width={80} height={80} loading="lazy" />
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
      <TopNav />
      <ResultsSection />
      <SmartModeSection />
      <ManualModeSection />
      <FeatureShowcaseSection />
      <TestimonialsSection />
      <FaqSection />
      <FinalCta />
    </div>
  );
}
