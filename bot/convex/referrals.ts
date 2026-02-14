import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const REFERRAL_CREDITS_AWARDED = 25;
const ACTIVE_REFERRAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export const recordReferral = mutation({
  args: {
    referrerTelegramId: v.float64(),
    referredTelegramId: v.float64(),
  },
  handler: async (ctx, { referrerTelegramId, referredTelegramId }) => {
    if (referrerTelegramId === referredTelegramId) {
      return { success: false, reason: "self_referral" } as const;
    }

    const referredUser = await ctx.db
      .query("users")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", referredTelegramId))
      .first();
    if (referredUser) {
      return { success: false, reason: "referred_user_exists" } as const;
    }

    const existingByReferred = await ctx.db
      .query("referrals")
      .withIndex("by_referred", (q) => q.eq("referredTelegramId", referredTelegramId))
      .first();
    if (existingByReferred) {
      return { success: false, reason: "already_referred" } as const;
    }

    const existingPair = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrerTelegramId", referrerTelegramId))
      .collect();
    const duplicatePair = existingPair.some(
      (referral) => referral.referredTelegramId === referredTelegramId
    );
    if (duplicatePair) {
      return { success: false, reason: "duplicate_pair" } as const;
    }

    await ctx.db.insert("referrals", {
      referrerTelegramId,
      referredTelegramId,
      creditsAwarded: REFERRAL_CREDITS_AWARDED,
      status: "completed",
      createdAt: Date.now(),
    });

    return { success: true } as const;
  },
});

export const getReferralCount = query({
  args: { telegramId: v.float64() },
  handler: async (ctx, { telegramId }) => {
    const referrals = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrerTelegramId", telegramId))
      .collect();
    return referrals.filter((referral) => referral.status === "completed").length;
  },
});

export const getReferralStats = query({
  args: { telegramId: v.float64() },
  handler: async (ctx, { telegramId }) => {
    const now = Date.now();
    const activeCutoff = now - ACTIVE_REFERRAL_WINDOW_MS;

    const referrals = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrerTelegramId", telegramId))
      .collect();

    const completedReferrals = referrals.filter(
      (referral) => referral.status === "completed"
    );

    let activeReferrals = 0;
    for (const referral of completedReferrals) {
      const referredUser = await ctx.db
        .query("users")
        .withIndex("by_telegramId", (q) => q.eq("telegramId", referral.referredTelegramId))
        .first();

      if (referredUser && !referredUser.isBanned && referredUser.lastActive >= activeCutoff) {
        activeReferrals += 1;
      }
    }

    const totalCreditsEarned = completedReferrals.reduce(
      (sum, referral) => sum + referral.creditsAwarded,
      0
    );

    return {
      totalReferrals: completedReferrals.length,
      totalCreditsEarned,
      activeReferrals,
    };
  },
});

function anonymizeName(name: string): string {
  if (!name) return "use***";
  const visible = name.slice(0, 3);
  return `${visible}***`;
}

export const getTopReferrers = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, { limit }) => {
    const effectiveLimit = Math.max(1, Math.min(Math.floor(limit ?? 5), 50));
    const referrals = await ctx.db.query("referrals").collect();
    const completedReferrals = referrals.filter((referral) => referral.status === "completed");

    const totalsByReferrer = new Map<number, { count: number; credits: number }>();

    for (const referral of completedReferrals) {
      const current = totalsByReferrer.get(referral.referrerTelegramId) ?? {
        count: 0,
        credits: 0,
      };
      current.count += 1;
      current.credits += referral.creditsAwarded;
      totalsByReferrer.set(referral.referrerTelegramId, current);
    }

    const sorted = Array.from(totalsByReferrer.entries())
      .sort((a, b) => {
        if (b[1].count !== a[1].count) return b[1].count - a[1].count;
        return b[1].credits - a[1].credits;
      })
      .slice(0, effectiveLimit);

    return await Promise.all(
      sorted.map(async ([telegramId, stats]) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
          .first();

        const rawName = user?.firstName ?? user?.username ?? `user${telegramId}`;

        return {
          telegramId,
          displayName: anonymizeName(rawName),
          referralCount: stats.count,
          creditsEarned: stats.credits,
        };
      })
    );
  },
});
