"use client";

import { Lock, UserX } from "lucide-react";
import { useQuery } from "convex/react";
import { ProfileView } from "@/components/profile/profile-view";
import {
  ProfilePageSkeleton,
  ProfileStatusShell,
} from "@/components/profile/profile-shell";
import { api } from "@/convex/_generated/api";
import { toUiBark } from "@/lib/barks/query";
import { countries } from "@/lib/data";
import type { Creator, User } from "@/lib/types";
import type { WriterProfile } from "@/lib/writers/query";

export function PublicProfileView({ slug }: { slug: string }) {
  const profile = useQuery(api.profiles.getBySlug, { slug });
  const barkDocs = useQuery(
    api.barks.listPublicByAuthor,
    profile?.status === "ok" ? { authorClerkId: profile.clerkId } : "skip"
  );

  if (profile === undefined) {
    return <ProfilePageSkeleton />;
  }

  if (profile.status === "missing") {
    return (
      <ProfileStatusShell
        icon={UserX}
        title="Profile not found"
        description="This account doesn’t exist, or the link is incomplete."
      />
    );
  }

  if (profile.status === "private") {
    return (
      <ProfileStatusShell
        icon={Lock}
        title="This profile is private"
        description="The owner has chosen not to share their profile with other people."
      />
    );
  }

  const barks = barkDocs ? barkDocs.map(toUiBark) : [];
  const username = profile.username || profile.clerkId;
  const country = profile.showCountry
    ? countries.find((c) => c.code === profile.country)
    : undefined;

  const user: User = {
    id: profile.clerkId,
    username,
    name: profile.name,
    bio: profile.bio,
    verified: profile.verified,
    country: profile.showCountry ? profile.country : "",
    followers: 0,
    following: 0,
    barkCount: barkDocs ? barks.length : profile.barkCount,
    evidenceScore: profile.evidenceScore,
    joinedAt: new Date(profile.joinedAt).toISOString(),
  };

  const topicCounts = new Map<string, number>();
  for (const bark of barks) {
    for (const topic of bark.topics) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
  }
  const topTopics = [...topicCounts.entries()]
    .map(([topicSlug, count]) => ({ slug: topicSlug, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const initialCreator: Creator | null = profile.creatorHandle
    ? {
        id: profile.creatorHandle,
        handle: profile.creatorHandle,
        name: profile.creatorName || profile.name,
        bio: "",
        verified: profile.verified,
        hasTeaBarksProfile: true,
        platforms: [],
        officialLinks: [],
        followers: 0,
        country: profile.country,
        topics: [],
        totalSources: 0,
        totalBarksReceived: 0,
        responseRate: 0,
        joinedAt: user.joinedAt,
      }
    : null;

  const initialWriter: WriterProfile | null = profile.writerHandle
    ? {
        id: profile.writerHandle,
        handle: profile.writerHandle,
        penName: profile.writerPenName || profile.name,
        applicationCode: "",
        language: "en",
        genres: [],
        sampleTitle: "",
        followers: 0,
      }
    : null;

  return (
    <ProfileView
      user={user}
      country={country}
      barks={barks}
      cases={[]}
      savedBarks={[]}
      topTopics={topTopics}
      initialCreator={initialCreator}
      initialCasesAboutMe={[]}
      initialWriter={initialWriter}
      avatarUrl={profile.imageUrl ?? undefined}
      website={profile.website || undefined}
    />
  );
}
