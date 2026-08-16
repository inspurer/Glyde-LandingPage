import { LandingPage } from "@/components/LandingPage";
import { faqs } from "@/lib/content";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://glydeclipper.com/#organization",
      name: "GLYDE",
      legalName: "Shenzhen Kuaiku Innovation Information Technology Co., Ltd.",
      url: "https://glydeclipper.com/",
      logo: "https://glydeclipper.com/assets/figma/logo.png",
      sameAs: [
        "https://www.facebook.com/GLYDEsmartclipper",
        "https://www.instagram.com/glyde_smartclipper/",
        "https://www.youtube.com/@smarthairclipper",
        "https://www.linkedin.com/company/glydesmartclipper",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://glydeclipper.com/#website",
      url: "https://glydeclipper.com/",
      name: "GLYDE",
      inLanguage: "en-US",
      publisher: { "@id": "https://glydeclipper.com/#organization" },
    },
    {
      "@type": "ImageObject",
      "@id": "https://glydeclipper.com/#primaryimage",
      url: "https://glydeclipper.com/assets/figma/hero-photo.png",
      contentUrl: "https://glydeclipper.com/assets/figma/hero-photo.png",
      width: 2048,
      height: 1152,
      caption: "GLYDE smart auto-fade clipper in use at home",
    },
    {
      "@type": "WebPage",
      "@id": "https://glydeclipper.com/#webpage",
      url: "https://glydeclipper.com/",
      name: "GLYDE Smart Auto-Fade Clipper | Perfect Fades at Home",
      description:
        "Discover GLYDE, a guided smart clipper with Auto-Fade, real-time sensing and continuous blade-length control for consistent at-home haircuts.",
      inLanguage: "en-US",
      isPartOf: { "@id": "https://glydeclipper.com/#website" },
      about: { "@id": "https://glydeclipper.com/#product" },
      primaryImageOfPage: { "@id": "https://glydeclipper.com/#primaryimage" },
    },
    {
      "@type": "Product",
      "@id": "https://glydeclipper.com/#product",
      name: "GLYDE Smart Auto-Fade Clipper",
      image: ["https://glydeclipper.com/assets/figma/body-image-1.png"],
      description:
        "A guided smart hair clipper with auto-fade technology, real-time sensing and a continuously adjustable blade.",
      brand: { "@type": "Brand", name: "GLYDE" },
      manufacturer: { "@id": "https://glydeclipper.com/#organization" },
      url: "https://glydeclipper.com/",
      mainEntityOfPage: { "@id": "https://glydeclipper.com/#webpage" },
      category: "Electric hair clippers",
      additionalProperty: [
        {
          "@type": "PropertyValue",
          name: "Cutting modes",
          value: "Auto-Fade, Smart Mode and Manual Mode",
        },
        {
          "@type": "PropertyValue",
          name: "Blade length",
          value: "Continuously adjustable from 0.2 to 0.8 inches",
        },
        {
          "@type": "PropertyValue",
          name: "Guidance",
          value: "App-guided haircut steps with real-time motion and angle sensing",
        },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": "https://glydeclipper.com/#faq",
      isPartOf: { "@id": "https://glydeclipper.com/#webpage" },
      mainEntity: faqs.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <LandingPage />
    </>
  );
}
