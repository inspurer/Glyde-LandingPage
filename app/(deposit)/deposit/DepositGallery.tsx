"use client";

import Image from "next/image";
import { type KeyboardEvent, useRef, useState } from "react";

import styles from "./deposit.module.css";

const products = [
  {
    kind: "image",
    src: "/assets/deposit/product-01.png",
    alt: "GLYDE Auto-Fade Clipper with its adaptive blade extended",
  },
  {
    kind: "video",
    src: "/assets/deposit/product-02-20260903.mp4",
    poster: "/assets/deposit/product-02-20260903-poster.png",
    alt: "GLYDE guiding an automatic fade haircut",
  },
  {
    kind: "video",
    src: "/assets/deposit/product-03.mp4",
    poster: "/assets/deposit/product-03-front.png",
    alt: "Front view of the GLYDE Auto-Fade Clipper in motion",
  },
  {
    kind: "video",
    src: "/assets/deposit/product-04-20260903.mp4",
    poster: "/assets/deposit/product-04-20260903-poster.png",
    alt: "Finished fade created with GLYDE in motion",
  },
  {
    kind: "image",
    src: "/assets/deposit/product-05-dual-angle.png",
    alt: "Two views of the GLYDE Auto-Fade Clipper",
  },
] as const;

export function DepositGallery({ variant }: { variant: "desktop" | "mobile" }) {
  const [selected, setSelected] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const selectedProduct = products[selected];

  function selectProduct(index: number) {
    if (index === selected && products[index].kind === "video") {
      const video = videoRef.current;

      if (video) {
        video.currentTime = 0;
        void video.play();
      }

      return;
    }

    setSelected(index);
  }

  function toggleVideoPlayback() {
    const video = videoRef.current;

    if (!video) return;

    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }

  function handleVideoKeyDown(event: KeyboardEvent<HTMLVideoElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    toggleVideoPlayback();
  }

  return (
    <section
      className={`${styles.galleryLayer} ${
        variant === "desktop" ? styles.galleryDesktop : styles.galleryMobile
      }`}
      aria-label="GLYDE product gallery"
    >
      <div className={styles.galleryMain} aria-live="polite">
        {selectedProduct.kind === "image" ? (
          <Image
            key={selectedProduct.src}
            className={`${styles.galleryMainImage} ${styles[`productMain${selected + 1}`]}`}
            src={selectedProduct.src}
            alt={selectedProduct.alt}
            fill
            priority={selected === 0}
            sizes={variant === "desktop" ? "41vw" : "93vw"}
          />
        ) : (
          <video
            key={selectedProduct.src}
            ref={videoRef}
            className={styles.galleryMainVideo}
            poster={selectedProduct.poster}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            role="button"
            tabIndex={0}
            aria-label={`${selectedProduct.alt}. Press to pause or resume the video.`}
            onClick={toggleVideoPlayback}
            onKeyDown={handleVideoKeyDown}
          >
            <source src={selectedProduct.src} type="video/mp4" />
          </video>
        )}
      </div>

      <div className={styles.galleryThumbs}>
        {products.map((product, index) => (
          <button
            className={`${styles.galleryThumb} ${
              selected === index ? styles.galleryThumbSelected : ""
            }`}
            type="button"
            key={product.src}
            onClick={() => selectProduct(index)}
            aria-label={
              product.kind === "video"
                ? `Play product video ${index + 1} of ${products.length}`
                : `Show product image ${index + 1} of ${products.length}`
            }
            aria-pressed={selected === index}
          >
            <Image
              className={`${styles.galleryThumbImage} ${styles[`productThumb${index + 1}`]}`}
              src={product.kind === "video" ? product.poster : product.src}
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
