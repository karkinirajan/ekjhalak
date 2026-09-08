import Link from "next/link";

export const metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-canvas px-6 text-center">
      <div className="space-y-4">
        {/* Decorative. The <h1> below and the page <title> both already say
            this is a missing page, so a screen reader gaining "404" from a
            display numeral learns nothing and loses the heading's wording.

            `aria-hidden` alone would have silenced axe, which is why the
            opacity is fixed rather than the violation hidden: at /25 this
            printed #eac2c4 on white, 1.61:1, which is not a tint a sighted
            reader can resolve either. /60 is 3.53:1 — past the 3:1 that display
            type owes under WCAG 1.4.3 — so it reads as deliberate rather than
            as something that failed to load. */}
        <p
          aria-hidden="true"
          className="font-display text-[7rem] leading-none font-bold text-accent/60 sm:text-[10rem]"
        >
          404
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          This page went to press without us
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-ink-muted">
          The story you&apos;re looking for doesn&apos;t exist, or it has moved
          to a different edition.
        </p>
      </div>

      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-md bg-ink px-6 py-3 text-sm font-semibold text-canvas transition-opacity hover:opacity-85"
      >
        <span aria-hidden="true">←</span>
        Back to <span className="font-np">एक झलक</span>
      </Link>
    </div>
  );
}
