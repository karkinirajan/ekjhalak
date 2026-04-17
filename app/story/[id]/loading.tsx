// app/story/[id]/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function StoryLoading() {
  return (
    <main className="min-h-screen bg-linear-to-br from-[#ffe7d6]/55 via-[#fff8ef] to-[#fffdf8] dark:from-[#0a1323] dark:via-[#10192f] dark:to-[#16243f]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="h-9 w-32 mb-6 rounded-md" />

        <div className="rounded-2xl border border-[#ffd4b7] bg-[#fffdfb]/95 p-6 dark:border-[#2d3c59] dark:bg-[#111b31]/95">
          <div className="flex gap-2 mb-4">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>

          <Skeleton className="h-9 w-full mb-2 rounded" />
          <Skeleton className="h-9 w-4/5 mb-3 rounded" />
          <Skeleton className="h-7 w-3/4 mb-6 rounded" />

          <div className="flex gap-4 mb-6 pb-6 border-b border-[#ffd9bf] dark:border-[#273653]">
            <Skeleton className="h-4 w-40 rounded" />
          </div>

          <div className="mb-6 space-y-2">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-3/4 rounded" />
          </div>

          <div className="p-4 rounded-lg bg-muted/40 mb-2 space-y-2">
            <Skeleton className="h-3 w-12 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-5/6 rounded" />
          </div>
        </div>
      </div>
    </main>
  );
}
