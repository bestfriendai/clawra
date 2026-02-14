import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addMessage = mutation({
  args: {
    telegramId: v.number(),
    role: v.string(),
    content: v.string(),
    imageUrl: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    voiceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getRecent = query({
  args: { telegramId: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, { telegramId, limit }) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_telegramId_createdAt", (q) =>
        q.eq("telegramId", telegramId)
      )
      .order("desc")
      .take(limit ?? 20);
    return messages.reverse();
  },
});

// ─── Mini App Queries ────────────────────────────────────────────────

export const getWithImages = internalQuery({
  args: { telegramId: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, { telegramId, limit }) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_telegramId_createdAt", (q) =>
        q.eq("telegramId", telegramId)
      )
      .order("desc")
      .take(limit ?? 50);
    return messages
      .filter((m) => m.imageUrl)
      .map((m) => ({
        imageUrl: m.imageUrl,
        createdAt: m.createdAt,
      }));
  },
});
