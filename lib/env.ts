// lib/env.ts
//
// Reading environment variables so that "declared but blank" means "not set".
//
// `process.env.X ?? fallback` is the obvious spelling and it is wrong for env
// vars, because `??` only falls back on `undefined` — and a variable written in
// a `.env` file or a Netlify dashboard field with nothing after the `=` is not
// undefined. It is the empty string, which `??` passes straight through.
//
// That cost a production outage worth describing, because the failure had no
// symptom pointing at the cause. `.env` carried:
//
//     NEWSLETTER_FROM=
//     NEWSLETTER_REPLY_TO=
//
// written that way deliberately, to document the names next to the values that
// had them. `fromAddress()` read `process.env.NEWSLETTER_FROM ?? "EkJhalak
// <support@ekjhalak.news>"`, got `""`, and every confirmation email was sent
// with an empty From header. Resend answered `422 The domain is invalid`, the
// subscribe route turned that into a 502, and the domain it named was verified
// and working — a direct send from the same address through the same API key
// succeeded. Nothing in the error mentioned the variable that was actually
// responsible.
//
// So: blank is absent. Every reader here trims first and treats whitespace as
// nothing, which is what someone writing `X=` in a config file means.

/**
 * A string setting, or `undefined` when the variable is missing or blank.
 *
 * Trimmed, because a trailing space in a dashboard field is invisible and
 * `" "` is not a value anybody intended to set.
 */
export function envString(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * A string setting with a default, applied when the variable is missing, blank,
 * or whitespace.
 */
export function envOr(name: string, fallback: string): string {
  return envString(name) ?? fallback;
}

/**
 * An integer setting with a default.
 *
 * The default also applies when the value is present but not a number, which is
 * the other half of the same problem: `Number.parseInt("", 10)` is `NaN`, and a
 * `NaN` budget silently disables whatever it governs rather than failing. A
 * timing budget of `NaN` makes every `Date.now() >= deadline` comparison false
 * and every `Math.min` result `NaN`, so the stage neither runs nor complains.
 *
 * `min` clamps the result upward where a zero or negative value would be
 * meaningless — pass it for budgets and sizes, leave it off where zero is a
 * legitimate setting.
 */
export function envInt(name: string, fallback: number, min?: number): number {
  const raw = envString(name);
  if (raw === undefined) return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    console.warn(
      `[env] ${name}="${raw}" is not an integer — using ${fallback}`,
    );
    return fallback;
  }

  return min === undefined ? parsed : Math.max(min, parsed);
}
