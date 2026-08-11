export const featureCards = [
  {
    id: "fades-made-simple",
    title: "Fades made simple.",
    description:
      "No barber skills needed. Auto-Fade blends the gradient for you — smooth transition, every time.",
  },
  {
    id: "zero-guards",
    title: "One tool. Zero guards.",
    description:
      "The telescopic blade adjusts continuously. No swapping, no guessing, no clutter.",
  },
  {
    id: "consistent-result-01",
    title: "Same result, every time.",
    description:
      "Sensors track your position and angle. The cut stays consistent — whether it's your first or fiftieth.",
  },
  {
    id: "consistent-result-02",
    title: "Same result, every time.",
    description:
      "Sensors track your position and angle. The cut stays consistent — whether it's your first or fiftieth.",
  },
] as const;

export const resultProfiles = [
  {
    id: "01",
    haircut: "Side and Back Fade",
    haircutLabel: "Mode",
    movement: "Straight Down",
    movementLabel: "Mode",
    duration: "15′24″",
    durationLabel: "Haircut duration",
    experience: "01",
    experienceLabel: "User Experience",
    quote:
      "It has saved me much time and money, and is the reason why I have been able to have a good haircut while being a first time father!",
    quoteLabel: null,
  },
  {
    id: "02",
    haircut: "Side and Back Fade",
    haircutLabel: "Mode",
    movement: "Straight Down",
    movementLabel: "Mode",
    duration: "15′24″",
    durationLabel: "Haircut duration",
    experience: "01",
    experienceLabel: "User Experience",
    quote:
      "I love that it's easy for me to do on my own, at home and that it saves me money and time. I don't plan on going back to a barber any time soon.",
    quoteLabel: null,
  },
  {
    id: "03",
    haircut: "Side and Back Fade",
    haircutLabel: "Mode",
    movement: "Straight Down",
    movementLabel: "Mode",
    duration: "15′24″",
    durationLabel: "Haircut duration",
    experience: "01",
    experienceLabel: "User Experience",
    quote:
      "It has saved me much time and money, and is the reason why I have been able to have a good haircut while being a first time father!",
    quoteLabel: "User Reviews",
  },
] as const;

export const autoFadeSteps = [
  { number: "01", title: "Choose Style" },
  { number: "02", title: "Smart Sensing" },
  { number: "03", title: "Auto Blade" },
] as const;

export const designCraftCards = [
  {
    id: "far-left",
    variant: "side",
    title: "Designed For Your Routine, Not Around It.",
    description: "Clean, grip, charge — every touchpoint simplified.",
  },
  {
    id: "left",
    variant: "side",
    title: "Designed For Your Routine, Not Around It.",
    description: "Clean, grip, charge — every touchpoint simplified.",
  },
  {
    id: "center",
    variant: "featured",
    title: "About Our Interaction Design",
    description: "Every Interaction Is Crafted For Seamless Flow.",
  },
  {
    id: "right",
    variant: "side",
    title: "Designed For Your Routine, Not Around It.",
    description: "Clean, grip, charge — every touchpoint simplified.",
  },
  {
    id: "far-right",
    variant: "side",
    title: "Designed For Your Routine, Not Around It.",
    description: "Clean, grip, charge — every touchpoint simplified.",
  },
] as const;

export const smartModeSteps = [
  {
    number: "01",
    title: "Choose Style",
    description:
      "Browse Styles In The App And Pick What You Want — Or Customize Your Own Look.",
  },
  {
    number: "02",
    title: "Set The Fade-Band",
    description:
      "Browse Styles In The App And Pick What You Want — Or Customize Your Own Look.",
  },
  {
    number: "03",
    title: "Start Cutting",
    description:
      "Browse Styles In The App And Pick What You Want — Or Customize Your Own Look.",
  },
  {
    number: "04",
    title: "Finished Clipping",
    description:
      "Browse Styles In The App And Pick What You Want — Or Customize Your Own Look.",
  },
] as const;

const testimonialQuote =
  "It has saved me much time and money, and is the reason why I have been able to have a good haircut while being a first time father!";

export const testimonials = [
  {
    id: "testimonial-01",
    rating: 5,
    quote: testimonialQuote,
    name: "Andreas M.",
    meta: "Sweden — Uses GLYDE 1–3x/month",
  },
  {
    id: "testimonial-02",
    rating: 5,
    quote: testimonialQuote,
    name: "Andreas M.",
    meta: "Sweden — Uses GLYDE 1–3x/month",
  },
  {
    id: "testimonial-03",
    rating: 5,
    quote: testimonialQuote,
    name: "Andreas M.",
    meta: "Sweden — Uses GLYDE 1–3x/month",
  },
  {
    id: "testimonial-04",
    rating: 4,
    quote: testimonialQuote,
    name: "Andreas M.",
    meta: "Sweden — Uses GLYDE 1–3x/month",
  },
] as const;

export const faqs = [
  {
    id: "price",
    question: "How much does GLYDE cost?",
    answer:
      "GLYDE retails at $219. But when you reserve now for just $3, you lock in an exclusive $80 discount — bringing your final price down to $139. That's less than 5 barbershop visits, and you'll have it for life.",
  },
  {
    id: "reservation",
    question: "What's included in the $3 reservation?",
    answer:
      "Your $3 secures your spot for early access and an exclusive $80 off the retail price ($219 down to $139), plus priority shipping and dedicated support. The $3 is applied as a credit toward your final purchase. If you change your mind, it's fully refundable anytime before launch.",
  },
  {
    id: "beginner-friendly",
    question: "Is GLYDE really beginner-friendly?",
    answer:
      "Absolutely. GLYDE is designed for people who've never picked up clippers before. The app walks you through every step — where to start, which direction to move, how long to cut. The auto-fade technology handles the blending for you, so you don't need any barber skills.",
  },
  {
    id: "mistake-prevention",
    question: "What if I mess up while cutting?",
    answer:
      "GLYDE is built to prevent that. If you move too fast, the blade automatically retracts. If the angle is off, it compensates in real time. The system is designed to make mistakes nearly impossible — even on your first try.",
  },
  {
    id: "hair-types",
    question: "Does it work for all hair types?",
    answer:
      "GLYDE is optimized for head hair and works across a range of hair types and textures. The smart blade adapts to different densities, and the app includes styles tested across various head shapes.",
  },
  {
    id: "shipping",
    question: "When will GLYDE ship?",
    answer:
      "We expect to begin shipping in October 2026. Reserve holders will receive exact shipping dates and updates via email as we approach launch.",
  },
] as const;

export type FeatureCard = (typeof featureCards)[number];
export type ResultProfile = (typeof resultProfiles)[number];
export type AutoFadeStep = (typeof autoFadeSteps)[number];
export type DesignCraftCard = (typeof designCraftCards)[number];
export type SmartModeStep = (typeof smartModeSteps)[number];
export type Testimonial = (typeof testimonials)[number];
export type Faq = (typeof faqs)[number];
