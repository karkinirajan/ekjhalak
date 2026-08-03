// lib/site-pages.ts
// Copy for the standing pages — about, editorial standards, privacy, terms,
// contact — in both languages the site publishes in.
//
// Held as data rather than as JSX so each page is one small component and the
// English and Nepali versions cannot drift structurally: they are the same
// object shape, so a section added to one is a type error until it exists in the
// other.
//
// Everything here is a claim about how this site actually behaves. If the
// pipeline changes, this file changes with it — a privacy page that describes
// last year's implementation is worse than no privacy page.

import type { Lang } from "./i18n";

export interface PageSection {
  heading: string;
  /** Paragraphs. Rendered in order, no markdown. */
  body: string[];
}

export interface PageContent {
  kicker: string;
  title: string;
  intro: string;
  sections: PageSection[];
}

export type PageSlug =
  | "about"
  | "editorial-standards"
  | "privacy"
  | "terms"
  | "contact";

/**
 * Stated on the pages that make dated promises, so a reader can tell whether
 * what they are reading is current. Bumped by hand when the copy changes —
 * deriving it from a build date would make every deploy look like a policy
 * change.
 */
export const POLICY_UPDATED = "2026-08-03";

/** The byline: the person's own name, linked to their site. */
export const OWNER_DISPLAY_NAME = "Nirajan Karki";
export const OWNER_NAME = "kneeraazon";
export const OWNER_URL = "https://kneeraazon.com";
export const SOURCE_COUNT = 40;

const about: Record<Lang, PageContent> = {
  en: {
    kicker: "About",
    title: "One glance at the day",
    intro:
      "EkJhalak is a bilingual news reader for Nepal. It gathers what the country's newsrooms and the major international wires published in the last few hours, removes the duplicates, and puts what is left on one quiet page you can read in English or Nepali.",
    sections: [
      {
        heading: "What it is",
        body: [
          `EkJhalak reads the public feeds of roughly ${SOURCE_COUNT} newsrooms — Nepali dailies and broadcasters alongside international outlets — several times an hour. Each story is summarised in the language it was published in and then translated into the other, so the same page serves a reader in either language.`,
          "Stories that several newsrooms ran are recognised as one story rather than five, and that count is shown on the card. It is the only popularity signal on the site, because it is the only one we actually measure.",
        ],
      },
      {
        heading: "What it is not",
        body: [
          "EkJhalak does not employ reporters and does not break news. Every story here was reported by somebody else, and every card links back to the newsroom that did the work.",
          "It does not host full articles. What you get is a brief — enough to know whether the story matters to you — and a direct route to the publisher for the rest.",
          "There are no advertisements, no sponsored placements, no recommendation engine and no infinite scroll. The order of the page is decided by how many outlets covered a story, how much weight the source carries and how recent it is, and by nothing about you.",
        ],
      },
      {
        heading: "Who runs it",
        body: [
          `EkJhalak is built and operated by ${OWNER_DISPLAY_NAME}, an independent developer. It is a personal project rather than a company, and it is not funded by, affiliated with or editorially directed by any of the newsrooms it links to.`,
          `Work, contact details and other projects are at ${OWNER_URL}.`,
        ],
      },
      {
        heading: "How it is paid for",
        body: [
          "It is not. There is no revenue, no advertising and no paid placement, and nothing on this site can be bought. If that ever changes it will be written here first and marked plainly on the page.",
        ],
      },
    ],
  },
  np: {
    kicker: "हाम्रो बारेमा",
    title: "दिनभरको समाचार, एकै झलकमा",
    intro:
      "एक झलक नेपालका लागि बनेको द्विभाषिक समाचार वाचनालय हो। यसले देशका सञ्चारगृह र प्रमुख अन्तर्राष्ट्रिय समाचार संस्थाले पछिल्ला केही घण्टामा प्रकाशित गरेका समाचार जम्मा गर्छ, दोहोरिएका हटाउँछ, र बाँकीलाई एउटै सफा पृष्ठमा नेपाली वा अङ्ग्रेजी — जुन भाषामा पढ्न चाहनुहुन्छ — प्रस्तुत गर्छ।",
    sections: [
      {
        heading: "यो के हो",
        body: [
          `एक झलकले करिब ${SOURCE_COUNT} सञ्चारगृहका सार्वजनिक फिड — नेपाली दैनिक र प्रसारण संस्थासँगै अन्तर्राष्ट्रिय सञ्चारमाध्यम — घण्टामा धेरैपटक पढ्छ। हरेक समाचारको सारांश प्रकाशित भएकै भाषामा तयार गरिन्छ र त्यसपछि अर्को भाषामा अनुवाद गरिन्छ, ताकि एउटै पृष्ठले दुवै भाषाका पाठकलाई काम लागोस्।`,
          "धेरै सञ्चारगृहले समेटेको समाचारलाई पाँचवटा होइन, एउटै समाचारका रूपमा चिनिन्छ र कतिवटा सञ्चारगृहले समेटे भन्ने सङ्ख्या कार्डमै देखाइन्छ। साइटमा देखिने लोकप्रियताको एक मात्र सङ्केत यही हो, किनभने हामीले वास्तवमै नाप्ने कुरा यही मात्र हो।",
        ],
      },
      {
        heading: "यो के होइन",
        body: [
          "एक झलकसँग आफ्ना संवाददाता छैनन् र यसले आफैँ समाचार ब्रेक गर्दैन। यहाँका हरेक समाचार अरू कसैले संकलन गरेका हुन्, र हरेक कार्ड त्यही सञ्चारगृहमा जोडिएको छ।",
          "यसले पूरा समाचार आफ्नो साइटमा राख्दैन। यहाँ तपाईंले संक्षिप्त सार पाउनुहुन्छ — त्यो समाचार तपाईंका लागि महत्त्वपूर्ण छ कि छैन थाहा पाउन पर्याप्त — र बाँकीका लागि सिधै प्रकाशकसम्म पुग्ने बाटो।",
          "यहाँ विज्ञापन छैन, प्रायोजित सामग्री छैन, सिफारिस इन्जिन छैन र अनन्त स्क्रोल पनि छैन। पृष्ठको क्रम कति सञ्चारगृहले समेटे, स्रोतको भार कति छ र समाचार कति नयाँ छ भन्ने आधारमा तय हुन्छ — तपाईंको बारेमा कुनै कुराले होइन।",
        ],
      },
      {
        heading: "कसले चलाउँछ",
        body: [
          `एक झलक स्वतन्त्र डेभलपर ${OWNER_DISPLAY_NAME} ले बनाएका र सञ्चालन गरेका हुन्। यो कुनै कम्पनी नभई व्यक्तिगत परियोजना हो, र यसले जोड्ने कुनै पनि सञ्चारगृहबाट यसलाई आर्थिक सहयोग, सम्बद्धता वा सम्पादकीय निर्देशन प्राप्त हुँदैन।`,
          `काम, सम्पर्क विवरण र अन्य परियोजनाहरू ${OWNER_URL} मा हेर्न सकिन्छ।`,
        ],
      },
      {
        heading: "खर्च कसरी चल्छ",
        body: [
          "चल्दैन। यहाँ कुनै आम्दानी छैन, विज्ञापन छैन, पैसा तिरेर राखिने सामग्री छैन, र यो साइटमा केही पनि किन्न सकिँदैन। भविष्यमा यो बदलिए सबभन्दा पहिले यहीँ लेखिनेछ र पृष्ठमै स्पष्ट देखिनेछ।",
        ],
      },
    ],
  },
};

const editorial: Record<Lang, PageContent> = {
  en: {
    kicker: "Editorial standards",
    title: "How these summaries are made",
    intro:
      "Every summary and every translation on this site is written by a language model, not by a person. That is a real limitation and this page states plainly what it means, what is done to contain it, and what to do when you find it has gone wrong.",
    sections: [
      {
        heading: "The pipeline",
        body: [
          "A story arrives as an RSS entry: a headline, a link, a timestamp and whatever body text the publisher chose to syndicate. Subscription pitches, copyright lines and section labels are stripped mechanically before anything else happens.",
          "What remains is sent to Google's Gemini models, which are asked for two things: a summary in the language the story was published in, and a translation of both headline and summary into the other. The instruction is explicit that only facts present in the source may be used and that no name, number, quote or date may be invented.",
          "A translation that comes back in the wrong script is discarded and the original is shown instead. A summary that comes back as publisher boilerplate is discarded and the card renders the headline alone. Nothing is padded to fill a card.",
        ],
      },
      {
        heading: "What we do not do",
        body: [
          "Headlines are never rewritten. The headline on a card is the publisher's own, exactly as they filed it — it is the string we are most confident is accurate, and it is what you will see again if you follow the link.",
          "No story is generated, extended or combined. If a feed gives us only a headline, the card shows only a headline.",
          "No engagement metric is displayed, because none is collected. The coverage count on a card is the number of distinct newsrooms observed running the same story — a measurement, not an estimate of what other readers did.",
        ],
      },
      {
        heading: "Where it can fail",
        body: [
          "Machine summarisation compresses, and compression loses things: a qualifying clause, an attribution, the difference between an allegation and a finding. Machine translation adds a second layer of the same risk, and it is more likely to go wrong on Nepali than on English.",
          "Translated stories are labelled as machine translated wherever they are shown in full, and the original text is always one click away at the source. When a brief and the source article disagree, the source article is correct.",
        ],
      },
      {
        heading: "Corrections",
        body: [
          `Errors in the summaries and translations here are ours, not the publisher's. Report one at ${OWNER_URL} and it will be corrected or the story removed.`,
          "Errors in the underlying reporting belong to the newsroom that published it, and should go to them. Every card links to the original for exactly this reason.",
        ],
      },
    ],
  },
  np: {
    kicker: "सम्पादकीय मापदण्ड",
    title: "यी सारांश कसरी बन्छन्",
    intro:
      "यस साइटका हरेक सारांश र हरेक अनुवाद मानिसले होइन, भाषा मोडेलले लेखेको हो। यो वास्तविक सीमा हो, र यो पृष्ठले त्यसको अर्थ के हो, त्यसलाई नियन्त्रण गर्न के गरिन्छ र गल्ती भेट्दा के गर्ने भन्ने कुरा स्पष्ट रूपमा भन्छ।",
    sections: [
      {
        heading: "प्रक्रिया",
        body: [
          "समाचार RSS प्रविष्टिका रूपमा आउँछ: शीर्षक, लिंक, समय र प्रकाशकले पठाउन रोजेको जति मूल पाठ। सदस्यताको आग्रह, प्रतिलिपि अधिकारका हरफ र खण्डका लेबल सबभन्दा पहिले यान्त्रिक रूपमै हटाइन्छ।",
          "बाँकी रहेको पाठ गुगलको जेमिनाई मोडेलमा पठाइन्छ र दुई कुरा मागिन्छ: समाचार प्रकाशित भएकै भाषामा सारांश, र शीर्षक तथा सारांश दुवैको अर्को भाषामा अनुवाद। निर्देशनमा स्पष्ट लेखिएको हुन्छ — स्रोतमा भएका तथ्य मात्र प्रयोग गर्नु र कुनै नाम, अङ्क, भनाइ वा मिति नबनाउनु।",
          "गलत लिपिमा फर्केको अनुवाद फालिन्छ र मूल पाठ नै देखाइन्छ। प्रकाशकको विज्ञापनजस्तो सारांश फर्केमा त्यो पनि फालिन्छ र कार्डमा शीर्षक मात्र देखिन्छ। कार्ड भर्नका लागि केही थपिँदैन।",
        ],
      },
      {
        heading: "हामी के गर्दैनौं",
        body: [
          "शीर्षक कहिल्यै पुनर्लेखन गरिँदैन। कार्डमा देखिने शीर्षक प्रकाशकले पठाएकै हो — यो नै हामीसँग भएको सबभन्दा भरपर्दो पाठ हो, र लिंकमा जाँदा तपाईंले फेरि यही देख्नुहुनेछ।",
          "कुनै पनि समाचार बनाइँदैन, तन्काइँदैन वा जोडिँदैन। फिडले शीर्षक मात्र दिएको छ भने कार्डमा शीर्षक मात्र देखिन्छ।",
          "कुनै एङ्गेजमेन्ट तथ्याङ्क देखाइँदैन, किनभने त्यस्तो केही सङ्कलन नै गरिँदैन। कार्डमा देखिने सङ्ख्या उही समाचार चलाएका फरक-फरक सञ्चारगृहको गणना हो — अनुमान होइन, नाप हो।",
        ],
      },
      {
        heading: "कहाँ चुक्न सक्छ",
        body: [
          "मेसिनले गर्ने सारांशले पाठ खुम्च्याउँछ, र खुम्चाउँदा केही कुरा हराउँछ: कुनै सर्त, कुनै श्रेय, आरोप र प्रमाणित निष्कर्षबीचको भिन्नता। मेसिन अनुवादले त्यही जोखिमको अर्को तह थप्छ, र अङ्ग्रेजीभन्दा नेपालीमा चुक्ने सम्भावना बढी हुन्छ।",
          "अनुवाद गरिएका समाचार पूरै देखाइने ठाउँमा 'मेसिन अनुवाद' भनी छुट्टै सङ्केत गरिन्छ, र मूल पाठ स्रोतमा सधैँ एक क्लिक टाढा हुन्छ। सारांश र मूल समाचारबीच मतभेद देखिएमा मूल समाचार नै सही हो।",
        ],
      },
      {
        heading: "सच्याइ",
        body: [
          `यहाँका सारांश र अनुवादमा हुने गल्ती हाम्रो हो, प्रकाशकको होइन। ${OWNER_URL} मा जानकारी गराउनुभयो भने सच्याइनेछ वा त्यो समाचार हटाइनेछ।`,
          "मूल समाचारमै हुने गल्ती त्यो प्रकाशित गर्ने सञ्चारगृहको हो र त्यहीँ जानुपर्छ। ठीक यही कारणले हरेक कार्ड मूल स्रोतमा जोडिएको छ।",
        ],
      },
    ],
  },
};

const privacy: Record<Lang, PageContent> = {
  en: {
    kicker: "Privacy",
    title: "What this site knows about you",
    intro:
      "Almost nothing, and not by accident. There is no account to create, no tracking pixel, no advertising network and no profile built from what you read. This page lists everything that is stored or sent anywhere.",
    sections: [
      {
        heading: "Stored in your browser",
        body: [
          "Two values, in localStorage on your own device: your theme choice (light or dark) and your language choice (English or Nepali). They are read only to render the page the way you left it, they never leave your browser, and clearing site data removes them.",
          "No cookies are set by this site.",
        ],
      },
      {
        heading: "Collected by the site",
        body: [
          "No account, no name, no email — unless you type one into the newsletter form. Nothing you read, click, search for or filter by is recorded or associated with you. There is no analytics product measuring your session and no advertising identifier.",
          "The news feed is the same for every reader. Nothing on this site is personalised, which also means there is nothing to personalise it from.",
        ],
      },
      {
        heading: "The newsletter",
        body: [
          "If you submit an email address it is forwarded to the mailing-list provider configured for the site and is not stored here. If no provider is configured the form tells you signups are not open and the address is discarded.",
          "That address is used for the daily briefing and for nothing else. It is never sold, rented or shared. Every email carries an unsubscribe link.",
        ],
      },
      {
        heading: "Third parties",
        body: [
          "The site is hosted on Vercel, which necessarily processes the request in order to serve the page and keeps standard server logs. Vercel Speed Insights measures page-load performance; it reports timings, not people, and is not used to identify or follow anyone.",
          "Fonts are served from Google Fonts. Story photographs are loaded directly from each publisher's own image servers, which means those servers see the request — the site sends no referrer with it.",
          "Story text is sent to Google's Gemini API to be summarised and translated. What is sent is the publisher's own headline and syndicated body text, which is already public. Nothing about you is included, because nothing about you is held.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          `There is no personal data here to request, correct or delete, other than a newsletter address if you gave one. To have that removed, use the unsubscribe link in any email or write to ${OWNER_URL}.`,
          `Last updated ${POLICY_UPDATED}.`,
        ],
      },
    ],
  },
  np: {
    kicker: "गोपनीयता",
    title: "यो साइटलाई तपाईंको बारेमा के थाहा छ",
    intro:
      "लगभग केही पनि छैन, र यो संयोग होइन। यहाँ खाता खोल्नुपर्दैन, ट्र्याकिङ पिक्सेल छैन, विज्ञापन सञ्जाल छैन र तपाईंले पढेको आधारमा कुनै प्रोफाइल बनाइँदैन। यो पृष्ठले भण्डारण हुने वा कतै पठाइने सबै कुरा सूचीबद्ध गर्छ।",
    sections: [
      {
        heading: "तपाईंको ब्राउजरमा राखिने",
        body: [
          "तपाईंकै यन्त्रको localStorage मा दुई कुरा: थिमको छनोट (उज्यालो वा अँध्यारो) र भाषाको छनोट (नेपाली वा अङ्ग्रेजी)। तपाईंले छोडेकै रूपमा पृष्ठ देखाउन मात्र यी पढिन्छन्, ब्राउजरबाट बाहिर जाँदैनन्, र साइट डाटा मेट्दा हराउँछन्।",
          "यो साइटले कुनै कुकी राख्दैन।",
        ],
      },
      {
        heading: "साइटले सङ्कलन गर्ने",
        body: [
          "खाता छैन, नाम छैन, इमेल छैन — न्यूजलेटर फारममा आफैँ नलेखेसम्म। तपाईंले के पढ्नुभयो, कता क्लिक गर्नुभयो, के खोज्नुभयो वा कुन फिल्टर लगाउनुभयो, केही पनि रेकर्ड हुँदैन र तपाईंसँग जोडिँदैन। तपाईंको सत्र नाप्ने कुनै एनालिटिक्स उत्पादन छैन र विज्ञापन पहिचानक पनि छैन।",
          "समाचार फिड सबै पाठकका लागि उस्तै हुन्छ। यहाँ केही पनि व्यक्तिअनुसार बदलिँदैन, जसको अर्थ बदल्नका लागि केही सङ्कलन पनि गरिँदैन।",
        ],
      },
      {
        heading: "न्यूजलेटर",
        body: [
          "तपाईंले इमेल ठेगाना पठाउनुभयो भने त्यो साइटका लागि तय गरिएको मेलिङ-लिस्ट सेवामा पठाइन्छ, यहाँ भण्डारण गरिँदैन। कुनै सेवा तय नभएको अवस्थामा फारमले दर्ता खुला नभएको जानकारी दिन्छ र ठेगाना फालिन्छ।",
          "त्यो ठेगाना दैनिक ब्रिफिङका लागि मात्र प्रयोग हुन्छ, अरू केहीका लागि होइन। कहिल्यै बेचिँदैन, भाडामा दिइँदैन वा साझा गरिँदैन। हरेक इमेलमा सदस्यता हटाउने लिंक हुन्छ।",
        ],
      },
      {
        heading: "तेस्रो पक्ष",
        body: [
          "साइट भर्सलमा होस्ट गरिएको छ, जसले पृष्ठ पठाउनका लागि अनिवार्य रूपमा अनुरोध प्रशोधन गर्छ र सामान्य सर्भर लग राख्छ। भर्सल स्पिड इनसाइट्सले पृष्ठ लोड हुने गति नाप्छ; यसले समय नाप्छ, मानिस होइन, र कसैलाई चिन्न वा पछ्याउन प्रयोग हुँदैन।",
          "फन्ट गुगल फन्ट्सबाट आउँछन्। समाचारका तस्बिर सम्बन्धित प्रकाशककै इमेज सर्भरबाट सिधै लोड हुन्छन्, जसको अर्थ ती सर्भरले अनुरोध देख्छन् — साइटले त्यससँग कुनै रेफरर पठाउँदैन।",
          "समाचारको पाठ सारांश र अनुवादका लागि गुगलको जेमिनाई एपिआईमा पठाइन्छ। पठाइने भनेको प्रकाशककै शीर्षक र सार्वजनिक रूपमै उपलब्ध मूल पाठ हो। तपाईंसम्बन्धी केही समावेश हुँदैन, किनभने तपाईंसम्बन्धी केही राखिएकै छैन।",
        ],
      },
      {
        heading: "तपाईंका अधिकार",
        body: [
          `तपाईंले न्यूजलेटरका लागि इमेल दिनुभएको छ भने त्योबाहेक यहाँ माग्न, सच्याउन वा मेट्न योग्य कुनै व्यक्तिगत डाटा छैन। त्यो हटाउन कुनै पनि इमेलको सदस्यता हटाउने लिंक प्रयोग गर्नुहोस् वा ${OWNER_URL} मा सम्पर्क गर्नुहोस्।`,
          `पछिल्लो अद्यावधिक ${POLICY_UPDATED}।`,
        ],
      },
    ],
  },
};

const terms: Record<Lang, PageContent> = {
  en: {
    kicker: "Terms",
    title: "Terms of use",
    intro:
      "Short, because the site does little on your behalf: it shows you headlines and summaries and sends you to the newsroom that wrote them.",
    sections: [
      {
        heading: "Using the site",
        body: [
          "EkJhalak is free to read, requires no account, and is offered as it stands. It may change, break or go away without notice, and no uptime is promised.",
          "Automated bulk collection — scraping the pages, hammering the API, or re-publishing the feed as your own — is not permitted. Reading it, linking to it and sharing individual stories is.",
        ],
      },
      {
        heading: "Whose words these are",
        body: [
          "Headlines, article text, photographs and every other element of the underlying reporting remain the property of the newsroom that published them. EkJhalak claims no ownership over any of it and reproduces only a headline, a short brief and a link back.",
          "If you are a publisher and you would rather your feed were not included, say so and it will be removed. No argument, no delay.",
          "The site's own design, code and the summary text it generates are the work of the operator.",
        ],
      },
      {
        heading: "Accuracy and liability",
        body: [
          "Summaries and translations are machine-generated and may be wrong. They are not a substitute for the original article and must not be relied on for any decision that matters — financial, legal, medical, safety or otherwise. When a brief and the source disagree, the source is correct.",
          "The site is provided without warranty of any kind, and the operator accepts no liability for loss arising from the use of, or reliance on, anything published here. Where the law does not permit that exclusion, liability is limited to the minimum the law allows.",
        ],
      },
      {
        heading: "Changes",
        body: [
          `These terms may be updated. The current version always sits at this address, dated. Last updated ${POLICY_UPDATED}.`,
        ],
      },
    ],
  },
  np: {
    kicker: "सर्तहरू",
    title: "प्रयोगका सर्त",
    intro:
      "छोटो छ, किनभने साइटले तपाईंका तर्फबाट धेरै केही गर्दैन: यसले शीर्षक र सारांश देखाउँछ र लेख्ने सञ्चारगृहसम्म पुर्‍याउँछ।",
    sections: [
      {
        heading: "साइटको प्रयोग",
        body: [
          "एक झलक निःशुल्क छ, खाता चाहिँदैन, र जस्तो छ त्यस्तै उपलब्ध छ। यो कुनै पनि बेला बदलिन, बिग्रन वा बन्द हुन सक्छ, र निरन्तर उपलब्धताको कुनै वाचा गरिँदैन।",
          "स्वचालित रूपमा ठूलो परिमाणमा सामग्री उतार्नु — पृष्ठ स्क्र्याप गर्नु, एपिआईमा अनावश्यक भार दिनु, वा फिडलाई आफ्नै नाममा पुनः प्रकाशित गर्नु — अनुमति छैन। पढ्नु, लिंक गर्नु र छुट्टाछुट्टै समाचार साझा गर्नु स्वागतयोग्य छ।",
        ],
      },
      {
        heading: "यी शब्द कसका हुन्",
        body: [
          "शीर्षक, समाचारको पाठ, तस्बिर र मूल पत्रकारिताका अन्य सबै अंश प्रकाशित गर्ने सञ्चारगृहकै सम्पत्ति हुन्। एक झलकले तीमाथि कुनै स्वामित्व दाबी गर्दैन र शीर्षक, छोटो सार तथा फर्किने लिंक मात्र प्रस्तुत गर्छ।",
          "तपाईं प्रकाशक हुनुहुन्छ र आफ्नो फिड यहाँ समावेश नहोस् भन्ने चाहनुहुन्छ भने जानकारी गराउनुहोस्, हटाइनेछ। कुनै तर्क हुँदैन, ढिलाइ हुँदैन।",
          "साइटको आफ्नै डिजाइन, कोड र यसले तयार गर्ने सारांश सञ्चालकको काम हो।",
        ],
      },
      {
        heading: "शुद्धता र दायित्व",
        body: [
          "सारांश र अनुवाद मेसिनले बनाएका हुन् र गलत हुन सक्छन्। यी मूल समाचारको विकल्प होइनन् र आर्थिक, कानुनी, स्वास्थ्य, सुरक्षा वा अन्य कुनै महत्त्वपूर्ण निर्णयका लागि यीमाथि भर पर्नु हुँदैन। सार र स्रोतबीच मतभेद भएमा स्रोत नै सही हो।",
          "साइट कुनै पनि प्रकारको ग्यारेन्टीबिना उपलब्ध छ, र यहाँ प्रकाशित कुनै कुराको प्रयोग वा त्यसमाथिको भरोसाबाट हुने क्षतिको दायित्व सञ्चालकले लिँदैन। कानुनले यस्तो छुट नदिने अवस्थामा दायित्व कानुनले तोकेको न्यूनतममा सीमित हुनेछ।",
        ],
      },
      {
        heading: "परिवर्तन",
        body: [
          `यी सर्त अद्यावधिक हुन सक्छन्। हालको संस्करण सधैँ यही ठेगानामा मिति सहित रहनेछ। पछिल्लो अद्यावधिक ${POLICY_UPDATED}।`,
        ],
      },
    ],
  },
};

const contact: Record<Lang, PageContent> = {
  en: {
    kicker: "Contact",
    title: "Get in touch",
    intro:
      "One person runs this site, so there is one place to write. Everything below goes to the same inbox.",
    sections: [
      {
        heading: "Corrections",
        body: [
          "A summary that misreads its source, a translation that says the wrong thing, a story filed under the wrong category, a photograph attached to the wrong headline — send it and it will be fixed or pulled.",
          "Include the headline and the outlet, which is enough to find any story on the site.",
        ],
      },
      {
        heading: "Publishers",
        body: [
          "To have a feed removed, to correct how your outlet is named or credited, or to have your newsroom added: write, and it will be handled. Removal requests are actioned without argument.",
        ],
      },
      {
        heading: "Everything else",
        body: [
          "Bugs, accessibility problems, a source worth adding, or anything about how the site works.",
          `${OWNER_DISPLAY_NAME} · ${OWNER_URL}`,
        ],
      },
    ],
  },
  np: {
    kicker: "सम्पर्क",
    title: "सम्पर्क गर्नुहोस्",
    intro:
      "यो साइट एक जनाले चलाउँछन्, त्यसैले लेख्ने ठाउँ पनि एउटै छ। तलका सबै कुरा उही इनबक्समा पुग्छन्।",
    sections: [
      {
        heading: "सच्याइ",
        body: [
          "स्रोत गलत बुझेको सारांश, फरक अर्थ दिने अनुवाद, गलत विषयमा राखिएको समाचार, गलत शीर्षकसँग जोडिएको तस्बिर — पठाउनुहोस्, सच्याइनेछ वा हटाइनेछ।",
          "शीर्षक र सञ्चारगृहको नाम पठाइदिनुभयो भने साइटको जुनसुकै समाचार खोज्न पर्याप्त हुन्छ।",
        ],
      },
      {
        heading: "प्रकाशकहरूका लागि",
        body: [
          "फिड हटाउन, आफ्नो सञ्चारगृहको नाम वा श्रेय सच्याउन, वा आफ्नो सञ्चारगृह थप्न: लेख्नुहोस्, व्यवस्था गरिनेछ। हटाउने अनुरोध कुनै तर्कबिना कार्यान्वयन गरिन्छ।",
        ],
      },
      {
        heading: "अरू सबै कुरा",
        body: [
          "त्रुटि, पहुँचसम्बन्धी समस्या, थप्न लायक कुनै स्रोत, वा साइट कसरी चल्छ भन्ने बारेका जिज्ञासा।",
          `${OWNER_DISPLAY_NAME} · ${OWNER_URL}`,
        ],
      },
    ],
  },
};

export const SITE_PAGES: Record<PageSlug, Record<Lang, PageContent>> = {
  about,
  "editorial-standards": editorial,
  privacy,
  terms,
  contact,
};
