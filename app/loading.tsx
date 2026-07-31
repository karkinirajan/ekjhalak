/**
 * Route-level loading UI.
 *
 * Rendered before the client ThemeProvider exists, so it uses only the CSS
 * custom properties set by the head script — meaning it is already in the
 * reader's chosen theme. Mirrors the real layout (ticker, masthead, nav, hero,
 * grid) so hydration doesn't shift anything.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      {/* Ticker */}
      <div className="h-9 w-full bg-red opacity-90" />

      {/* Masthead */}
      <header className="border-b border-rule">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between border-b border-rule/60 py-2.5">
            <div className="h-3 w-44 animate-pulse rounded bg-raised" />
            <div className="flex gap-1.5">
              <div className="h-8 w-8 animate-pulse rounded-full bg-raised" />
              <div className="h-8 w-8 animate-pulse rounded-full bg-raised" />
              <div className="h-8 w-20 animate-pulse rounded-full bg-raised" />
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
              className="h-7 w-20 shrink-0 animate-pulse rounded-full bg-raised"
            />
          ))}
        </div>
      </div>

      {/* Hero + grid */}
      <div className="mx-auto w-full max-w-[1400px] space-y-12 px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-[26rem] animate-pulse rounded-lg bg-raised sm:h-[32rem] lg:col-span-2" />
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-4 border-b border-rule pb-4">
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-16 animate-pulse rounded bg-raised" />
                  <div className="h-4 w-full animate-pulse rounded bg-raised" />
                  <div className="h-4 w-4/5 animate-pulse rounded bg-raised" />
                </div>
                <div className="h-20 w-20 shrink-0 animate-pulse rounded-md bg-raised sm:h-24 sm:w-24" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid gap-6 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-lg border border-rule bg-surface"
              >
                <div className="aspect-[16/10] animate-pulse bg-raised" />
                <div className="space-y-3 p-5">
                  <div className="h-5 w-11/12 animate-pulse rounded bg-raised" />
                  <div className="h-4 w-full animate-pulse rounded bg-raised" />
                  <div className="h-4 w-3/5 animate-pulse rounded bg-raised" />
                </div>
              </div>
            ))}
          </div>

          <div className="hidden h-96 animate-pulse rounded-lg bg-raised lg:block" />
        </div>
      </div>

      <span className="sr-only" role="status">
        Loading stories…
      </span>
    </div>
  );
}
