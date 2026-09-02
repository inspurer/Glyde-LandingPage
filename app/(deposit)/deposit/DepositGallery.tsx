"use client";

import Image from "next/image";
import { useState } from "react";

import styles from "./deposit.module.css";

const products = [
  {
    src: "/assets/deposit/product-01.png",
    alt: "GLYDE Auto-Fade Clipper with its adaptive blade extended",
  },
  {
    src: "/assets/deposit/product-02-cutting.png",
    alt: "GLYDE guiding an automatic fade haircut",
  },
  {
    src: "/assets/deposit/product-03-front.png",
    alt: "Front view of the GLYDE Auto-Fade Clipper",
  },
  {
    src: "/assets/deposit/product-04-fade-result.png",
    alt: "Finished fade created with GLYDE",
  },
  {
    src: "/assets/deposit/product-05-dual-angle.png",
    alt: "Two views of the GLYDE Auto-Fade Clipper",
  },
] as const;

export function DepositGallery({ variant }: { variant: "desktop" | "mobile" }) {
  const [selected, setSelected] = useState(0);

  return (
    <section
      className={`${styles.galleryLayer} ${
        variant === "desktop" ? styles.galleryDesktop : styles.galleryMobile
      }`}
      aria-label="GLYDE product gallery"
    >
      <div className={styles.galleryMain} aria-live="polite">
        <Image
          key={products[selected].src}
          className={`${styles.galleryMainImage} ${styles[`productMain${selected + 1}`]}`}
          src={products[selected].src}
          alt={products[selected].alt}
          fill
          priority={selected === 0}
          sizes={variant === "desktop" ? "41vw" : "93vw"}
        />
      </div>

      <div className={styles.galleryThumbs}>
        {products.map((product, index) => (
          <button
            className={`${styles.galleryThumb} ${
              selected === index ? styles.galleryThumbSelected : ""
            }`}
            type="button"
            key={product.src}
            onClick={() => setSelected(index)}
            aria-label={`Show product image ${index + 1} of ${products.length}`}
            aria-pressed={selected === index}
          >
            <Image
              className={`${styles.galleryThumbImage} ${styles[`productThumb${index + 1}`]}`}
              src={product.src}
              alt=""
              fill
              sizes={variant === "desktop" ? "8vw" : "17vw"}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
