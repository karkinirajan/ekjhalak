import type { NextConfig } from "next";
import { remoteImagePatterns } from "./lib/image-hosts";

const securityHeaders = [
  {
    // Prevent clickjacking
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // `'unsafe-eval'` is development-only. Next.js needs it for dev-mode stack
      // reconstruction and HMR; the production bundle does not call eval or the
      // Function constructor, and the comment that used to sit here said so
      // while shipping it to production anyway.
      //
      // `'unsafe-inline'` stays, and this is the honest version of why rather
      // than a TODO. Replacing it needs a nonce on every inline script, which
      // means generating one per request and threading it through — and that
      // requires the document to be dynamically rendered. This site's homepage
      // is ISR precisely so a reader gets static HTML, so a nonce would trade
      // the whole caching story for a CSP tightening on a page that has no
      // third-party script and no user-generated HTML. The two inline scripts
      // are ours: the language-before-paint shim and the JSON-LD block.
      `script-src 'self' 'unsafe-inline'${
        process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"
      }`,
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
    // CSP frame-ancestors 'none' is the modern equivalent; X-Frame-Options DENY
    // adds compatibility for older browsers that don't parse CSP.
    key: "X-Frame-Options",
    value: "DENY",
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
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "cross-origin",
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
    // The allowlist lives in lib/image-hosts.ts so that story-image.tsx can ask
    // the same question at render time and fall back to a plain <img> for hosts
    // that are not on it, rather than throwing and showing a broken card.
    remotePatterns: [...remoteImagePatterns],

    // story-image.tsx asks for `quality={70}`, and without this every image was
    // still being served at 75. Next.js 16 only honours quality values named
    // here and silently falls back to the default otherwise, so the prop was
    // dead: 243 images on the homepage, every one of them q=75.
    qualities: [70],

    // The generated srcset ran to 3840w for frames that paint at most 400px on
    // desktop and one viewport width on mobile. `sizes` meant a browser never
    // chose those rungs, so they cost no bandwidth — but every one of them is a
    // URL the optimizer will transcode if anything ever requests it, and a
    // 4K re-encode of a publisher's photograph is not a variant this site has a
    // use for. The ladder now stops at 1920.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 96, 128, 256, 384],

    // Publisher photographs are immutable once fetched — the URL changes when
    // the picture does. A day is the floor Next.js would otherwise take from
    // whatever Cache-Control the origin happened to send, which for several of
    // these CDNs is no header at all.
    minimumCacheTTL: 86400,
  },
};

export default nextConfig;
