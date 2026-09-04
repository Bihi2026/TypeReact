"use server";

import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexClerkToken } from "@/lib/convex-clerk";
import {
  channelUrlFromSource,
  resolveExternalIdentity,
} from "@/lib/creators/external-identity";
import { toUiCreator } from "@/lib/creators/query";
import type { Creator, SourcePlatform } from "@/lib/types";

export type ApplyAsCreatorInput = {
  name: string;
  bio: string;
  country: string;
  category: string;
  platforms: SourcePlatform[];
  officialLinks: { label: string; url: string }[];
  verificationMethod: "connect" | "code";
  claimCreatorId?: string;
  legalName: string;
  email: string;
  phone: string;
  proofPostUrl?: string;
  emergencyContacts: { name: string; phone: string; relationship: string }[];
  verificationIdHint?: string;
};

async function findUnclaimedUpgradeId(
  officialLinks: { url: string }[],
  platforms: SourcePlatform[]
): Promise<Id<"creators"> | undefined> {
  for (const link of officialLinks) {
    for (const platform of platforms) {
      const identity = resolveExternalIdentity({
        url: link.url,
        platform,
      });
      if (!identity) continue;
      const doc = await fetchQuery(api.creators.getByExternalIdentity, {
        platform: identity.platform,
        externalHandle: identity.externalHandle,
      });
      if (doc && doc.status === "unclaimed") {
        return doc._id;
      }
    }
  }
  return undefined;
}

export async function applyAsCreator(
  input: ApplyAsCreatorInput
): Promise<{ applicationCode: string; verificationId?: string }> {
  const token = await getConvexClerkToken("apply as a creator");
  let upgradeCreatorId: Id<"creators"> | undefined = input.claimCreatorId
    ? (input.claimCreatorId as Id<"creators">)
    : undefined;
  if (!upgradeCreatorId) {
    upgradeCreatorId = await findUnclaimedUpgradeId(
      input.officialLinks,
      input.platforms
    );
  }
  if (upgradeCreatorId) {
    const eligibility = await fetchQuery(
      api.creators.canClaimCreator,
      { creatorId: upgradeCreatorId },
      { token }
    );
    if (!eligibility.allowed) {
      throw new Error(
        eligibility.reason ?? "You cannot claim this creator profile"
      );
    }
  }
  return await fetchMutation(
    api.creators.apply,
    {
      name: input.name,
      bio: input.bio,
      country: input.country,
      category: input.category,
      platforms: input.platforms,
      officialLinks: input.officialLinks,
      verificationMethod: input.verificationMethod,
      legalName: input.legalName,
      email: input.email,
      phone: input.phone,
      proofPostUrl: input.proofPostUrl,
      emergencyContacts: input.emergencyContacts,
      verificationIdHint: input.verificationIdHint,
      ...(upgradeCreatorId ? { upgradeCreatorId } : {}),
    },
    { token }
  );
}

export async function listApprovedCreators(): Promise<Creator[]> {
  const docs = await fetchQuery(api.creators.listApproved, {});
  return docs.map(toUiCreator);
}

export async function listPublicCreators(): Promise<Creator[]> {
  const docs = await fetchQuery(api.creators.listPublic, {});
  return docs.map(toUiCreator);
}

export async function getCreatorByHandleAction(
  handle: string
): Promise<Creator | null> {
  const doc = await fetchQuery(api.creators.getByHandle, { handle });
  return doc ? toUiCreator(doc) : null;
}

export async function getCreatorByIdAction(
  id: string
): Promise<Creator | null> {
  const doc = await fetchQuery(api.creators.getById, {
    id: id as Id<"creators">,
  });
  return doc ? toUiCreator(doc) : null;
}

export async function getCreatorByExternalIdentityAction(input: {
  platform: SourcePlatform;
  externalHandle: string;
}): Promise<Creator | null> {
  const doc = await fetchQuery(api.creators.getByExternalIdentity, input);
  return doc ? toUiCreator(doc) : null;
}

export async function ensureUnclaimedCreatorAction(input: {
  url: string;
  platform: SourcePlatform;
  authorName?: string;
  profileImageUrl?: string;
}): Promise<Creator | null> {
  const identity = resolveExternalIdentity(input);
  if (!identity) return null;

  const token = await getConvexClerkToken("publish a reaction");
  const channelUrl =
    channelUrlFromSource(input.url, identity.platform) ?? undefined;
  const { creatorId } = await fetchMutation(
    api.creators.ensureUnclaimedFromSource,
    {
      platform: identity.platform,
      externalHandle: identity.externalHandle,
      displayName: identity.displayName,
      sourceUrl: input.url,
      channelUrl,
      profileImageUrl: input.profileImageUrl,
    },
    { token }
  );
  return await getCreatorByIdAction(creatorId);
}

export async function getMyCreatorAction(): Promise<Creator | null> {
  try {
    const token = await getConvexClerkToken("view your creator profile");
    const doc = await fetchQuery(api.creators.getMine, {}, { token });
    return doc ? toUiCreator(doc) : null;
  } catch {
    return null;
  }
}
