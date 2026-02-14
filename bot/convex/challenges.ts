import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DAY_MS = 86_400_000;

function getUtcDayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export const completeChallenge = mutation({
  args: {
    telegramId: v.float64(),
    challengeId: v.string(),
    creditsAwarded: v.float64(),
  },
  handler: async (ctx, { telegramId, challengeId, creditsAwarded }) => {
    const now = Date.now();
    const todayKey = getUtcDayKey(now);
    const existing = await ctx.db
      .query("challengeCompletions")
      .withIndex("by_user", (q) => q.eq("telegramId", telegramId))
      .collect();

    const alreadyCompletedToday = existing.some(
      (completion) =>
        completion.challengeId === challengeId &&
        getUtcDayKey(completion.completedAt) === todayKey
    );

    if (alreadyCompletedToday) {
      return { completed: false };
    }

    await ctx.db.insert("challengeCompletions", {
      telegramId,
      challengeId,
      completedAt: now,
      creditsAwarded,
    });

    return { completed: true };
  },
});

export const hasCompletedToday = query({
  args: {
    telegramId: v.float64(),
    challengeId: v.string(),
  },
  handler: async (ctx, { telegramId, challengeId }) => {
    const todayKey = getUtcDayKey(Date.now());
    const existing = await ctx.db
      .query("challengeCompletions")
      .withIndex("by_user", (q) => q.eq("telegramId", telegramId))
      .collect();

    return existing.some(
      (completion) =>
        completion.challengeId === challengeId &&
        getUtcDayKey(completion.completedAt) === todayKey
    );
  },
});

export const getUserChallengeCount = query({
  args: { telegramId: v.float64() },
  handler: async (ctx, { telegramId }) => {
    const completions = await ctx.db
      .query("challengeCompletions")
      .withIndex("by_user", (q) => q.eq("telegramId", telegramId))
      .collect();
    return completions.length;
  },
});

export const getLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30 * DAY_MS;
    const allCompletions = await ctx.db.query("challengeCompletions").collect();
    const recentCompletions = allCompletions.filter(
      (completion) => completion.completedAt >= cutoff
    );

    const completionCounts = new Map<number, number>();
    for (const completion of recentCompletions) {
      completionCounts.set(
        completion.telegramId,
        (completionCounts.get(completion.telegramId) ?? 0) + 1
      );
    }

    const topUsers = Array.from(completionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return await Promise.all(
      topUsers.map(async ([telegramId, count]) => {
        const profile = await ctx.db
          .query("girlfriendProfiles")
          .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
          .first();
        const user = await ctx.db
          .query("users")
          .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
          .first();

        return {
          telegramId,
          count,
          profileName:
            profile?.name ??
            user?.firstName ??
            user?.username ??
            `User ${telegramId}`,
        };
      })
    );
  },
});
