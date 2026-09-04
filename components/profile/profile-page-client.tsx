"use client";

import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { ProfileView } from "@/components/profile/profile-view";
import { ProfilePageSkeleton } from "@/components/profile/profile-shell";
import { api } from "@/convex/_generated/api";
import { toUiBark } from "@/lib/barks/query";
import { countries } from "@/lib/data";
import type { User } from "@/lib/types";

export function ProfilePageClient() {
  const { isLoaded, user: clerkUser } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const barkDocs = useQuery(
    api.barks.listMine,
    isAuthenticated ? { status: "public" } : "skip"
  );
  const draftDocs = useQuery(
    api.barks.listMine,
    isAuthenticated ? { status: "draft" } : "skip"
  );
  const barks = barkDocs ? barkDocs.map(toUiBark) : [];
  const drafts = draftDocs ? draftDocs.map(toUiBark) : [];

  if (!isLoaded) return <ProfilePageSkeleton />;

  const user: User = {
    id: clerkUser?.id ?? "guest",
    username: clerkUser?.username ?? clerkUser?.id ?? "guest",
    name: clerkUser?.fullName ?? clerkUser?.firstName ?? "Guest",
    bio: "",
    verified: false,
    country: "",
    followers: 0,
    following: 0,
    barkCount: barks.length,
    evidenceScore:
      barks.length === 0
        ? 0
        : Math.round(
            barks.reduce((n, bark) => n + bark.evidenceRating, 0) / barks.length
          ),
    joinedAt: clerkUser?.createdAt
      ? new Date(clerkUser.createdAt).toISOString()
      : new Date().toISOString(),
  };

  const country = countries.find((c) => c.code === user.country);
  const topicCounts = new Map<string, number>();
  for (const bark of barks) {
    for (const topic of bark.topics) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
  }
  const topTopics = [...topicCounts.entries()]
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <ProfileView
      user={user}
      country={country}
      barks={barks}
      serverDrafts={drafts}
      cases={[]}
      savedBarks={[]}
      topTopics={topTopics}
      initialCreator={null}
      initialCasesAboutMe={[]}
      initialWriter={null}
      avatarUrl={clerkUser?.imageUrl}
    />
  );
}
