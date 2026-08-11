import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "GLYDE — Smart Auto-Fade Clipper",
    short_name: "GLYDE",
    description:
      "Meet GLYDE, the smart auto-fade hair clipper designed for guided, confident at-home haircuts.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    lang: "en-US",
    categories: ["beauty", "lifestyle", "shopping"],
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
