// lib/email-address.ts
// Validating and normalizing a submitted address.
//
// Shared by the client form and the API route so the two cannot disagree about
// what counts as valid — a form that accepts what the server rejects reads to
// the reader as the site being broken.

/**
 * Deliberately not RFC 5322.
 *
 * The full grammar accepts quoted local parts, comments and bare IP literals,
 * none of which any newsletter has ever needed, and implementing it correctly
 * costs more than it returns. This checks the shape that real addresses have and
 * lets the confirmation email be the actual test of deliverability — which it
 * is regardless of what any regex says.
 */
const SHAPE = /^[^\s@,;:<>()[\]\\"]+@[^\s@,;:<>()[\]\\".]+(\.[^\s@,;:<>()[\]\\".]+)+$/;

/** RFC 5321 caps the whole address at 254 octets. */
const MAX_LENGTH = 254;

export type EmailProblem = "empty" | "too-long" | "shape" | "disposable";

export type EmailCheck =
  | { ok: true; email: string }
  | { ok: false; problem: EmailProblem };

/**
 * Throwaway inbox domains.
 *
 * Short and unambitious on purpose. A real blocklist is tens of thousands of
 * domains, needs updating forever, and every entry is a chance to reject a
 * legitimate reader — some people genuinely use these as their mail host. This
 * is only the handful that exist purely to be discarded, and the cost of being
 * wrong is one reader who can use a different address.
 */
const DISPOSABLE = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "sharklasers.com",
  "maildrop.cc",
  "dispostable.com",
]);

/**
 * Normalize and check one address.
 *
 * Lower-cased whole, including the local part. That is technically wrong — the
 * local part is case-sensitive per the RFC — but every mail host a reader will
 * actually use treats it case-insensitively, and not folding it means
 * `Reader@gmail.com` and `reader@gmail.com` become two subscribers who both
 * receive the same briefing twice.
 */
export function checkEmail(raw: unknown): EmailCheck {
  if (typeof raw !== "string") return { ok: false, problem: "empty" };

  const email = raw.trim().toLowerCase();
  if (!email) return { ok: false, problem: "empty" };
  if (email.length > MAX_LENGTH) return { ok: false, problem: "too-long" };
  if (!SHAPE.test(email)) return { ok: false, problem: "shape" };

  const domain = email.slice(email.lastIndexOf("@") + 1);
  if (DISPOSABLE.has(domain)) return { ok: false, problem: "disposable" };

  return { ok: true, email };
}
