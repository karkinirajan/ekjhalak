import type { NextConfig } from "next";

const securityHeaders = [
  {
    // Prevent clickjacking
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires unsafe-inline for its runtime scripts & hydration chunks
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Tailwind and shadcn inject inline styles
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Google Fonts static assets
      "font-src 'self' https://fonts.gstatic.com",
      // Images: self + data URIs + all HTTPS sources (RSS feeds supply arbitrary CDNs)
      "img-src 'self' data: https:",
      // External API calls made from the browser (translation APIs are server-only,
      // but allow 'self' for /api/* and the site URL for refresh)
      "connect-src 'self'",
      // Never allow this page to be embedded
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]
      .join("; ")
      .trim(),
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      // Nepal national sources
      { protocol: "https", hostname: "kathmandupost.com" },
      { protocol: "https", hostname: "english.onlinekhabar.com" },
      { protocol: "https", hostname: "risingnepaldaily.com" },
      { protocol: "https", hostname: "ekantipur.com" },
      { protocol: "https", hostname: "www.gorkhapatraonline.com" },
      // Nepal sources
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
      { protocol: "https", hostname: "rss.cnn.com" },
      { protocol: "https", hostname: "www.cnn.com" },
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
