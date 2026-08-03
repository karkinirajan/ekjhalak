import type { Metadata } from "next";
import { StandingPage } from "@/components/standing-page";
import { OWNER_NAME, OWNER_URL, SITE_PAGES } from "@/lib/site-pages";

export const metadata: Metadata = {
  title: "About",
  description: SITE_PAGES.about.en.intro,
  alternates: { canonical: "/about" },
  authors: [{ name: OWNER_NAME, url: OWNER_URL }],
};

export default function AboutPage() {
  return <StandingPage slug="about" />;
}
