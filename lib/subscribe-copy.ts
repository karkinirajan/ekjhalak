// lib/subscribe-copy.ts
// What the confirmation page says, in both languages.
//
// Separate from lib/i18n.ts because that dictionary is consumed through the
// client-side theme provider, and this page is a server component the reader
// reaches straight from their inbox with no React state above it. The language
// arrives in the query string instead, put there by the confirm route.

export type ConfirmStatus =
  | "confirmed"
  | "already"
  | "expired"
  | "invalid"
  | "failed"
  | "busy";

interface Copy {
  title: string;
  body: string;
  back: string;
}

/**
 * The unsubscribe page, in both languages.
 *
 * `prompt` is the state a reader sees on opening the link — a button, not an
 * action, because the link is fetched by mail scanners as well as by people and
 * must not unsubscribe anyone by being opened (see app/api/unsubscribe).
 */
export type UnsubscribeStatus = "prompt" | "done" | "invalid" | "failed" | "busy";

interface UnsubscribeCopy extends Copy {
  /** The submit button, present only on the prompt. */
  button?: string;
}

export const UNSUBSCRIBE_COPY: Record<
  "en" | "np",
  Record<UnsubscribeStatus, UnsubscribeCopy>
> = {
  en: {
    prompt: {
      title: "Unsubscribe from the daily brief?",
      body: "You will stop receiving the EkJhalak daily brief at this address:",
      button: "Unsubscribe",
      back: "Keep me subscribed",
    },
    done: {
      title: "You've been unsubscribed",
      body: "The daily brief will no longer be sent to this address. If you change your mind, you can subscribe again from the homepage at any time.",
      back: "Back to the news",
    },
    invalid: {
      title: "That link didn't work",
      body: "It may have been cut short by an email client, or it was not a link we sent. Open the unsubscribe link at the bottom of the brief again.",
      back: "Back to the news",
    },
    failed: {
      title: "Something went wrong at our end",
      body: "You have not been unsubscribed — this was our failure, not yours. Please try again in a few minutes.",
      back: "Back to the news",
    },
    busy: {
      title: "Too many attempts",
      body: "This link has been used several times in quick succession. Wait a few minutes and try once more.",
      back: "Back to the news",
    },
  },
  np: {
    prompt: {
      title: "दैनिक ब्रिफिङको सदस्यता हटाउने?",
      body: "यो ठेगानामा एक झलकको दैनिक ब्रिफिङ आउन बन्द हुनेछ:",
      button: "सदस्यता हटाउनुहोस्",
      back: "सदस्य नै रहन्छु",
    },
    done: {
      title: "तपाईंको सदस्यता हटाइयो",
      body: "अब यो ठेगानामा दैनिक ब्रिफिङ पठाइने छैन। मन फेरिएमा गृहपृष्ठबाट जतिबेला पनि फेरि सदस्य बन्न सकिन्छ।",
      back: "समाचारमा फर्कनुहोस्",
    },
    invalid: {
      title: "यो लिंकले काम गरेन",
      body: "इमेल क्लाइन्टले लिंक बीचमै काटेको हुन सक्छ, वा यो हामीले पठाएको लिंक होइन। ब्रिफिङको तलको सदस्यता हटाउने लिंक फेरि खोल्नुहोस्।",
      back: "समाचारमा फर्कनुहोस्",
    },
    failed: {
      title: "हाम्रो तर्फबाट केही गडबड भयो",
      body: "तपाईंको सदस्यता हटेको छैन — यो हाम्रो त्रुटि हो, तपाईंको होइन। केही मिनेटपछि पुनः प्रयास गर्नुहोस्।",
      back: "समाचारमा फर्कनुहोस्",
    },
    busy: {
      title: "धेरै पटक प्रयास भयो",
      body: "यो लिंक छोटो समयमै धेरै पटक प्रयोग भएको छ। केही मिनेट पर्खेर फेरि प्रयास गर्नुहोस्।",
      back: "समाचारमा फर्कनुहोस्",
    },
  },
};

export const CONFIRM_COPY: Record<"en" | "np", Record<ConfirmStatus, Copy>> = {
  en: {
    confirmed: {
      title: "You're on the list",
      body: "The EkJhalak daily brief will arrive tomorrow morning — Nepal and the world, in one short email. Every issue carries an unsubscribe link, and the address is used for nothing else.",
      back: "Back to the news",
    },
    already: {
      title: "You were already subscribed",
      body: "This address is on the list, so nothing has changed. The next brief will arrive as usual tomorrow morning.",
      back: "Back to the news",
    },
    expired: {
      title: "That link has expired",
      body: "Confirmation links last two days. Submit your address on the homepage again and a fresh one will be on its way in a moment.",
      back: "Back to the news",
    },
    invalid: {
      title: "That link didn't work",
      body: "It may have been cut short by an email client, or it was not a link we sent. Submitting your address on the homepage again will send a new one.",
      back: "Back to the news",
    },
    failed: {
      title: "Something went wrong at our end",
      body: "Your address was not added — this was our failure, not yours. Please try again in a few minutes.",
      back: "Back to the news",
    },
    busy: {
      title: "Too many attempts",
      body: "This link has been opened several times in quick succession. Wait a few minutes and open it once more.",
      back: "Back to the news",
    },
  },
  np: {
    confirmed: {
      title: "तपाईं सूचीमा हुनुहुन्छ",
      body: "एक झलकको दैनिक ब्रिफिङ भोलि बिहानदेखि आउनेछ — नेपाल र विश्व, एउटै छोटो इमेलमा। हरेक अंकमा सदस्यता हटाउने लिंक हुन्छ, र तपाईंको ठेगाना अरू केहीका लागि प्रयोग हुँदैन।",
      back: "समाचारमा फर्कनुहोस्",
    },
    already: {
      title: "तपाईं पहिल्यै सदस्य हुनुहुन्छ",
      body: "यो ठेगाना सूचीमा छ, त्यसैले केही परिवर्तन भएको छैन। अर्को ब्रिफिङ भोलि बिहान सधैंझैं आउनेछ।",
      back: "समाचारमा फर्कनुहोस्",
    },
    expired: {
      title: "यो लिंकको म्याद सकियो",
      body: "पुष्टि लिंक दुई दिनसम्म मात्र चल्छ। गृहपृष्ठमा फेरि ठेगाना पठाउनुहोस्, नयाँ लिंक तुरुन्तै आउनेछ।",
      back: "समाचारमा फर्कनुहोस्",
    },
    invalid: {
      title: "यो लिंकले काम गरेन",
      body: "इमेल क्लाइन्टले लिंक बीचमै काटेको हुन सक्छ, वा यो हामीले पठाएको लिंक होइन। गृहपृष्ठमा फेरि ठेगाना पठाउनुभयो भने नयाँ लिंक आउनेछ।",
      back: "समाचारमा फर्कनुहोस्",
    },
    failed: {
      title: "हाम्रो तर्फबाट केही गडबड भयो",
      body: "तपाईंको ठेगाना थपिएन — यो हाम्रो त्रुटि हो, तपाईंको होइन। केही मिनेटपछि पुनः प्रयास गर्नुहोस्।",
      back: "समाचारमा फर्कनुहोस्",
    },
    busy: {
      title: "धेरै पटक प्रयास भयो",
      body: "यो लिंक छोटो समयमै धेरै पटक खोलिएको छ। केही मिनेट पर्खेर एकपटक फेरि खोल्नुहोस्।",
      back: "समाचारमा फर्कनुहोस्",
    },
  },
};
