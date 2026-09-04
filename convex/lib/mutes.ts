import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Infer } from "convex/values";
import { caseCategory } from "./validators";

type CaseCategory = Infer<typeof caseCategory>;

export type MuteSets = {
  authors: Set<string>;
  topics: Set<CaseCategory>;
};

export async function loadMuteSets(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string
): Promise<MuteSets> {
  const rows = await ctx.db
    .query("userMutes")
    .withIndex("by_user", (q) => q.eq("clerkUserId", clerkUserId))
    .take(100);
  const authors = new Set<string>();
  const topics = new Set<CaseCategory>();
  for (const row of rows) {
    if (row.kind === "author" && row.targetClerkId) {
      authors.add(row.targetClerkId);
    }
    if (row.kind === "topic" && row.topic) {
      topics.add(row.topic);
    }
  }
  return { authors, topics };
}

export function barkIsMuted(
  bark: Pick<Doc<"barks">, "authorClerkId" | "topics">,
  mutes: MuteSets
): boolean {
  if (mutes.authors.has(bark.authorClerkId)) return true;
  for (const topic of bark.topics ?? []) {
    if (mutes.topics.has(topic)) return true;
  }
  return false;
}

export async function filterMutedBarks(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string | null,
  barks: Doc<"barks">[]
): Promise<Doc<"barks">[]> {
  if (!clerkUserId) return barks;
  const mutes = await loadMuteSets(ctx, clerkUserId);
  if (mutes.authors.size === 0 && mutes.topics.size === 0) return barks;
  return barks.filter((bark) => !barkIsMuted(bark, mutes));
}
