import type { Metadata } from "next";
import { StandingPage } from "@/components/standing-page";
import { SITE_PAGES } from "@/lib/site-pages";

export const metadata: Metadata = {
  title: "Terms of use",
  description: SITE_PAGES.terms.en.intro,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return <StandingPage slug="terms" />;
}
