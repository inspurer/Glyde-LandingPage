import Image from "next/image";
import Link from "next/link";

import { faqs as productFaqs, testimonials } from "@/lib/content";
import { CHECKOUT_PATH } from "@/lib/checkout";
import {
  CONTACT_EMAIL,
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
} from "@/lib/links";

import { DepositFaq, type DepositFaqItem } from "./DepositFaq";
import { DepositGallery } from "./DepositGallery";
import styles from "./deposit.module.css";

const featureCards = [
  {
    title: "Automatic Blade Adjustment",
    iconDesktop: "/assets/deposit/feature-auto-desktop.svg",
    iconMobile: "/assets/deposit/feature-auto-mobile.svg",
  },
  {
    title: "Multiple Lengths. No Guard Swapping.",
    iconDesktop: "/assets/deposit/feature-ruler-desktop.svg",
    iconMobile: "/assets/deposit/feature-ruler-mobile.svg",
  },
  {
    title: "App Guidance At Every Step",
    iconDesktop: "/assets/deposit/feature-app-desktop.svg",
    iconMobile: "/assets/deposit/feature-app-mobile.svg",
  },
  {
    title: "Helps Prevent Over Cutting",
    iconDesktop: "/assets/deposit/feature-protection-desktop.svg",
    iconMobile: "/assets/deposit/feature-protection-mobile.svg",
  },
] as const;

const benefits = [
  {
    title: "Reservation Benefits",
    description: "$50 Purchase Credit\nYour $5 Reservation Unlocks $50.",
    icon: "/assets/deposit/benefit-credit.svg",
  },
  {
    title: "Priority Access At Launch",
    description: "Be Among The First To Order\nWhen GLYDE Launches.",
    icon: "/assets/deposit/benefit-priority.svg",
  },
  {
    title: "Reservation Protection",
    description: "100% Refundable Reservation\nCancel Anytime Before Launch\nFor A Full Refund.",
    icon: "/assets/deposit/benefit-refund.svg",
  },
  {
    title: "Secure Checkout With PayPal",
    description: "Your Payment Is Securely\nProcessed By PayPal.",
    icon: "/assets/deposit/benefit-paypal.svg",
  },
] as const;

const desktopFaqs: readonly DepositFaqItem[] = [
  {
    question: "How much does GLYDE cost?",
    answer:
      "GLYDE’s regular retail price is $219. Reserve today for $5 to lock in the $169 reservation price — a $50 saving. Your $5 reservation is applied to your final purchase.",
  },
  {
    question: "What's included in the $5 reservation?",
    answer:
      "Your $5 secures your spot for early access and an exclusive $50 off the retail price ($219 down to $169), plus priority shipping and dedicated support. The $5 is applied as a credit toward your final purchase. If you change your mind, it’s fully refundable anytime before launch.",
  },
  {
    question: "Is GLYDE really beginner-friendly?",
    answer:
      "Yes. GLYDE is designed for people with little or no haircutting experience. Choose a hairstyle in the app, then follow the step-by-step visual and audio guidance while GLYDE adjusts the blade for you.",
  },
  {
    question: "What if I mess up while cutting?",
    answer:
      "Built-in sensors monitor your movement, speed, tilt and angle. If you move too quickly or hold the clipper incorrectly, GLYDE adjusts and guides you to help reduce harsh lines, uneven transitions and accidental overcutting.",
  },
  {
    question: "Does it work for all hair types?",
    answer:
      "GLYDE is designed primarily for short hairstyles, including buzz cuts, crew cuts, side parts, fades, tapers and side-and-back touch-ups. It is not currently designed for long hairstyles, very curly hair or skin fades.",
  },
  {
    question: "When will GLYDE ship?",
    answer:
      "We currently expect the first GLYDE reservation orders to begin shipping in October 2026. Reservation customers receive priority access and we’ll share production and delivery updates by email.",
  },
];

const mobileFaqs: readonly DepositFaqItem[] = productFaqs.slice(0, 6);

const structuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: desktopFaqs.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

function FeatureGrid({ variant }: { variant: "desktop" | "mobile" }) {
  return (
    <div className={styles.featureGrid}>
      {featureCards.map((feature) => {
        const icon = variant === "desktop" ? feature.iconDesktop : feature.iconMobile;
        return (
          <article className={styles.featureCard} key={feature.title}>
            <span className={styles.featureIcon}>
              <Image src={icon} alt="" width={60} height={60} />
            </span>
            <p>{feature.title}</p>
          </article>
        );
      })}
    </div>
  );
}

function PriceAndReserve({ variant }: { variant: "desktop" | "mobile" }) {
  return (
    <div className={styles.purchaseArea}>
      <div className={styles.prices} aria-label="Regular price $219; reservation price $169">
        <div className={styles.regularPrice}>
          <span>Regular Price</span>
          <strong>$219</strong>
        </div>
        <div className={styles.reservationPrice}>
          <span>Reservation Price</span>
          <strong>$169</strong>
        </div>
      </div>
      <Link
        className={styles.reserveButton}
        href={CHECKOUT_PATH}
        data-track="deposit_reserve"
        aria-label="Reserve GLYDE for 5 dollars"
      >
        <Image
          src={
            variant === "desktop"
              ? "/assets/deposit/reserve-button-desktop.svg"
              : "/assets/deposit/reserve-button-mobile.svg"
          }
          alt=""
          fill
          priority
        />
        <span>Reserve For&nbsp;&nbsp; $5</span>
      </Link>
    </div>
  );
}

function TestimonialCards({ variant }: { variant: "desktop" | "mobile" }) {
  const visibleTestimonials = variant === "mobile" ? testimonials.slice(0, 3) : testimonials;

  return (
    <div className={styles.testimonialViewport}>
      <div className={styles.testimonialRail}>
        {visibleTestimonials.map((testimonial, index) => {
          const mobileAvatar = [
            "/assets/deposit/avatar-andreas-mobile.png",
            "/assets/deposit/avatar-cory-mobile.png",
            "/assets/deposit/avatar-paolo-mobile.png",
          ][index];
          const avatar =
            variant === "mobile" && mobileAvatar
              ? mobileAvatar
              : `/assets/v3/avatar-${index + 1}.png`;

          return (
            <article className={styles.testimonialCard} key={testimonial.id}>
              <div className={styles.stars} aria-label={`${testimonial.rating} out of 5 stars`}>
                {Array.from({ length: 5 }, (_, starIndex) => (
                  <Image
                    key={starIndex}
                    src={
                      starIndex < testimonial.rating
                        ? "/assets/figma/star.svg"
                        : "/assets/figma/star-highlight.svg"
                    }
                    alt=""
                    width={20}
                    height={20}
                  />
                ))}
              </div>
              <blockquote>“{testimonial.quote}”</blockquote>
              <div className={styles.testimonialPerson}>
                <Image src={avatar} alt="" width={48} height={48} />
                <div>
                  <strong>{testimonial.name}</strong>
                  <span>{testimonial.meta}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function DesktopDeposit() {
  return (
    <div className={styles.desktopWrapper}>
      <div className={styles.desktopStage}>
        <Link className={styles.desktopLogo} href="/" aria-label="GLYDE home">
          <Image src="/assets/figma/logo.png" alt="GLYDE" fill priority sizes="198px" />
        </Link>

        <DepositGallery variant="desktop" />

        <section className={styles.productCopy} aria-labelledby="deposit-title-desktop">
          <h1 id="deposit-title-desktop">GLYDE Auto-Fade<br />Clipper</h1>
          <p>
            A Smarter Way To Create Smoother, More Consistent Fades. GLYDE Senses<br />
            Its Position, Guides Your Movement, And Automatically Adjusts The Blade<br />
            Length As You Cut.
          </p>
          <FeatureGrid variant="desktop" />
          <PriceAndReserve variant="desktop" />
        </section>

        <section className={styles.benefits} aria-label="Reservation benefits">
          {benefits.map((benefit) => (
            <article key={benefit.title}>
              <Image src={benefit.icon} alt="" width={62} height={62} />
              <h2>{benefit.title}</h2>
              <p>{benefit.description}</p>
            </article>
          ))}
        </section>

        <section className={styles.testimonials} aria-labelledby="testimonials-title-desktop">
          <p className={styles.sectionEyebrow}>What Users Say</p>
          <h2 id="testimonials-title-desktop">
            See Why Customers <span>Love GLYDE.</span>
          </h2>
          <TestimonialCards variant="desktop" />
        </section>

        <section className={styles.faq} aria-labelledby="faq-title-desktop">
          <p className={styles.sectionEyebrow}>FAQ</p>
          <h2 id="faq-title-desktop">Questions You Might Have.</h2>
          <DepositFaq items={desktopFaqs} initialOpen={1} idPrefix="desktop-faq" />
        </section>

        <footer className={styles.footer}>
          <p>© 2026 GLYDE By Kuiaku Innovation. All Rights Reserved.</p>
          <nav aria-label="Legal and support links">
            <a href={PRIVACY_POLICY_URL}>Privacy Policy</a>
            <a href={TERMS_OF_SERVICE_URL}>Terms Of Service</a>
            <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
          </nav>
        </footer>
      </div>
    </div>
  );
}

function MobileDeposit() {
  return (
    <div className={styles.mobileWrapper}>
      <div className={styles.mobileStage}>
        <Link className={styles.mobileLogo} href="/" aria-label="GLYDE home">
          <Image src="/assets/figma/logo.png" alt="GLYDE" fill priority sizes="24vw" />
        </Link>

        <DepositGallery variant="mobile" />

        <section className={styles.mobileProductCopy} aria-labelledby="deposit-title-mobile">
          <h1 id="deposit-title-mobile">GLYDE Auto-Fade<br />Clipper</h1>
          <p>
            A Smarter Way To Create Smoother, More Consistent Fades. GLYDE Senses Its<br />
            Position, Guides Your Movement, And Automatically Adjusts The Blade Length As<br />
            You Cut.
          </p>
          <FeatureGrid variant="mobile" />
          <PriceAndReserve variant="mobile" />
        </section>

        <section className={styles.mobileTestimonials} aria-labelledby="testimonials-title-mobile">
          <p className={styles.sectionEyebrow}>What Users Say</p>
          <h2 id="testimonials-title-mobile">
            See Why Customers<br /><span>Love GLYDE.</span>
          </h2>
          <TestimonialCards variant="mobile" />
        </section>

        <section className={styles.mobileFaq} aria-labelledby="faq-title-mobile">
          <p className={styles.sectionEyebrow}>FAQ</p>
          <h2 id="faq-title-mobile">Questions You Might<br />Have.</h2>
          <DepositFaq items={mobileFaqs} initialOpen={5} idPrefix="mobile-faq" />
        </section>

        <footer className={styles.mobileFooter}>
          <nav aria-label="Legal and support links">
            <a href={PRIVACY_POLICY_URL}>Privacy Policy</a>
            <a href={TERMS_OF_SERVICE_URL}>Terms Of Service</a>
            <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
          </nav>
          <p>© 2026 GLYDE By Kuiaku Innovation. All Rights Reserved.</p>
        </footer>
      </div>
    </div>
  );
}

export default function DepositPage() {
  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <DesktopDeposit />
      <MobileDeposit />
    </main>
  );
}
