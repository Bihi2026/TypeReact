import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAdmin } from "./lib/admin";
import { creatorVerificationFields } from "./lib/validators";

const verificationDoc = v.object({
  ...creatorVerificationFields,
  _id: v.id("creatorVerifications"),
  _creationTime: v.number(),
});

export const getByCreatorId = query({
  args: { creatorId: v.id("creators") },
  returns: v.union(verificationDoc, v.null()),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("creatorVerifications")
      .withIndex("by_creator", (q) => q.eq("creatorId", args.creatorId))
      .order("desc")
      .take(1);
    return rows[0] ?? null;
  },
});
