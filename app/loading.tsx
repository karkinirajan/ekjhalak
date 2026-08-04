/**
 * Route-level loading UI.
 *
 * Rendered before the client ThemeProvider exists, so it uses only the CSS
 * custom properties set by the head script — meaning it is already in the
 * reader's chosen theme. Mirrors the real layout (ticker, masthead, nav, then
 * one uniform card grid beside the trending rail) so hydration doesn't shift
 * anything.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      {/* Ticker */}
      <div className="h-9 w-full bg-red-solid opacity-90" />

      {/* Masthead */}
      <header className="border-b border-rule">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between border-b border-rule/60 py-2.5">
            <div className="h-3 w-44 animate-pulse rounded bg-raised" />
            <div className="flex gap-1.5">
              <div className="h-8 w-28 animate-pulse rounded-md bg-raised" />
              <div className="h-8 w-8 animate-pulse rounded-md bg-raised" />
              <div className="h-8 w-20 animate-pulse rounded-md bg-raised" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 py-8">
            <div className="h-14 w-64 animate-pulse rounded bg-raised sm:h-16 sm:w-80" />
            <div className="h-4 w-40 animate-pulse rounded bg-raised" />
            <div className="h-3 w-56 animate-pulse rounded bg-raised" />
          </div>
        </div>
      </header>

      {/* Category nav */}
      <div className="border-b border-rule">
        <div className="mx-auto flex w-full max-w-[1400px] gap-2 px-4 py-3 sm:px-6 lg:px-8">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-7 w-20 shrink-0 animate-pulse rounded-md bg-raised"
            />
          ))}
        </div>
      </div>

      {/* Card grid + trending rail */}
      <div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Mirrors the card's own shape: picture above, text below. */}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-md border border-rule bg-surface"
              >
                <div className="aspect-16/10 w-full animate-pulse bg-raised" />
                <div className="space-y-2.5 p-5">
                  <div className="h-3 w-16 animate-pulse rounded-md bg-raised" />
                  <div className="h-4 w-11/12 animate-pulse rounded-md bg-raised" />
                  <div className="h-3 w-full animate-pulse rounded-md bg-raised" />
                  <div className="h-3 w-3/5 animate-pulse rounded-md bg-raised" />
                </div>
              </div>
            ))}
          </div>

          <div className="hidden h-96 animate-pulse rounded-md bg-raised lg:block" />
        </div>
      </div>

      <span className="sr-only" role="status">
        Loading stories…
      </span>
    </div>
  );
}
