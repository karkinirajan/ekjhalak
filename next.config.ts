import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Nepal national sources
      { protocol: "https", hostname: "kathmandupost.com" },
      { protocol: "https", hostname: "english.onlinekhabar.com" },
      { protocol: "https", hostname: "risingnepaldaily.com" },
      { protocol: "https", hostname: "ekantipur.com" },
      { protocol: "https", hostname: "www.gorkhapatraonline.com" },
      // New Nepal sources
      { protocol: "https", hostname: "myrepublica.nagariknetwork.com" },
      { protocol: "https", hostname: "thehimalayantimes.com" },
      { protocol: "https", hostname: "en.setopati.com" },
      { protocol: "https", hostname: "www.setopati.com" },
      { protocol: "https", hostname: "ratopati.com" },
      { protocol: "https", hostname: "nagariknews.nagariknetwork.com" },
      // International sources
      { protocol: "https", hostname: "feeds.reuters.com" },
      { protocol: "https", hostname: "www.aljazeera.com" },
      { protocol: "https", hostname: "ichef.bbci.co.uk" },
      { protocol: "https", hostname: "ichef.bbc.co.uk" },
      { protocol: "https", hostname: "www.dw.com" },
      { protocol: "https", hostname: "www.france24.com" },
      { protocol: "https", hostname: "i.guim.co.uk" },
      { protocol: "https", hostname: "www.thehindu.com" },
      { protocol: "https", hostname: "static.toiimg.com" },
      { protocol: "https", hostname: "feeds.feedburner.com" },
      { protocol: "https", hostname: "static.ndtv.com" },
      { protocol: "https", hostname: "rss.nytimes.com" },
      { protocol: "https", hostname: "www.politico.eu" },
      { protocol: "https", hostname: "cdn.cnn.com" },
      { protocol: "http", hostname: "rss.cnn.com" },
      { protocol: "https", hostname: "www.scmp.com" },
      { protocol: "https", hostname: "cdn.i-scmp.com" },
      // Generic CDN patterns that news sites use
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "**.cloudinary.com" },
      { protocol: "https", hostname: "**.wp.com" },
      { protocol: "https", hostname: "i0.wp.com" },
      { protocol: "https", hostname: "i1.wp.com" },
      { protocol: "https", hostname: "i2.wp.com" },
    ],
  },
};

export default nextConfig;
