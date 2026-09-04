import { Suspense } from "react";
import { Search } from "lucide-react";
import { listPublicBarks, listPublicSources } from "@/app/actions/barks";
import { HomeHeroActions } from "@/components/home/hero-actions";
import { HomePageContent } from "@/components/home/home-page-content";
import { HomePageContentSkeleton } from "@/components/home/home-page-content-skeleton";
import { RightPanel } from "@/components/shell/right-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function Hero() {
  return (
    <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/[0.07] via-background to-background">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, var(--border) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:py-24">
        <Badge variant="outline" className="mb-5 bg-background/60">
          Evidence-Based Discussion & Accountability
        </Badge>
        <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Where Ideas Are Challenged{" "}
          <span className="text-primary">Through Evidence.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
          Analyze, debate, and document public content with sourced arguments.
          Every discussion starts with an original source — and every claim is
          held to it.
        </p>

        <form
          action="/search"
          className="mx-auto mt-8 flex max-w-lg items-center gap-2"
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              placeholder="Search a claim, creator, video, or Reaction ID…"
              aria-label="Search TypeReact"
              className="h-11 w-full rounded-md border bg-background pl-9 pr-3 text-sm shadow-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <Button type="submit" size="lg" className="h-11">
            Search
          </Button>
        </form>

        <HomeHeroActions />
      </div>
    </section>
  );
}

export default async function HomePage() {
  const [published, publicSources] = await Promise.all([
    listPublicBarks(),
    listPublicSources(),
  ]);
  const beingBarkedAbout = publicSources;

  return (
    <>
      <Hero />
      <div className="flex">
        <Suspense fallback={<HomePageContentSkeleton />}>
          <HomePageContent
            published={published}
            publicSources={beingBarkedAbout}
          />
        </Suspense>
        <RightPanel />
      </div>
    </>
  );
}
