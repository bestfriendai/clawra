import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { telegramId: v.number(), key: v.string() },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("sessionState")
      .withIndex("by_user_key", (q) =>
        q.eq("telegramId", args.telegramId).eq("key", args.key)
      )
      .first();
    return result?.value ?? null;
  },
});

export const getAll = query({
  args: { telegramId: v.number() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("sessionState")
      .withIndex("by_user_key", (q) => q.eq("telegramId", args.telegramId))
      .collect();
    const map: Record<string, string> = {};
    for (const r of results) {
      map[r.key] = r.value;
    }
    return map;
  },
});

export const set = mutation({
  args: {
    telegramId: v.number(),
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sessionState")
      .withIndex("by_user_key", (q) =>
        q.eq("telegramId", args.telegramId).eq("key", args.key)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("sessionState", {
        telegramId: args.telegramId,
        key: args.key,
        value: args.value,
        updatedAt: Date.now(),
      });
    }
  },
});
