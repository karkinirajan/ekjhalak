/**
 * Route-level loading UI — shown by Next.js while the page data is loading.
 * Uses hardcoded dark palette tokens so it renders correctly before the
 * client-side ThemeProvider has hydrated.
 * Matches the layout of NewsFeed so there is minimal layout shift on hydration.
 */
export default function Loading() {
  return (
    <div className="flex min-h-screen bg-[#0c1018]">
      {/* Sidebar placeholder */}
      <aside className="hidden w-65 shrink-0 lg:flex flex-col border-r border-[#232e40] bg-[#141922] p-2.5 gap-3">
        {/* Brand area */}
        <div className="min-h-24 border-b border-[#232e40] pb-3 flex items-center justify-center">
          <div className="h-10 w-32 rounded-md bg-[#1c2535] animate-pulse" />
        </div>
        {/* Nav items */}
        <div className="space-y-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded-md bg-[#1c2535] animate-pulse" />
          ))}
        </div>
        <div className="h-px bg-[#232e40]" />
        {/* Filter area */}
        <div className="space-y-1.5">
          <div className="h-3 w-16 rounded bg-[#1c2535] animate-pulse" />
          {[1, 2].map((i) => (
            <div key={i} className="h-9 rounded-md bg-[#1c2535] animate-pulse" />
          ))}
        </div>
        <div className="h-px bg-[#232e40]" />
        {/* Source list skeleton */}
        <div className="space-y-1">
          <div className="h-3 w-14 rounded bg-[#1c2535] animate-pulse mb-2" />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-6 rounded-sm bg-[#1c2535] animate-pulse" />
          ))}
        </div>
      </aside>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-65">
        {/* Navbar skeleton */}
        <div className="sticky top-0 z-50 bg-[#141922] border-b border-[#232e40] px-4 py-3">
          <div className="flex items-center gap-2">
            {/* Mobile brand */}
            <div className="h-10 w-28 rounded-md bg-[#1c2535] animate-pulse lg:hidden" />
            <div className="flex-1 h-8 rounded-md bg-[#1c2535] animate-pulse" />
            <div className="h-8 w-8 rounded-md bg-[#1c2535] animate-pulse" />
            <div className="h-8 w-8 rounded-md bg-[#1c2535] animate-pulse" />
            <div className="h-8 w-16 rounded-md bg-[#1c2535] animate-pulse hidden sm:block" />
          </div>
        </div>

        {/* Feed skeleton */}
        <div className="p-2 lg:p-3 space-y-2">
          <div className="border border-[#232e40] rounded-md bg-[#141922] p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="border border-[#232e40] rounded-lg overflow-hidden bg-[#141922]"
                aria-hidden="true"
              >
                <div className="flex flex-col sm:flex-row min-h-0">
                  <div className="w-full sm:w-1/3 h-36 bg-[#1c2535] animate-pulse shrink-0" />
                  <div className="flex-1 p-4 space-y-3">
                    <div className="flex gap-2">
                      <div className="h-4 w-14 rounded bg-[#1c2535] animate-pulse" />
                      <div className="h-4 w-20 rounded bg-[#1c2535] animate-pulse" />
                      <div className="h-4 w-16 rounded bg-[#1c2535] animate-pulse" />
                    </div>
                    <div className="h-4 w-5/6 rounded bg-[#1c2535] animate-pulse" />
                    <div className="h-3 w-full rounded bg-[#1c2535] animate-pulse" />
                    <div className="h-3 w-4/5 rounded bg-[#1c2535] animate-pulse" />
                    <div className="flex gap-2 pt-1">
                      <div className="h-8 w-20 rounded-md bg-[#1c2535] animate-pulse" />
                      <div className="h-8 w-16 rounded-md bg-[#1c2535] animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
