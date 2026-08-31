import Link from "next/link";

import { CHECKOUT_PATH } from "@/lib/checkout";
import { CONTACT_EMAIL, PRIVACY_POLICY_URL } from "@/lib/links";

// Ported from theme/sections/glyde-deposit.liquid, with the same class names so
// the theme's glyde-deposit.css (synced verbatim into public/theme/) lays it out
// identically.
//
// The Shopify version adds a $3 product to its cart through <product-form>.
// This deployment owns the payment flow, so Reserve Now goes to the local,
// server-validated checkout instead. The header cart icon remains omitted
// because a one-item reservation flow has no editable cart.

const ASSETS = "/assets/figma";
const THEME_ASSETS = "/theme";
const DEPOSIT_PRICE = "$3";
const NO_THANKS_URL = "https://form.typeform.com/to/ujNHomKI";

const faqs = [
  {
    question: "What is the reservation deposit?",
    answer:
      "By leaving a small refundable deposit (typically 1–5% of the product’s price), you secure the right to purchase this product at a special pre-launch discount once it becomes available. Your reservation is fully protected by our refund guarantee until successful delivery.",
  },
  {
    question: "When can I get my product?",
    answer:
      "During a Prelaunch, product creators offer you the lowest ever exclusive price when you reserve. This is not yet a full purchase, and it’s up to you to cancel or proceed with the purchase later. Product launch and delivery timelines are somewhat unpredictable. Where possible, creators offer estimates. And if you don’t receive the product within 2 years, you’ll get a full automatic refund.",
  },
  {
    question: "How can I claim a refund?",
    answer: `Claiming a refund is easy. Just email ${CONTACT_EMAIL} from the email you used to reserve the discount. Remember to mention which product you’d like to get a refund for. We’ll process it on the same day, no questions asked!`,
  },
  {
    question: "How can I learn more about GLYDE?",
    answer: `For any questions about this product, feel free to reach out to us directly at ${CONTACT_EMAIL}. Our team will be happy to provide more details or assist with your reservation.`,
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

const socials = [
  { href: "https://www.facebook.com/GLYDEsmartclipper", label: "GLYDE on Facebook", icon: "social-facebook.svg" },
  { href: "https://www.instagram.com/glyde_smartclipper/", label: "GLYDE on Instagram", icon: "social-instagram.svg" },
  { href: "https://www.youtube.com/@GLYDESmartClipper", label: "GLYDE on YouTube", icon: "social-youtube.svg" },
];

export default function DepositPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />

      <header className="glyde-deposit__header">
        <Link className="glyde-deposit__brand" href="/" aria-label="GLYDE home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ASSETS}/logo.png`} width={112} height={64} alt="GLYDE" loading="eager" />
        </Link>
      </header>

      <div className="glyde-deposit" data-glyde-deposit="">
        <div className="glyde-deposit__content">
          <div className="glyde-deposit__purchase-grid">
            <div className="glyde-deposit__intro">
              <p className="glyde-deposit__eyebrow">VIP PRELAUNCH</p>
              <h1>Thanks for subscribing!</h1>
              <p>
                My friend, you can become one of the first deposit backers with{" "}
                <strong>exclusive perks.</strong>
              </p>
              <p>
                Reserve your spot for just <strong>{DEPOSIT_PRICE}</strong> and you will receive the
                following perks.
              </p>
            </div>

            <div
              className="glyde-deposit__offer-art"
              role="img"
              aria-label={`GLYDE VIP prelaunch offer: $139 discount price, reserve for ${DEPOSIT_PRICE}, save $80`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="glyde-deposit__offer-image"
                src={`${THEME_ASSETS}/glyde-deposit-offer.png`}
                alt=""
                width={928}
                height={656}
                loading="eager"
                fetchPriority="high"
              />
            </div>

            <div className="glyde-deposit__actions">
              <Link
                className="glyde-deposit__reserve-button"
                href={CHECKOUT_PATH}
                data-track="deposit_reserve"
              >
                <span>Reserve Now</span>
              </Link>
              <a className="glyde-deposit__decline-button" href={NO_THANKS_URL}>
                No Thanks
              </a>
            </div>
          </div>

          <section className="glyde-deposit__benefits" aria-label="Reservation guarantees">
            <article className="glyde-deposit__benefit-card">
              <span className="glyde-deposit__benefit-icon" aria-hidden="true">
                <svg viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="12.5" stroke="currentColor" strokeWidth="2.5" />
                  <path
                    d="M20.8 11.7c-1-1-2.4-1.6-4.1-1.6-2.8 0-4.8 1.5-4.8 3.7 0 2.1 1.7 3.1 4.5 3.6 2 .4 2.7.8 2.7 1.8 0 1.1-1 1.8-2.7 1.8-1.8 0-3.4-.7-4.5-1.9M16.4 7.8v16.4"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <div>
                <h2>100% Money-Back Guarantee</h2>
                <p>Cancel your reservation anytime before our launch and get a full refund.</p>
              </div>
            </article>
            <article className="glyde-deposit__benefit-card">
              <span className="glyde-deposit__benefit-icon" aria-hidden="true">
                <svg viewBox="0 0 32 32" fill="none">
                  <path
                    d="M5 13.5h22v13H5zM8.5 9.5h15v4h-15zM16 7v19M5 17h22"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 9c-1.4-3.5-5.8-4.8-6.8-2.1C8.2 9.6 12 11 16 11M16 9c1.4-3.5 5.8-4.8 6.8-2.1C23.8 9.6 20 11 16 11"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <div>
                <h2>Prelaunch Refund Guarantee</h2>
                <p>
                  Your reservation deposit is safe with us. If you change your mind before the launch
                  or don’t receive the product, you can claim a full refund.
                </p>
              </div>
            </article>
          </section>

          <section className="glyde-deposit__faq" aria-labelledby="deposit-faq-title">
            <p className="glyde-deposit__eyebrow">FAQ</p>
            <h2 id="deposit-faq-title">How Prelaunch Works</h2>
            <div className="glyde-deposit__faq-list">
              {faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>
                    <span>{faq.question}</span>
                    <i aria-hidden="true" />
                  </summary>
                  <div>
                    <p>{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>

      <footer className="glyde-deposit__footer">
        <nav className="glyde-deposit__socials" aria-label="GLYDE social media">
          {socials.map((social) => (
            <a
              key={social.href}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.label}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${ASSETS}/${social.icon}`} alt="" width={24} height={24} loading="lazy" />
            </a>
          ))}
        </nav>
        <p>
          <span>© {new Date().getFullYear()}, GLYDE</span>
          <span aria-hidden="true">·</span>
          <a href={PRIVACY_POLICY_URL}>Privacy policy</a>
        </p>
      </footer>
    </>
  );
}
