import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_PREFERENCES = {
  morningMessages: true,
  goodnightMessages: true,
  proactivePhotos: true,
  quietHoursStart: 23,
  quietHoursEnd: 7,
  timezone: "UTC+0",
};

export const getPreferences = query({
  args: { telegramId: v.number() },
  handler: async (ctx, { telegramId }) => {
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .first();

    return {
      ...DEFAULT_PREFERENCES,
      ...existing,
      telegramId,
    };
  },
});

export const updatePreferences = mutation({
  args: {
    telegramId: v.number(),
    preferences: v.object({
      morningMessages: v.optional(v.boolean()),
      goodnightMessages: v.optional(v.boolean()),
      proactivePhotos: v.optional(v.boolean()),
      quietHoursStart: v.optional(v.number()),
      quietHoursEnd: v.optional(v.number()),
      timezone: v.optional(v.string()),
      missYouEnabled: v.optional(v.boolean()),
      missYouHourUtc: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { telegramId, preferences }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...preferences,
        updatedAt: now,
      });
      return;
    }

    await ctx.db.insert("userPreferences", {
      telegramId,
      ...DEFAULT_PREFERENCES,
      ...preferences,
      createdAt: now,
      updatedAt: now,
    });
  },
});
