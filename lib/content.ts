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
    quote:
      "I love that it's easy for me to do on my own, at home and that it saves me money and time. I don't plan on going back to a barber any time soon.",
    name: "Cory M.",
    meta: "USA — Multiple self-cuts",
  },
  {
    id: "testimonial-03",
    rating: 4,
    quote: testimonialQuote,
    name: "Paolo P.",
    meta: "Italy — 20 years of home cutting",
  },
  {
    id: "testimonial-04",
    rating: 5,
    quote: "It's really easy to pick up — I let my daughter use it on me, and the cut came out great.",
    name: "Yue Y.",
    meta: "Daughter's first try",
  },
] as const;

export const faqs = [
  {
    id: "beginner-friendly",
    question: "Is GLYDE beginner-friendly?",
    answer:
      "Yes. GLYDE is designed for people with little or no haircutting experience. Simply choose a hairstyle in the app and follow the step-by-step visual and audio guidance. As you cut, GLYDE automatically adjusts the blade to help you achieve a smooth, even result.",
  },
  {
    id: "automatic-fade",
    question: "How does GLYDE create an automatic fade?",
    answer:
      "Built-in sensors track the clipper’s movement distance, speed, tilt, and angle in real time. GLYDE then automatically adjusts the cutting length as you move. The fade-band marks where the fade should begin, helping create a smooth and consistent transition between lengths.",
  },
  {
    id: "self-haircut",
    question: "Can I use GLYDE to cut my own hair?",
    answer:
      "Yes. GLYDE is designed to make self-haircuts easier with step-by-step guidance in the app. If it’s your first time, we recommend starting with a simple style, taking your time, and using a mirror for areas that are harder to see.",
  },
  {
    id: "supported-hair",
    question: "What hairstyles and hair types does GLYDE support?",
    answer:
      "GLYDE is designed primarily for short hairstyles, including buzz cuts, crew cuts, side parts, fades, tapers, and side-and-back touch-ups. It is not currently designed for long hairstyles, very curly hair, or skin fades.",
  },
  {
    id: "mistake-prevention",
    question: "How does GLYDE help prevent mistakes?",
    answer:
      "GLYDE continuously monitors how you move and holds the clipper. If you move too quickly or use an incorrect angle, it can adjust the cutting length and provide guidance to help reduce harsh lines, uneven transitions, and accidental overcutting. For the best results, follow the app and move slowly and steadily.",
  },
  {
    id: "offline",
    question: "Does the GLYDE app work offline?",
    answer:
      "Yes. Once you’ve completed the initial setup and downloaded your chosen hairstyle, you can follow the guidance without Wi-Fi or mobile data. You’ll still need an internet connection to download new styles, sync content, and install updates.",
  },
  {
    id: "battery-cleaning",
    question: "How long does the battery last, and how do I clean GLYDE?",
    answer:
      "GLYDE has a 2600mAh battery and provides approximately two hours of runtime on a full charge. It charges via USB-C. GLYDE is not waterproof, so do not rinse or submerge it in water. After each use, clean the blade with the included brush and apply lubricating oil as needed.",
  },
] as const;

export type FeatureCard = (typeof featureCards)[number];
export type ResultProfile = (typeof resultProfiles)[number];
export type AutoFadeStep = (typeof autoFadeSteps)[number];
export type DesignCraftCard = (typeof designCraftCards)[number];
export type SmartModeStep = (typeof smartModeSteps)[number];
export type Testimonial = (typeof testimonials)[number];
export type Faq = (typeof faqs)[number];
