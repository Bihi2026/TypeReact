"use client";

import * as React from "react";
import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import {
  AtSign,
  BadgeCheck,
  Bell,
  FileStack,
  Mail,
  MessageSquare,
  Rss,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { timeAgo } from "@/lib/format";
import { notificationCategoryMeta } from "@/lib/meta";
import { toUiNotification } from "@/lib/notifications/query";
import type { Notification, NotificationCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const categoryIcons: Record<NotificationCategory, LucideIcon> = {
  reply: MessageSquare,
  mention: AtSign,
  follower: UserPlus,
  following: Rss,
  "creator-response": BadgeCheck,
  evidence: FileStack,
  verification: ShieldCheck,
  message: Mail,
  circle: Users,
};

const categories = Object.keys(
  notificationCategoryMeta
) as NotificationCategory[];

function NotificationsHeader({ unread }: { unread?: number }) {
  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        Notifications
        {unread && unread > 0 ? <Badge>{unread} new</Badge> : null}
      </h1>
      <p className="text-sm text-muted-foreground">
        Replies, mentions, evidence updates, and creator responses.
      </p>
    </div>
  );
}

function InboxSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-7 w-32 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex gap-2">
        <div className="h-7 w-14 animate-pulse rounded-md bg-muted" />
        <div className="h-7 w-16 animate-pulse rounded-md bg-muted" />
        <div className="h-7 w-36 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="divide-y overflow-hidden rounded-xl border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 p-4">
            <div className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
              <div className="h-3 w-full animate-pulse rounded-md bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationItem({ n }: { n: Notification }) {
  const markRead = useMutation(api.notifications.markRead);
  const Icon = categoryIcons[n.category];
  return (
    <Link
      href={n.href}
      className={cn(
        "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
        !n.read && "border-l-2 border-l-primary bg-primary/[0.03]"
      )}
      onClick={() => {
        if (!n.read) {
          void markRead({
            notificationId: n.id as Id<"notifications">,
          }).catch(() => undefined);
        }
      }}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          n.read ? "bg-muted" : "bg-primary/10"
        )}
      >
        <Icon
          className={cn(
            "size-4",
            n.read ? "text-muted-foreground" : "text-primary"
          )}
          aria-hidden
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{n.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {n.body}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {timeAgo(n.time)} · {notificationCategoryMeta[n.category].label}
        </p>
      </div>
      {!n.read ? (
        <span
          className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
          aria-label="Unread"
        />
      ) : null}
    </Link>
  );
}

function NotificationsSignedIn() {
  const { isAuthenticated } = useConvexAuth();
  const unreadState = useQuery(
    api.notifications.unreadCount,
    isAuthenticated ? {} : "skip"
  );
  const markAllRead = useMutation(api.notifications.markAllRead);
  const [scope, setScope] = React.useState<"all" | "unread">("all");
  const [type, setType] = React.useState<"all" | NotificationCategory>("all");
  const { results, status, loadMore } = usePaginatedQuery(
    api.notifications.listMinePage,
    isAuthenticated
      ? {
          unreadOnly: scope === "unread" ? true : undefined,
          category: type === "all" ? undefined : type,
        }
      : "skip",
    { initialNumItems: 5 }
  );

  if (!isAuthenticated || (status === "LoadingFirstPage" && results.length === 0)) {
    return <InboxSkeleton />;
  }

  const items = results.map(toUiNotification);
  const unread = unreadState?.count ?? items.filter((n) => !n.read).length;

  const emptyDescription =
    type !== "all"
      ? `You'll see ${notificationCategoryMeta[type].label.toLowerCase()} notifications here.`
      : scope === "unread"
        ? "You're caught up. New replies and updates will show here."
        : "Replies, follows, and case updates will show up here.";

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <NotificationsHeader unread={unread} />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={unread === 0}
            onClick={() => {
              void (async () => {
                try {
                  await markAllRead({});
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not mark notifications as read"
                  );
                }
              })();
            }}
          >
            Mark all as read
          </Button>
          <Button variant="outline" size="icon-sm" asChild>
            <Link
              href="/settings/notifications"
              aria-label="Notification settings"
            >
              <Settings />
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={scope === "all" ? "default" : "outline"}
          onClick={() => setScope("all")}
        >
          All
        </Button>
        <Button
          type="button"
          size="sm"
          variant={scope === "unread" ? "default" : "outline"}
          onClick={() => setScope("unread")}
        >
          Unread
        </Button>
        <Select
          value={type}
          onValueChange={(value) =>
            setType(value as "all" | NotificationCategory)
          }
        >
          <SelectTrigger size="sm" className="w-44">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {notificationCategoryMeta[c].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nothing here yet"
          description={emptyDescription}
        />
      ) : (
        <div className="space-y-3">
          <div className="divide-y overflow-hidden rounded-xl border">
            {items.map((n) => (
              <NotificationItem key={n.id} n={n} />
            ))}
          </div>
          {status !== "Exhausted" ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={status === "LoadingMore"}
                onClick={() => loadMore(5)}
              >
                {status === "LoadingMore" ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function NotificationsInbox() {
  return (
    <>
      <Show when="signed-out">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
          <NotificationsHeader />
          <EmptyState
            icon={Bell}
            title="Sign in to see notifications"
            description="Replies, mentions, evidence updates, and creator responses land here."
            action={
              <SignInButton>
                <Button>Sign in</Button>
              </SignInButton>
            }
          />
        </div>
      </Show>
      <Show when="signed-in">
        <NotificationsSignedIn />
      </Show>
    </>
  );
}
