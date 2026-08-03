import type { Metadata } from "next";
import { StandingPage } from "@/components/standing-page";
import { SITE_PAGES } from "@/lib/site-pages";

export const metadata: Metadata = {
  title: "Editorial standards",
  description: SITE_PAGES["editorial-standards"].en.intro,
  alternates: { canonical: "/editorial-standards" },
};

export default function EditorialStandardsPage() {
  return <StandingPage slug="editorial-standards" />;
}
