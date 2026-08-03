// lib/site-nav.ts
// The standing pages, in the order they are listed everywhere they are listed.
//
// One array feeds the footer, the sideways navigation at the foot of each
// standing page, and the sitemap — so adding a page is a single edit and none of
// the three can quietly fall out of step with the others.

import type { I18nDict } from "./i18n";
import type { PageSlug } from "./site-pages";

export interface StandingPageLink {
  slug: PageSlug;
  href: string;
  /** Key into the i18n dictionary, so the label follows the language toggle. */
  labelKey: keyof I18nDict;
}

export const STANDING_PAGES: StandingPageLink[] = [
  { slug: "about", href: "/about", labelKey: "navAbout" },
  {
    slug: "editorial-standards",
    href: "/editorial-standards",
    labelKey: "navEditorial",
  },
  { slug: "privacy", href: "/privacy", labelKey: "navPrivacy" },
  { slug: "terms", href: "/terms", labelKey: "navTerms" },
  { slug: "contact", href: "/contact", labelKey: "navContact" },
];
