import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByTelegramId = query({
  args: { telegramId: v.number() },
  handler: async (ctx, { telegramId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .first();
  },
});

export const create = mutation({
  args: {
    telegramId: v.number(),
    username: v.optional(v.string()),
    firstName: v.optional(v.string()),
    referredBy: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", args.telegramId))
      .first();
    if (existing) return existing._id;

    const now = Date.now();
    return await ctx.db.insert("users", {
      telegramId: args.telegramId,
      username: args.username,
      firstName: args.firstName,
      tier: "free",
      referredBy: args.referredBy,
      isBanned: false,
      createdAt: now,
      lastActive: now,
    });
  },
});

export const getInactive = query({
  args: { thresholdMs: v.number() },
  handler: async (ctx, { thresholdMs }) => {
    const cutoff = Date.now() - thresholdMs;
    const users = await ctx.db.query("users").collect();
    return users.filter(
      (u) => !u.isBanned && u.lastActive < cutoff
    );
  },
});

export const updateLastActive = mutation({
  args: { telegramId: v.number() },
  handler: async (ctx, { telegramId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .first();
    if (user) {
      await ctx.db.patch(user._id, { lastActive: Date.now() });
    }
  },
});

