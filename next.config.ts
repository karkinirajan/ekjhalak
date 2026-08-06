import type { NextConfig } from "next";
import { remoteImagePatterns } from "./lib/image-hosts";

const securityHeaders = [
  {
    // Prevent clickjacking
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires unsafe-inline for runtime scripts; unsafe-eval for dev-mode
      // stack reconstruction (React never uses eval in production).
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
  },
};

export default nextConfig;
