import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const awardBadge = mutation({
  args: {
    telegramId: v.float64(),
    badgeId: v.string(),
    badgeName: v.string(),
    badgeEmoji: v.string(),
  },
  handler: async (ctx, { telegramId, badgeId, badgeName, badgeEmoji }) => {
    const existingBadges = await ctx.db
      .query("achievements")
      .withIndex("by_user", (q) => q.eq("telegramId", telegramId))
      .collect();

    const hasBadge = existingBadges.some((badge) => badge.badgeId === badgeId);
    if (hasBadge) {
      return { awarded: false };
    }

    await ctx.db.insert("achievements", {
      telegramId,
      badgeId,
      earnedAt: Date.now(),
      badgeName,
      badgeEmoji,
    });

    return { awarded: true };
  },
});

export const getUserBadges = query({
  args: { telegramId: v.float64() },
  handler: async (ctx, { telegramId }) => {
    const badges = await ctx.db
      .query("achievements")
      .withIndex("by_user", (q) => q.eq("telegramId", telegramId))
      .collect();

    return badges.sort((a, b) => b.earnedAt - a.earnedAt);
  },
});

export const hasBadge = query({
  args: {
    telegramId: v.float64(),
    badgeId: v.string(),
  },
  handler: async (ctx, { telegramId, badgeId }) => {
    const badges = await ctx.db
      .query("achievements")
      .withIndex("by_user", (q) => q.eq("telegramId", telegramId))
      .collect();

    return badges.some((badge) => badge.badgeId === badgeId);
  },
});
