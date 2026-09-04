"use server";

import { unstable_noStore as noStore } from "next/cache";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toUiBark } from "@/lib/barks/query";
import { ensureUnclaimedCreatorAction } from "@/app/actions/creators";
import { getConvexClerkToken } from "@/lib/convex-clerk";
import { resolveExternalIdentity } from "@/lib/creators/external-identity";
import { toUiSource } from "@/lib/sources/query";
import type { Bark, BarkType, CaseCategory, EvidenceType, Source, SourcePlatform } from "@/lib/types";

export type PublishBarkInput = {
  type: BarkType;
  title: string;
  body: string;
  status: "public" | "draft";
  sourceUrl: string;
  sourceTitle: string;
  sourcePlatform: SourcePlatform;
  sourceCreatorName: string;
  sourceCreatorId?: string;
  sourceThumbnailUrl?: string;
  topics?: CaseCategory[];
  quotedBarkCode?: string;
  evidence: {
    type: EvidenceType;
    title: string;
    url: string;
    storageId?: string;
    fileName?: string;
    contentType?: string;
  }[];
};

export async function publishBark(input: PublishBarkInput): Promise<{ code: string }> {
  const token = await getConvexClerkToken("publish a reaction");

  let sourceCreatorId: Id<"creators"> | undefined = input.sourceCreatorId
    ? (input.sourceCreatorId as Id<"creators">)
    : undefined;
  if (!sourceCreatorId && input.status === "public") {
    const identity = resolveExternalIdentity({
      url: input.sourceUrl,
      platform: input.sourcePlatform,
      authorName: input.sourceCreatorName,
    });
    if (identity) {
      const ensured = await ensureUnclaimedCreatorAction({
        url: input.sourceUrl,
        platform: input.sourcePlatform,
        authorName: input.sourceCreatorName,
      });
      if (ensured) sourceCreatorId = ensured.id as Id<"creators">;
    }
  }

  const { sourceCreatorId: _inputCreatorId, ...publishInput } = input;

  return await fetchMutation(
    api.barks.create,
    {
      ...publishInput,
      ...(sourceCreatorId ? { sourceCreatorId } : {}),
      evidence: input.evidence.map((item) => ({
        type: item.type,
        title: item.title,
        url: item.url,
        storageId: item.storageId
          ? (item.storageId as Id<"_storage">)
          : undefined,
        fileName: item.fileName,
        contentType: item.contentType,
      })),
    },
    { token }
  );
}

export async function listPublicBarks(): Promise<Bark[]> {
  try {
    const docs = await fetchQuery(api.barks.listPublic, {});
    return docs.map(toUiBark);
  } catch (error) {
    console.error("Failed to list public barks:", error);
    return [];
  }
}

export async function listPublicBarksByCountry(country: string): Promise<Bark[]> {
  try {
    const docs = await fetchQuery(api.barks.listPublicByCountry, { country });
    return docs.map(toUiBark);
  } catch (error) {
    console.error("Failed to list public barks by country:", error);
    return [];
  }
}

export async function listPublicBarksByTopic(topic: CaseCategory): Promise<Bark[]> {
  try {
    const docs = await fetchQuery(api.barks.listPublicByTopic, { topic });
    return docs.map(toUiBark);
  } catch (error) {
    console.error("Failed to list public barks by topic:", error);
    return [];
  }
}

export type CountryStat = {
  code: string;
  barkCount: number;
  activeDiscussions: number;
};

export async function listCountryStats(): Promise<CountryStat[]> {
  try {
    return await fetchQuery(api.barks.countryStats, {});
  } catch (error) {
    console.error("Failed to list country stats:", error);
    return [];
  }
}

export async function listPublicSources(): Promise<Source[]> {
  try {
    const docs = await fetchQuery(api.barks.listPublicSources, {});
    return docs.map(toUiSource);
  } catch (error) {
    console.error("Failed to list public sources:", error);
    return [];
  }
}

export async function getBarkByCodeAction(code: string): Promise<Bark | null> {
  noStore();
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  try {
    const doc = await fetchQuery(api.barks.getByCode, { code: normalized });
    return doc ? toUiBark(doc) : null;
  } catch (error) {
    console.error("Failed to get bark by code:", error);
    return null;
  }
}

export async function listMyBarks(): Promise<Bark[]> {
  try {
    const token = await getConvexClerkToken("view your reactions");
    const docs = await fetchQuery(
      api.barks.listMine,
      { status: "public" },
      { token }
    );
    return docs.map(toUiBark);
  } catch {
    return [];
  }
}

export async function updateBarkDraft(
  code: string,
  input: PublishBarkInput
): Promise<{ code: string }> {
  const token = await getConvexClerkToken("update a draft reaction");
  let sourceCreatorId: Id<"creators"> | undefined = input.sourceCreatorId
    ? (input.sourceCreatorId as Id<"creators">)
    : undefined;
  await fetchMutation(
    api.barks.update,
    {
      code,
      type: input.type,
      title: input.title,
      body: input.body,
      sourceUrl: input.sourceUrl,
      sourceTitle: input.sourceTitle,
      sourcePlatform: input.sourcePlatform,
      sourceCreatorName: input.sourceCreatorName,
      ...(sourceCreatorId ? { sourceCreatorId } : {}),
      ...(input.sourceThumbnailUrl
        ? { sourceThumbnailUrl: input.sourceThumbnailUrl }
        : {}),
      topics: input.topics,
      ...(input.quotedBarkCode !== undefined
        ? { quotedBarkCode: input.quotedBarkCode || null }
        : {}),
      evidence: input.evidence.map((item) => ({
        type: item.type,
        title: item.title,
        url: item.url,
        storageId: item.storageId
          ? (item.storageId as Id<"_storage">)
          : undefined,
        fileName: item.fileName,
        contentType: item.contentType,
      })),
    },
    { token }
  );
  if (input.status === "public") {
    await fetchMutation(api.barks.publishDraft, { code }, { token });
  }
  return { code };
}

export async function removeBarkDraft(code: string): Promise<void> {
  const token = await getConvexClerkToken("delete a draft reaction");
  await fetchMutation(api.barks.remove, { code }, { token });
}

export async function listBarksBySourceCreator(
  creatorId: string
): Promise<Bark[]> {
  try {
    const docs = await fetchQuery(api.barks.listBySourceCreator, {
      creatorId: creatorId as Id<"creators">,
    });
    return docs.map(toUiBark);
  } catch (error) {
    console.error("Failed to list barks by source creator:", error);
    return [];
  }
}
