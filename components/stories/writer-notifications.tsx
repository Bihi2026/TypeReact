"use client";

import Link from "next/link";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  Bell,
  MessageCircle,
  ShieldCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { timeAgo } from "@/lib/format";
import { toUiNotification } from "@/lib/notifications/query";
import type { NotificationCategory } from "@/lib/types";

const icons: Record<NotificationCategory, LucideIcon> = {
  reply: MessageCircle,
  mention: MessageCircle,
  follower: UserPlus,
  following: Bell,
  "creator-response": ShieldCheck,
  evidence: Bell,
  verification: ShieldCheck,
  message: MessageCircle,
  circle: Users,
};

export function WriterNotifications() {
  const { isAuthenticated } = useConvexAuth();
  const docs = useQuery(
    api.notifications.listMine,
    isAuthenticated ? {} : "skip"
  );
  const markRead = useMutation(api.notifications.markRead);

  if (!isAuthenticated || docs === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4" aria-hidden />
            Writer notifications
          </CardTitle>
          <CardDescription>Comments and new followers.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="py-6 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        </CardContent>
      </Card>
    );
  }

  const items = docs
    .map(toUiNotification)
    .filter((n) => n.href.startsWith("/stories"));
  const unread = items.filter((n) => !n.read).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-4" aria-hidden />
          Writer notifications
          {unread > 0 && (
            <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]">
              {unread}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Comments and new followers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Comments and follows on your stories will show up here.
          </p>
        ) : (
          items.map((n) => {
            const Icon = icons[n.category];
            return (
              <Link
                key={n.id}
                href={n.href}
                onClick={() => {
                  if (!n.read) {
                    void markRead({
                      notificationId: n.id as Id<"notifications">,
                    }).catch(() => undefined);
                  }
                }}
                className={`flex items-start gap-3 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-muted/60 ${
                  !n.read ? "bg-primary/5" : ""
                }`}
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Icon
                    className="size-3.5 text-muted-foreground"
                    aria-hidden
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block leading-snug">{n.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(n.time)}
                  </span>
                </span>
                {!n.read && (
                  <span
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
                    aria-label="Unread"
                  />
                )}
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
