import type { MetadataRoute } from "next";

// This deployment is a preview of glydeclipper.com. Nothing here should be
// indexed anywhere: duplicate copies of the production landing page would
// compete with the real site in search results.
//
// robots.txt is only the first of three layers — it asks well-behaved crawlers
// not to fetch, but a URL linked from elsewhere can still be indexed without
// being crawled. The `noindex` metadata in app/layout.tsx and the X-Robots-Tag
// header in next.config.ts are what actually keep it out of the index.
const blockedCrawlers = [
  // Google
  "Googlebot",
  "Googlebot-Image",
  "Googlebot-News",
  "Googlebot-Video",
  "AdsBot-Google",
  "AdsBot-Google-Mobile",
  "Mediapartners-Google",
  "Google-Extended",
  "APIs-Google",
  // Bing / Microsoft
  "bingbot",
  "msnbot",
  "BingPreview",
  "adidxbot",
  // Baidu
  "Baiduspider",
  "Baiduspider-image",
  "Baiduspider-video",
  "Baiduspider-news",
  // 360
  "360Spider",
  "360Spider-Image",
  "360Spider-Video",
  "HaosouSpider",
  // Other major search engines
  "Sogou web spider",
  "Sogou inst spider",
  "YisouSpider",
  "Yandex",
  "YandexBot",
  "Slurp",
  "DuckDuckBot",
  "Applebot",
  "Bytespider",
  "PetalBot",
  "SeznamBot",
  "Exabot",
  "facebookexternalhit",
  // Crawlers that harvest for model training or answer engines
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "CCBot",
  "Amazonbot",
  "Applebot-Extended",
  "meta-externalagent",
  "Diffbot",
  // Aggressive SEO crawlers
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "BLEXBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", disallow: "/" },
      ...blockedCrawlers.map((userAgent) => ({ userAgent, disallow: "/" })),
    ],
    // No sitemap is advertised on purpose: submitting one would invite exactly
    // the indexing this file exists to prevent.
  };
}
