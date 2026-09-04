import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Users } from "lucide-react";
import { listPublicCreators } from "@/app/actions/creators";
import { CreatorsDirectory } from "@/components/creators/creators-directory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Creators",
};

export const dynamic = "force-dynamic";

export default async function CreatorsPage() {
  const creators = await listPublicCreators();

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Users className="size-5 text-primary" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
              Creators
              {creators.length > 0 ? (
                <Badge variant="secondary">{creators.length}</Badge>
              ) : null}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Public figures and publishers under discussion on TypeReact — with
              the right to claim their profile, respond officially, and face
              evidence on the record.
            </p>
          </div>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/creators/apply">
            <BadgeCheck className="size-4" />
            Become a Creator
          </Link>
        </Button>
      </div>
      <CreatorsDirectory initialCreators={creators} />
    </div>
  );
}
