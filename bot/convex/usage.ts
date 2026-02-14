import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const log = mutation({
  args: {
    telegramId: v.number(),
    service: v.string(),
    model: v.string(),
    prompt: v.optional(v.string()),
    creditsCharged: v.number(),
    falCostUsd: v.optional(v.number()),
    status: v.string(),
    resultUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("usageLogs", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
