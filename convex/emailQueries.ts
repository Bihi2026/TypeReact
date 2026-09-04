import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

export const getRecipient = internalQuery({
  args: { recipientClerkId: v.string() },
  returns: v.union(
    v.object({
      email: v.string(),
      name: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.recipientClerkId))
      .unique();
    if (!user?.email?.trim()) return null;
    return {
      email: user.email.trim(),
      name: user.name?.trim() || "there",
    };
  },
});
