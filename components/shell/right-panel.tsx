import Link from "next/link";
import { ArrowRight, Quote } from "lucide-react";
import { listPublicBarks } from "@/app/actions/barks";
import { listCases } from "@/app/actions/cases";
import { listApprovedCreators } from "@/app/actions/creators";
import { HomeSignupCard } from "@/components/home/home-signup-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNumber, gradientFor } from "@/lib/format";
import { SHELL_STICKY_HEIGHT, SHELL_STICKY_TOP } from "@/lib/shell";
import type { Bark } from "@/lib/types";
import { cn } from "@/lib/utils";

export async function RightPanel({
  published: publishedProp,
  embedded = false,
}: {
  published?: Bark[];
  embedded?: boolean;
} = {}) {
  const [fetchedBarks, publishedCases, approvedCreators] = await Promise.all([
    publishedProp ? Promise.resolve(null) : listPublicBarks(),
    listCases(),
    listApprovedCreators(),
  ]);
  const published = publishedProp ?? fetchedBarks ?? [];
  const trending = [...published]
    .sort((a, b) => {
      if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
      return (
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    })
    .slice(0, 6);

  return (
    <aside
      aria-label="Trending discussions"
      className={cn(
        "space-y-4",
        embedded
          ? "w-full xl:sticky xl:top-24 xl:h-[calc(100svh-6rem)] xl:overflow-y-auto xl:p-4"
          : cn(
              "sticky hidden w-80 shrink-0 overflow-y-auto p-4 xl:block",
              SHELL_STICKY_TOP,
              SHELL_STICKY_HEIGHT
            )
      )}
    >
      <Card className="gap-3 rounded-2xl py-4 shadow-sm">
        <CardHeader className="px-4">
          <p className="mb-1 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span className="h-px w-8 bg-primary" aria-hidden />
            Now
          </p>
          <CardTitle className="text-base">Trending Discussions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 px-3">
          {trending.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">
              Discussions appear as reactions are published.
            </p>
          ) : (
            <ol className="space-y-1">
              {trending.map((bark, index) => (
                <li key={bark.id}>
                  <Link
                    href={`/barks/${bark.code}`}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-all hover:-translate-y-0.5 hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "relative aspect-video w-[7.5rem] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br",
                        gradientFor(bark.id)
                      )}
                    >
                      {bark.sourceThumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={bark.sourceThumbnailUrl}
                          alt=""
                          className="absolute inset-0 size-full object-cover"
                        />
                      ) : null}
                      <span className="absolute left-1.5 top-1.5 flex size-5 items-center justify-center rounded-md bg-black/65 text-[10px] font-semibold text-white">
                        {index + 1}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 font-medium leading-snug">
                        {bark.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {formatNumber(bark.upvotes)} reactions
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/barks">
              View all <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="gap-3 rounded-2xl border-primary/20 bg-primary/5 py-4 shadow-sm">
        <CardContent className="px-4">
          <Quote className="size-6 text-primary" aria-hidden />
          <blockquote className="mt-2 text-[15px] font-semibold leading-relaxed tracking-tight">
            Real change happens when real people speak up.
          </blockquote>
        </CardContent>
      </Card>

      <HomeSignupCard />

      <Card className="rounded-2xl py-4 shadow-sm">
        <CardContent className="grid grid-cols-3 gap-2 px-4 text-center">
          <div>
            <p className="text-sm font-semibold tabular-nums">
              {formatNumber(published.length)}
            </p>
            <p className="text-[11px] text-muted-foreground">Reactions</p>
          </div>
          <div>
            <p className="text-sm font-semibold tabular-nums">
              {formatNumber(publishedCases.length)}
            </p>
            <p className="text-[11px] text-muted-foreground">Cases</p>
          </div>
          <div>
            <p className="text-sm font-semibold tabular-nums">
              {formatNumber(approvedCreators.length)}
            </p>
            <p className="text-[11px] text-muted-foreground">Creators</p>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}
