import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-6xl font-bold opacity-20">404</h1>
        <h2 className="text-xl font-semibold">Page not found</h2>
        <p className="text-sm opacity-60">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-md border px-4 py-2 text-sm font-medium transition-opacity hover:opacity-70"
      >
        ← Back to एक झलक
      </Link>
    </div>
  );
}
