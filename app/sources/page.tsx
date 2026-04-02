// app/sources/page.tsx
// Lists all news sources, grouped by scope, with live status indicators.

import { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CheckCircle2, XCircle, Rss } from "lucide-react";

export const metadata: Metadata = {
  title: "Sources | एक झलक",
  description:
    "All the trusted national and international news sources powering Ekjhalak's bilingual feed.",
};

export const revalidate = 300;

interface SourceStatus {
  ok: boolean;
  itemCount: number;
  fetchedAt: number;
  error?: string;
}

interface Source {
  id: string;
  name: string;
  bucket: string;
  country: string;
  language: string;
  categories: string[];
  homepageUrl: string;
  priority: number;
  active: boolean;
  hasRss: boolean;
  note?: string;
  status: SourceStatus | null;
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ekjhalak.news";

async function fetchSources(): Promise<Source[]> {
  try {
    const res = await fetch(`${SITE_URL}/api/sources`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.sources ?? [];
  } catch {
    return [];
  }
}

function StatusDot({ status }: { status: SourceStatus | null }) {
  if (!status) {
    return (
      <span
        className="inline-block h-2 w-2 rounded-full bg-muted-foreground/30"
        title="Not yet fetched"
      />
    );
  }
  if (status.ok) {
    return (
      <CheckCircle2 className="h-4 w-4 text-green-500" aria-label="Live" />
    );
  }
  return (
    <XCircle
      className="h-4 w-4 text-red-400"
      aria-label={status.error ?? "Error"}
    />
  );
}

export default async function SourcesPage() {
  const sources = await fetchSources();

  const national = sources.filter((s) => s.bucket === "national" && s.active);
  const international = sources.filter(
    (s) => s.bucket === "international" && s.active,
  );
  const inactive = sources.filter((s) => !s.active);

  function SourceRow({ source }: { source: Source }) {
    return (
      <div className="flex items-start justify-between py-3 border-b last:border-0 gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground text-sm">
              {source.name}
            </span>
            <StatusDot status={source.status} />
            {source.hasRss && (
              <Rss
                className="h-3.5 w-3.5 text-muted-foreground/60"
                aria-label="RSS available"
              />
            )}
            {source.categories.slice(0, 2).map((c) => (
              <Badge key={c} variant="outline" className="text-xs px-1.5 py-0">
                {c}
              </Badge>
            ))}
          </div>
          {source.status?.error && (
            <p className="text-xs text-red-400 mt-0.5 truncate">
              {source.status.error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {source.status && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {source.status.itemCount} articles
            </span>
          )}
          <a
            href={source.homepageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Visit ${source.name}`}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <Link
            href={`/?source=${source.id}`}
            className="text-xs text-primary hover:underline"
          >
            Filter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            News Sources
          </h1>
          <p className="text-muted-foreground text-sm">
            {sources.filter((s) => s.active).length} active sources powering the
            Ekjhalak feed.
          </p>
        </div>

        {/* National */}
        {national.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              National — Nepal ({national.length})
            </h2>
            <div className="rounded-lg border bg-card px-4">
              {national
                .sort((a, b) => a.priority - b.priority)
                .map((s) => (
                  <SourceRow key={s.id} source={s} />
                ))}
            </div>
          </section>
        )}

        {/* International */}
        {international.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              International ({international.length})
            </h2>
            <div className="rounded-lg border bg-card px-4">
              {international
                .sort((a, b) => a.priority - b.priority)
                .map((s) => (
                  <SourceRow key={s.id} source={s} />
                ))}
            </div>
          </section>
        )}

        {/* Inactive */}
        {inactive.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Inactive / Planned ({inactive.length})
            </h2>
            <div className="rounded-lg border bg-card px-4 opacity-60">
              {inactive.map((s) => (
                <SourceRow key={s.id} source={s} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
