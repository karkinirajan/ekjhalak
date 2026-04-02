// app/story/[id]/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function StoryLoading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back button */}
        <Skeleton className="h-9 w-32 mb-6 rounded-md" />

        {/* Badges */}
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>

        {/* Headline */}
        <Skeleton className="h-9 w-full mb-2 rounded" />
        <Skeleton className="h-9 w-4/5 mb-3 rounded" />

        {/* Nepali headline */}
        <Skeleton className="h-7 w-3/4 mb-6 rounded" />

        {/* Meta row */}
        <div className="flex gap-4 mb-6 pb-6 border-b">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-4 w-40 rounded" />
        </div>

        {/* Image */}
        <Skeleton className="w-full h-64 rounded-lg mb-6" />

        {/* Summary */}
        <div className="mb-6 space-y-2">
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-3/4 rounded" />
        </div>

        {/* Nepali summary */}
        <div className="p-4 rounded-lg bg-muted/40 mb-6 space-y-2">
          <Skeleton className="h-3 w-12 rounded" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-5/6 rounded" />
        </div>

        {/* CTA */}
        <Skeleton className="h-10 w-56 rounded-md" />
      </div>
    </main>
  );
}
