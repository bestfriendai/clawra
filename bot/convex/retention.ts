import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getState = query({
  args: { telegramId: v.number() },
  handler: async (ctx, { telegramId }) => {
    return await ctx.db
      .query("retentionStates")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .first();
  },
});

export const upsertState = mutation({
  args: {
    telegramId: v.number(),
    streak: v.number(),
    lastChatDate: v.string(),
    messageCount: v.number(),
    stage: v.string(),
    lastJealousyTrigger: v.optional(v.number()),
    lastCliffhanger: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("retentionStates")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", args.telegramId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("retentionStates", {
        ...args,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});
