import type { Metadata } from "next";
import { StandingPage } from "@/components/standing-page";
import { SITE_PAGES } from "@/lib/site-pages";

export const metadata: Metadata = {
  title: "Contact",
  description: SITE_PAGES.contact.en.intro,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return <StandingPage slug="contact" />;
}
