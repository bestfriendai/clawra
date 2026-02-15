import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveEmotionalSnapshot = mutation({
  args: {
    telegramId: v.number(),
    snapshot: v.object({
      emotion: v.string(),
      intensity: v.number(),
      microEmotions: v.optional(v.array(v.string())),
      timestamp: v.number(),
      relationshipDay: v.optional(v.number()),
      significantEvent: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { telegramId, snapshot }) => {
    return await ctx.db.insert("emotionalSnapshots", {
      telegramId,
      emotion: snapshot.emotion,
      intensity: snapshot.intensity,
      microEmotions: snapshot.microEmotions,
      timestamp: snapshot.timestamp,
      relationshipDay: snapshot.relationshipDay,
      significantEvent: snapshot.significantEvent,
    });
  },
});

export const getRecentSnapshots = query({
  args: {
    telegramId: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { telegramId, limit }) => {
    const cappedLimit = Math.max(1, Math.min(limit ?? 50, 50));

    return await ctx.db
      .query("emotionalSnapshots")
      .withIndex("by_telegramId_timestamp", (q) => q.eq("telegramId", telegramId))
      .order("desc")
      .take(cappedLimit);
  },
});
