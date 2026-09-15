import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Eye,
  Heart,
  MessageSquare,
  Play,
} from "lucide-react";
import { getPublicStoryBySlug } from "@/app/actions/stories";
import { PersonAvatar } from "@/components/person-avatar";
import { ReportButton } from "@/components/report-dialog";
import {
  AddToListButton,
  FollowAuthorButton,
  VoteButton,
} from "@/components/stories/story-actions";
import { StoryOwnerActions } from "@/components/stories/story-owner-actions";
import { StoryComments } from "@/components/stories/story-comments";
import { StoryCover } from "@/components/stories/story-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatNumber, timeAgo } from "@/lib/format";
import { totalReadingMinutes } from "@/lib/stories/query";
import { getGenreMeta, storyStatusMeta } from "@/lib/story-meta";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/stories/[slug]">
): Promise<Metadata> {
  const { slug } = await props.params;
  const story = await getPublicStoryBySlug(slug);
  return { title: story ? story.title : "Story not found" };
}

export default async function StoryPage(props: PageProps<"/stories/[slug]">) {
  const { slug } = await props.params;
  const story = await getPublicStoryBySlug(slug);
  if (!story) notFound();

  const genre = getGenreMeta(story.genre);
  const status = storyStatusMeta[story.status];
  const firstChapter = story.chapters[0]?.number ?? 1;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <Link
        href="/stories"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> All stories
      </Link>

      <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
        <StoryCover
          story={story}
          className="aspect-[3/4] w-full max-w-56"
          showTitle={false}
        />
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={`/stories/genres/${story.genre}`}>
              <Badge variant="secondary">{genre.label}</Badge>
            </Link>
            <Badge variant="outline" className={status.badgeClass}>
              {status.label}
            </Badge>
            {story.mature && (
              <Badge
                variant="outline"
                className="bg-disagree/10 text-disagree border-disagree/30"
              >
                Mature
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{story.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Eye className="size-4" aria-hidden />
              {formatNumber(story.reads)} reads
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Heart className="size-4" aria-hidden />
              {formatNumber(story.votes)} votes
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="size-4" aria-hidden />
              {story.partCount} parts
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden />
              {totalReadingMinutes(story)} min total
            </span>
          </div>
          {story.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {story.tags.map((t) => (
                <Badge key={t} variant="outline" className="text-xs font-normal">
                  #{t}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href={`/stories/${story.slug}/chapters/${firstChapter}`}>
                <Play className="size-4" /> Start reading
              </Link>
            </Button>
            <VoteButton
              initialVotes={story.votes}
              size="default"
              slug={story.slug}
            />
            <AddToListButton storyTitle={story.title} />
            <ReportButton
              target={`story "${story.title}"`}
              storySlug={story.slug}
              iconOnly
            />
            <StoryOwnerActions
              slug={story.slug}
              writerId={story.authorId}
              title={story.title}
              blurb={story.blurb}
              genre={story.genre}
              tags={story.tags}
              mature={story.mature}
              status={story.status}
            />
          </div>
        </div>
      </div>

      {story.blurb ? (
        <p className="max-w-3xl leading-relaxed text-foreground/85">
          {story.blurb}
        </p>
      ) : null}

      <Card className="flex-row items-center gap-4 p-4">
        <PersonAvatar
          id={story.authorId}
          name={story.authorName}
          className="size-12"
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{story.authorName}</p>
          <p className="text-xs text-muted-foreground">@{story.authorHandle}</p>
        </div>
        <FollowAuthorButton
          name={story.authorName}
          authorId={story.authorId}
        />
      </Card>

      <Separator />

      <section aria-labelledby="chapters-heading" className="space-y-3">
        <h2 id="chapters-heading" className="text-xl font-semibold tracking-tight">
          Table of contents
        </h2>
        <Card className="gap-0 divide-y p-0">
          {story.chapters.map((ch) => (
            <Link
              key={ch.number}
              href={`/stories/${story.slug}/chapters/${ch.number}`}
              className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-semibold">
                {ch.number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{ch.title}</p>
                <p className="text-xs text-muted-foreground">
                  {ch.readingMinutes} min read · updated {timeAgo(ch.publishedAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Eye className="size-3.5" aria-hidden />
                  {formatNumber(ch.reads)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Heart className="size-3.5" aria-hidden />
                  {formatNumber(ch.votes)}
                </span>
              </div>
            </Link>
          ))}
        </Card>
      </section>

      <Separator />

      <section aria-labelledby="comments-heading" className="space-y-4">
        <h2
          id="comments-heading"
          className="flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <MessageSquare className="size-5" aria-hidden />
          Comments ({formatNumber(story.commentCount)})
        </h2>
        <StoryComments slug={story.slug} />
      </section>
    </div>
  );
}
