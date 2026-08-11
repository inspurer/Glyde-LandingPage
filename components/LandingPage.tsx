"use client";

import Image from "next/image";
import { FormEvent, useRef, useState, type CSSProperties } from "react";
import {
  autoFadeSteps,
  designCraftCards,
  faqs,
  featureCards,
  resultProfiles,
  smartModeSteps,
  testimonials,
} from "@/lib/content";
import styles from "./LandingPage.module.css";

const ASSET_ROOT = "/assets/figma";
const DEPOSIT_URL = "https://glydeclipper.com/pages/deposit";

type SubmitState = "idle" | "loading" | "success" | "error";

function WaitlistForm({ location }: { location: "hero" | "footer" }) {
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "");
    const website = String(data.get("website") ?? "");

    setState("loading");
    setMessage("");

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website }),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Unable to subscribe at this time.");
      }

      form.reset();
      setState("success");
      setMessage("You’re on the list. Watch your inbox for GLYDE updates.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to subscribe at this time.");
    }
  }

  return (
    <div className={`${styles.formShell} ${styles[`${location}FormShell`]}`}>
      <form className={styles.waitlistForm} onSubmit={handleSubmit} aria-busy={state === "loading"}>
        <label className={styles.srOnly} htmlFor={`${location}-email`}>
          Email address
        </label>
        <input
          id={`${location}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="GLYDE@163.com"
          required
          disabled={state === "loading"}
          aria-invalid={state === "error"}
          aria-describedby={`${location}-form-status`}
        />
        <input
          className={styles.honeypot}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
        <span aria-hidden="true" className={styles.formDivider} />
        <button type="submit" disabled={state === "loading"}>
          {state === "loading" ? "Submitting…" : "Get Early Access"}
        </button>
      </form>
      <p
        id={`${location}-form-status`}
        className={`${styles.formStatus} ${state === "error" ? styles.formError : ""}`}
        aria-live="polite"
      >
        {message}
      </p>
    </div>
  );
}

function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <Image
        className={styles.heroPhoto}
        src={`${ASSET_ROOT}/hero-photo.png`}
        alt="A man using the GLYDE smart auto-fade clipper at home"
        fill
        priority
        unoptimized
        sizes="100vw"
      />
      <div className={styles.heroShade} />
      <Image
        className={styles.heroCorners}
        src={`${ASSET_ROOT}/hero-corners.svg`}
        alt=""
        fill
        priority
        unoptimized
        sizes="100vw"
      />

      <header className={styles.heroHeader}>
        <a href="#top" aria-label="GLYDE home" className={styles.logoLink}>
          <Image src={`${ASSET_ROOT}/logo.png`} width={198} height={140} alt="GLYDE" priority unoptimized />
        </a>
        <a className={styles.reserveButton} href={DEPOSIT_URL}>
          Reserve for $3
        </a>
      </header>

      <h1 id="hero-title" className={styles.heroTitle}>
        <span>Your first</span>
        <strong>perfect fade</strong>
        <span>at home</span>
      </h1>

      <div className={styles.heroProductNote}>
        <span>/01</span>
        <p>World&apos;s First Smart Auto-Fade Clipper</p>
      </div>

      <div className={styles.heroFormArea}>
        <WaitlistForm location="hero" />
        <p className={styles.heroFormCaption}>Join the waitlist. Save $80 when we launch.</p>
      </div>

      <p className={styles.heroIntro}>
        The first clipper with auto-fade technology. Guided cuts, consistent results, zero skill needed.
      </p>

      <ul className={styles.heroTrust} aria-label="Reservation benefits">
        <li>Secure checkout</li>
        <li>Early backer pricing</li>
        <li>Priority support</li>
      </ul>

      <div className={styles.mediaReports}>
        <p>Relevant Media Reports</p>
        <div>
          <span>CNET</span>
          <a href="https://www.theverge.com/tech/854436/would-you-let-ai-cut-your-hair" target="_blank" rel="noreferrer">The Verge</a>
          <a href="https://www.foxnews.com/tech/ces-2026-showstoppers-10-gadgets-you-have-see" target="_blank" rel="noreferrer">Fox News</a>
          <a href="https://www.zdnet.com/article/best-weird-tech-ces-2026/" target="_blank" rel="noreferrer">ZDNet</a>
        </div>
      </div>
    </section>
  );
}

function FeatureSection() {
  const images = ["feature-person.png", "feature-device.png", "feature-device.png", "feature-person.png"];

  return (
    <section className={`${styles.section} ${styles.features}`} aria-labelledby="features-title">
      <header className={`${styles.sectionHeading} ${styles.centerHeading}`}>
        <p>Built Different</p>
        <h2 id="features-title">GLYDE Handles The <em>Hard Parts</em><br />For You.</h2>
      </header>
      <div className={styles.featureGrid}>
        {featureCards.map((card, index) => (
          <article className={styles.featureCard} key={card.id}>
            <Image
              src={`${ASSET_ROOT}/${images[index]}`}
              alt=""
              fill
              sizes="(max-width: 767px) 86vw, (max-width: 1200px) 44vw, 420px"
              className={index === 1 || index === 2 ? styles.containImage : styles.coverImage}
            />
            <div className={styles.cardShade} />
            <div className={styles.featureCopy}>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ResultsSection() {
  const [active, setActive] = useState(0);
  const images = ["result-person-b.png", "result-person-a.png", "result-person-b.png"];
  const trackStyle = { "--active-result": active } as CSSProperties;

  return (
    <section className={`${styles.section} ${styles.results}`} aria-labelledby="results-title">
      <header className={`${styles.sectionHeading} ${styles.resultsHeading}`}>
        <p>Real People, Real Cuts</p>
        <h2 id="results-title">See The <em>Results</em></h2>
      </header>
      <div className={styles.resultsToolbar}>
        <span aria-live="polite">{String(active + 1).padStart(2, "0")} / 03</span>
        <button aria-label="Next result" aria-controls="haircut-results" onClick={() => setActive((active + 1) % 3)}>Next</button>
      </div>
      <div className={styles.resultsViewport} id="haircut-results" aria-label="GLYDE haircut result examples">
        <div className={styles.resultsTrack} style={trackStyle}>
          {resultProfiles.map((profile, index) => (
            <article className={styles.resultCard} key={profile.id}>
              <div className={styles.resultPortrait}>
                <Image src={`${ASSET_ROOT}/${images[index]}`} alt={`GLYDE haircut result ${index + 1} of 3`} fill unoptimized sizes="432px" />
              </div>
              <div className={styles.resultData}>
                <dl>
                  <div><dt>{profile.haircutLabel}</dt><dd>{profile.haircut}</dd></div>
                  <div><dt>{profile.movementLabel}</dt><dd>{profile.movement}</dd></div>
                  <div><dt>{profile.durationLabel}</dt><dd>{profile.duration}</dd></div>
                  <div><dt>{profile.experienceLabel}</dt><dd>{profile.experience}</dd></div>
                </dl>
                <blockquote>&quot;{profile.quote}&quot;</blockquote>
                {profile.quoteLabel ? <p className={styles.resultQuoteLabel}>{profile.quoteLabel}</p> : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AutoFadeSection() {
  const [active, setActive] = useState(0);

  return (
    <section className={`${styles.section} ${styles.autoFade}`} aria-labelledby="autofade-title">
      <header className={`${styles.sectionHeading} ${styles.rightHeading}`}>
        <p>Inside GLYDE</p>
        <h2 id="autofade-title">How <em>Auto-Fade</em> Works. <span>From Style Selection To The Final Cut — Here&apos;s What Happens At Every Step.</span></h2>
      </header>
      <div className={styles.autoFadeLayout}>
        <div className={styles.autoFadeVisual} data-step={active + 1}>
          <Image className={styles.handPhone} src={`${ASSET_ROOT}/autofade-scene.png`} alt="GLYDE app held in hand" fill unoptimized sizes="(max-width: 900px) 100vw, 64vw" />
          <div className={styles.phoneScreen}>
            <Image src={`${ASSET_ROOT}/autofade-phone.png`} alt="GLYDE app guided haircut screen" fill unoptimized sizes="220px" />
          </div>
        </div>
        <div className={styles.autoFadeTabs} aria-label="Auto-Fade steps">
          {autoFadeSteps.map((step, index) => (
            <button
              key={step.number}
              aria-pressed={active === index}
              className={active === index ? styles.activeTab : ""}
              onClick={() => setActive(index)}
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

function DesignSection() {
  const scroller = useRef<HTMLDivElement>(null);
  const move = (direction: -1 | 1) => {
    scroller.current?.scrollBy({ left: direction * 420, behavior: "smooth" });
  };

  return (
    <section className={`${styles.section} ${styles.design}`} aria-labelledby="design-title">
      <header className={`${styles.sectionHeading} ${styles.leftHeading}`}>
        <p>Design &amp; Craft</p>
        <h2 id="design-title">Built To Feel <em>Right.</em> <span>Every Detail Designed Around Your Daily Routine.</span></h2>
      </header>
      <div className={styles.designViewport} ref={scroller} role="region" aria-label="Design and craft details" tabIndex={0}>
        <div className={styles.designTrack}>
          {designCraftCards.map((card) => (
            <article
              className={`${styles.designCard} ${card.variant === "featured" ? styles.featuredDesignCard : ""}`}
              key={card.id}
            >
              <div>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className={styles.designControls}>
        <button onClick={() => move(1)} aria-label="Next design detail">Next</button>
      </div>
    </section>
  );
}

function SmartModeSection() {
  return (
    <section className={`${styles.section} ${styles.smartMode}`} aria-labelledby="smart-mode-title">
      <header className={`${styles.sectionHeading} ${styles.smartHeading}`}>
        <h2 id="smart-mode-title">Smart Mode</h2>
        <p><span className={styles.smartFirstLine}>Just A Few Steps To</span>A <em>Clean Cut.</em> <span>Every Detail Designed<br />Around Your Daily Routine.</span></p>
      </header>
      <div className={styles.smartGrid}>
        {smartModeSteps.map((step) => (
          <article className={styles.smartCard} key={step.number}>
            <div className={styles.smartVisual} aria-hidden="true" data-media-placeholder="true" />
            <div className={styles.smartCopy}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ManualModeSection() {
  const values = ["0.2", "0.3", "0.4", "0.5", "0.6", "0.7", "0.8"];

  return (
    <section className={`${styles.section} ${styles.manual}`} aria-labelledby="manual-title">
      <h2 id="manual-title">Manual<br />Mode</h2>
      <p className={styles.manualCopy}><strong>Any Length. Zero Attachments.</strong> Every Detail Designed Around Your Daily Routine.</p>
      <div className={styles.manualDevice}>
        <Image src={`${ASSET_ROOT}/body-image-1.png`} alt="GLYDE clipper with adjustable blade" fill unoptimized sizes="(max-width: 767px) 90vw, 680px" />
      </div>
      <div className={styles.lengthScale} role="img" aria-label="Adjustable blade length from 0.2 to 0.8 inches">
        {values.map((value) => <span aria-hidden="true" className={value === "0.5" ? styles.scaleActive : ""} key={value}>{value}</span>)}
        <strong>inch</strong>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className={`${styles.section} ${styles.testimonials}`} aria-labelledby="testimonials-title">
      <header className={`${styles.sectionHeading} ${styles.centerHeading}`}>
        <p>What Users Say</p>
        <h2 id="testimonials-title">DON&apos;T TAKE OUR <em>WORD FOR IT</em>.</h2>
      </header>
      <div className={styles.testimonialGrid}>
        {testimonials.map((testimonial) => (
          <article className={styles.testimonialCard} key={testimonial.id}>
            <div className={styles.stars} role="img" aria-label={`${testimonial.rating} out of 5 stars`}>
              {Array.from({ length: 5 }, (_, index) => (
                <Image
                  aria-hidden="true"
                  src={`${ASSET_ROOT}/${index >= testimonial.rating ? "star-highlight.svg" : "star.svg"}`}
                  alt=""
                  width={18}
                  height={18}
                  unoptimized
                  key={index}
                />
              ))}
            </div>
            <blockquote>&quot;{testimonial.quote}&quot;</blockquote>
            <div className={styles.reviewer}>
              <span className={styles.avatar} aria-hidden="true"><Image src={`${ASSET_ROOT}/avatar-person.png`} alt="" fill unoptimized sizes="44px" /></span>
              <div><strong>{testimonial.name}</strong><small>{testimonial.meta}</small></div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FaqSection() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className={`${styles.section} ${styles.faq}`} id="faq" aria-labelledby="faq-title">
      <header className={`${styles.sectionHeading} ${styles.centerHeading}`}>
        <p>FAQ</p>
        <h2 id="faq-title">Questions You Might Have.</h2>
      </header>
      <div className={styles.faqList}>
        {faqs.map((faq) => {
          const isOpen = openId === faq.id;
          return (
            <article className={`${styles.faqItem} ${isOpen ? styles.faqOpen : ""}`} key={faq.id}>
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`answer-${faq.id}`}
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                >
                  <span>{faq.question}</span><i aria-hidden="true" />
                </button>
              </h3>
              <div id={`answer-${faq.id}`} className={styles.faqAnswer} role="region" aria-hidden={!isOpen}>
                <p>{faq.answer}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FinalCta() {
  const socialLinks = [
    { label: "Facebook", icon: "social-facebook.svg", href: "https://www.facebook.com/GLYDEsmartclipper" },
    { label: "Instagram", icon: "social-instagram.svg", href: "https://www.instagram.com/glyde_smartclipper/" },
    { label: "YouTube", icon: "social-youtube.svg", href: "https://www.youtube.com/@smarthairclipper" },
  ];

  return (
    <section className={styles.finalCta} aria-labelledby="final-title">
      <header className={`${styles.sectionHeading} ${styles.centerHeading}`}>
        <p>Join the waitlist</p>
        <h2 id="final-title">Ready For Your First <em>Perfect Fade?</em></h2>
      </header>
      <p className={styles.finalLead}>Join The Waitlist Now. Early Subscribers Save $80 At Launch.</p>
      <WaitlistForm location="footer" />
      <ul className={styles.finalTrust} aria-label="Reservation benefits">
        <li>Secure checkout</li><li>Early backer pricing</li><li>Priority support</li>
      </ul>
      <nav className={styles.socialLinks} aria-label="Social media">
        {socialLinks.map((social) => (
          <a href={social.href} key={social.label} target="_blank" rel="noreferrer" aria-label={`GLYDE on ${social.label}`}>
            <Image src={`${ASSET_ROOT}/${social.icon}`} alt="" width={100} height={100} unoptimized />
          </a>
        ))}
        <span className={styles.socialUnavailable} role="img" aria-label="GLYDE on X — profile coming soon">
          <Image src={`${ASSET_ROOT}/social-x.svg`} alt="" width={100} height={100} unoptimized />
        </span>
      </nav>
      <footer className={styles.footer}>
        <p>© 2026 GLYDE By Kuaiku Innovation. All Rights Reserved.</p>
        <nav aria-label="Legal">
          <a href="https://glydeclipper.com/policies/privacy-policy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="mailto:timchen@smarthairclipper.com">Contact</a>
        </nav>
      </footer>
    </section>
  );
}

export function LandingPage() {
  return (
    <main id="top" className={styles.page}>
      <Hero />
      <FeatureSection />
      <ResultsSection />
      <AutoFadeSection />
      <DesignSection />
      <SmartModeSection />
      <ManualModeSection />
      <TestimonialsSection />
      <FaqSection />
      <FinalCta />
    </main>
  );
}
