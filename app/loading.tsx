export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent opacity-60" />
        <span className="text-sm opacity-50">Loading…</span>
      </div>
    </div>
  );
}
