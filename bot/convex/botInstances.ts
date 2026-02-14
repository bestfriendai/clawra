import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const register = internalMutation({
  args: {
    ownerTelegramId: v.number(),
    botToken: v.string(),
    botUsername: v.optional(v.string()),
    girlfriendName: v.optional(v.string()),
    girlfriendPersonality: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("botInstances")
      .withIndex("by_botToken", (q) => q.eq("botToken", args.botToken))
      .first();

    if (existing) {
      throw new Error("Bot token already registered");
    }

    const now = Date.now();
    const id = await ctx.db.insert("botInstances", {
      ownerTelegramId: args.ownerTelegramId,
      botToken: args.botToken,
      botUsername: args.botUsername,
      girlfriendName: args.girlfriendName,
      girlfriendPersonality: args.girlfriendPersonality,
      isActive: true,
      totalUsers: 0,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

export const list = internalQuery({
  args: { ownerTelegramId: v.number() },
  handler: async (ctx, { ownerTelegramId }) => {
    return await ctx.db
      .query("botInstances")
      .withIndex("by_ownerTelegramId", (q) =>
        q.eq("ownerTelegramId", ownerTelegramId)
      )
      .collect();
  },
});

export const getByToken = internalQuery({
  args: { botToken: v.string() },
  handler: async (ctx, { botToken }) => {
    return await ctx.db
      .query("botInstances")
      .withIndex("by_botToken", (q) => q.eq("botToken", botToken))
      .first();
  },
});

export const internalGetByToken = internalQuery({
  args: { botToken: v.string() },
  handler: async (ctx, { botToken }) => {
    return await ctx.db
      .query("botInstances")
      .withIndex("by_botToken", (q) => q.eq("botToken", botToken))
      .first();
  },
});

export const deactivate = internalMutation({
  args: { botToken: v.string() },
  handler: async (ctx, { botToken }) => {
    const bot = await ctx.db
      .query("botInstances")
      .withIndex("by_botToken", (q) => q.eq("botToken", botToken))
      .first();

    if (!bot) {
      throw new Error("Bot not found");
    }

    await ctx.db.patch(bot._id, {
      isActive: false,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const updateConfig = internalMutation({
  args: {
    botToken: v.string(),
    girlfriendName: v.optional(v.string()),
    girlfriendPersonality: v.optional(v.string()),
  },
  handler: async (ctx, { botToken, girlfriendName, girlfriendPersonality }) => {
    const bot = await ctx.db
      .query("botInstances")
      .withIndex("by_botToken", (q) => q.eq("botToken", botToken))
      .first();

    if (!bot) {
      throw new Error("Bot not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (girlfriendName !== undefined) updates.girlfriendName = girlfriendName;
    if (girlfriendPersonality !== undefined)
      updates.girlfriendPersonality = girlfriendPersonality;

    await ctx.db.patch(bot._id, updates);

    return { success: true };
  },
});

export const setWebhookUrl = internalMutation({
  args: {
    botToken: v.string(),
    webhookUrl: v.string(),
  },
  handler: async (ctx, { botToken, webhookUrl }) => {
    const bot = await ctx.db
      .query("botInstances")
      .withIndex("by_botToken", (q) => q.eq("botToken", botToken))
      .first();

    if (!bot) {
      throw new Error("Bot not found");
    }

    await ctx.db.patch(bot._id, {
      webhookUrl,
      updatedAt: Date.now(),
    });
  },
});

export const listAll = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("botInstances").collect();
  },
});
