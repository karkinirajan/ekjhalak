"use client";

import { createContext, useContext } from "react";

/**
 * The reference "now" that every relative timestamp on the page is measured
 * against.
 *
 * This is the feed's fetch time, not the wall clock, and that is deliberate.
 * Calling Date.now() while rendering makes the server and the client disagree
 * whenever a minute boundary falls between them, which React reports as a
 * hydration mismatch. Anchoring to fetchedAt — a value that arrives with the
 * data — makes every "3 hours ago" identical on both sides, and it is arguably
 * the more truthful label anyway: it is how old the story was when we last
 * actually checked.
 */
const FeedClockContext = createContext<number>(0);

export function FeedClockProvider({
  value,
  children,
}: {
  value: number;
  children: React.ReactNode;
}) {
  return (
    <FeedClockContext.Provider value={value}>
      {children}
    </FeedClockContext.Provider>
  );
}

/** Falls back to 0 outside a provider, which renders every story as brand new. */
export function useFeedClock(): number {
  return useContext(FeedClockContext);
}
