import type { Metadata } from "next";
import { StandingPage } from "@/components/standing-page";
import { SITE_PAGES } from "@/lib/site-pages";

export const metadata: Metadata = {
  title: "Privacy",
  description: SITE_PAGES.privacy.en.intro,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <StandingPage slug="privacy" />;
}
