import { query } from "./_generated/server";

const DAY_MS = 24 * 60 * 60 * 1000;

export const getStats = query({
  handler: async (ctx) => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * DAY_MS;

    const [users, activeUsers, bannedUsers, credits, purchases, transactionsForCosts] =
      await Promise.all([
        ctx.db.query("users").withIndex("by_createdAt", (q) => q.gt("createdAt", 0)).collect(),
        ctx.db
          .query("users")
          .withIndex("by_lastActive", (q) => q.gt("lastActive", sevenDaysAgo))
          .collect(),
        ctx.db
          .query("users")
          .withIndex("by_isBanned", (q) => q.eq("isBanned", true))
          .collect(),
        ctx.db
          .query("credits")
          .withIndex("by_telegramId", (q) => q.gt("telegramId", 0))
          .collect(),
        ctx.db
          .query("transactions")
          .withIndex("by_type_createdAt", (q) => q.eq("type", "purchase").gt("createdAt", 0))
          .collect(),
        ctx.db
          .query("transactions")
          .withIndex("by_createdAt", (q) => q.gt("createdAt", 0))
          .collect(),
      ]);

    const totalRevenue = purchases.reduce((sum, t) => sum + t.amount * 0.01, 0);
    const totalCosts = transactionsForCosts.reduce((sum, t) => sum + (t.falCostUsd ?? 0), 0);
    const totalCreditsInCirculation = credits.reduce((sum, c) => sum + c.balance, 0);

    return {
      totalUsers: users.length,
      activeUsers: activeUsers.length,
      bannedUsers: bannedUsers.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCosts: Math.round(totalCosts * 100) / 100,
      totalProfit: Math.round((totalRevenue - totalCosts) * 100) / 100,
      totalCreditsInCirculation,
    };
  },
});

export const getDetailedStats = query({
  handler: async (ctx) => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * DAY_MS;

    const [users, transactions, purchaseTransactions7d, usageLogs, messages, credits, confirmedProfiles] =
      await Promise.all([
        ctx.db.query("users").withIndex("by_createdAt", (q) => q.gt("createdAt", 0)).collect(),
        ctx.db
          .query("transactions")
          .withIndex("by_createdAt", (q) => q.gt("createdAt", 0))
          .collect(),
        ctx.db
          .query("transactions")
          .withIndex("by_type_createdAt", (q) => q.eq("type", "purchase").gt("createdAt", sevenDaysAgo))
          .collect(),
        ctx.db
          .query("usageLogs")
          .withIndex("by_createdAt", (q) => q.gt("createdAt", 0))
          .collect(),
        ctx.db
          .query("messages")
          .withIndex("by_createdAt", (q) => q.gt("createdAt", 0))
          .collect(),
        ctx.db
          .query("credits")
          .withIndex("by_telegramId", (q) => q.gt("telegramId", 0))
          .collect(),
        ctx.db
          .query("girlfriendProfiles")
          .withIndex("by_isConfirmed", (q) => q.eq("isConfirmed", true))
          .collect(),
      ]);

    const activeUsers = await ctx.db
      .query("users")
      .withIndex("by_lastActive", (q) => q.gt("lastActive", sevenDaysAgo))
      .collect();
    const bannedUsers = await ctx.db
      .query("users")
      .withIndex("by_isBanned", (q) => q.eq("isBanned", true))
      .collect();

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const revenueByDayMap = new Map<number, number>();
    for (const transaction of purchaseTransactions7d) {
      const dayStart = new Date(transaction.createdAt);
      dayStart.setUTCHours(0, 0, 0, 0);
      const key = dayStart.getTime();
      revenueByDayMap.set(key, (revenueByDayMap.get(key) ?? 0) + transaction.amount * 0.01);
    }

    const revenueByDay: { day: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now - i * DAY_MS);
      dayStart.setUTCHours(0, 0, 0, 0);
      const key = dayStart.getTime();
      const dayRevenue = revenueByDayMap.get(key) ?? 0;
      revenueByDay.push({
        day: dayNames[dayStart.getUTCDay()] ?? "?",
        revenue: Math.round(dayRevenue * 100) / 100,
      });
    }
    const totalRevenue7d = revenueByDay.reduce((sum, row) => sum + row.revenue, 0);

    const modelMap = new Map<string, { calls: number; cost: number }>();
    for (const log of usageLogs) {
      const key = log.model || log.service || "unknown";
      const existing = modelMap.get(key) || { calls: 0, cost: 0 };
      existing.calls += 1;
      existing.cost += log.falCostUsd ?? 0;
      modelMap.set(key, existing);
    }

    const modelUsage = Array.from(modelMap.entries())
      .map(([model, data]) => ({
        model,
        calls: data.calls,
        cost: Math.round(data.cost * 10000) / 10000,
      }))
      .sort((a, b) => b.calls - a.calls);

    const userMap = new Map(users.map((user) => [user.telegramId, user]));
    const topCredits = await ctx.db.query("credits").withIndex("by_lifetimeSpent").order("desc").take(10);
    const topUsers = topCredits
      .filter((credit) => credit.lifetimeSpent > 0)
      .slice(0, 5)
      .map((credit) => {
        const user = userMap.get(credit.telegramId);
        return {
          telegramId: credit.telegramId,
          username: user?.username || user?.firstName || String(credit.telegramId),
          creditsSpent: credit.lifetimeSpent,
        };
      });

    const totalImages = usageLogs.filter(
      (log) => log.service === "selfie" || log.service === "image" || log.service === "image_edit"
    ).length;
    const totalVoice = usageLogs.filter((log) => log.service === "voice" || log.service === "tts").length;
    const totalCreditsInCirculation = credits.reduce((sum, credit) => sum + credit.balance, 0);

    const totalCosts = transactions.reduce((sum, transaction) => sum + (transaction.falCostUsd ?? 0), 0);
    const totalRevenueAllTime = transactions
      .filter((transaction) => transaction.type === "purchase")
      .reduce((sum, transaction) => sum + transaction.amount * 0.01, 0);

    return {
      totalUsers: users.length,
      activeUsers: activeUsers.length,
      bannedUsers: bannedUsers.length,
      confirmedProfiles: confirmedProfiles.length,
      revenueByDay,
      totalRevenue7d: Math.round(totalRevenue7d * 100) / 100,
      modelUsage,
      topUsers,
      totalMessages: messages.length,
      totalImages,
      totalVoice,
      totalCreditsInCirculation,
      totalCosts: Math.round(totalCosts * 100) / 100,
      totalRevenueAllTime: Math.round(totalRevenueAllTime * 100) / 100,
      totalProfit: Math.round((totalRevenueAllTime - totalCosts) * 100) / 100,
    };
  },
});

export const getActiveUsersWithProfiles = query({
  handler: async (ctx) => {
    const oneDayAgo = Date.now() - DAY_MS;

    const [activeUsers, confirmedProfiles] = await Promise.all([
      ctx.db
        .query("users")
        .withIndex("by_isBanned_lastActive", (q) => q.eq("isBanned", false).gt("lastActive", oneDayAgo))
        .collect(),
      ctx.db
        .query("girlfriendProfiles")
        .withIndex("by_isConfirmed", (q) => q.eq("isConfirmed", true))
        .collect(),
    ]);

    const confirmedProfileMap = new Map(
      confirmedProfiles.map((profile) => [profile.telegramId, profile.name])
    );

    const results: Array<{
      telegramId: number;
      lastActive: number;
      profileName: string;
    }> = [];

    for (const user of activeUsers) {
      const profileName = confirmedProfileMap.get(user.telegramId);
      if (profileName) {
        results.push({
          telegramId: user.telegramId,
          lastActive: user.lastActive,
          profileName,
        });
      }
    }

    return results;
  },
});

export const getOnboardingCompletionRate = query({
  handler: async (ctx) => {
    const [users, confirmedProfiles] = await Promise.all([
      ctx.db.query("users").withIndex("by_createdAt", (q) => q.gt("createdAt", 0)).collect(),
      ctx.db
        .query("girlfriendProfiles")
        .withIndex("by_isConfirmed", (q) => q.eq("isConfirmed", true))
        .collect(),
    ]);

    const totalUsers = users.length;
    const completedOnboarding = confirmedProfiles.length;
    const completionRate = totalUsers === 0 ? 0 : (completedOnboarding / totalUsers) * 100;

    return {
      totalUsers,
      completedOnboarding,
      completionRate: Math.round(completionRate * 100) / 100,
    };
  },
});

export const getAverageMessagesPerUserPerDay = query({
  handler: async (ctx) => {
    const now = Date.now();
    const windowDays = 30;
    const windowStart = now - windowDays * DAY_MS;

    const recentMessages = await ctx.db
      .query("messages")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", windowStart))
      .collect();

    const usersWithMessages = new Set(recentMessages.map((message) => message.telegramId));
    const activeUserCount = usersWithMessages.size;
    const averageMessagesPerUserPerDay =
      activeUserCount === 0 ? 0 : recentMessages.length / (activeUserCount * windowDays);

    return {
      windowDays,
      totalMessages: recentMessages.length,
      activeUsers: activeUserCount,
      averageMessagesPerUserPerDay: Math.round(averageMessagesPerUserPerDay * 100) / 100,
    };
  },
});

export const getRetentionByCohort = query({
  handler: async (ctx) => {
    const now = Date.now();
    const users = await ctx.db.query("users").withIndex("by_createdAt", (q) => q.gt("createdAt", 0)).collect();

    const computeRetention = (days: number) => {
      const threshold = days * DAY_MS;
      const eligibleUsers = users.filter((user) => now - user.createdAt >= threshold);
      const retainedUsers = eligibleUsers.filter(
        (user) => user.lastActive - user.createdAt >= threshold
      );
      const rate = eligibleUsers.length === 0 ? 0 : (retainedUsers.length / eligibleUsers.length) * 100;

      return {
        eligibleUsers: eligibleUsers.length,
        retainedUsers: retainedUsers.length,
        retentionRate: Math.round(rate * 100) / 100,
      };
    };

    return {
      d1: computeRetention(1),
      d7: computeRetention(7),
      d30: computeRetention(30),
    };
  },
});

export const getRevenuePerTier = query({
  handler: async (ctx) => {
    const [users, purchases] = await Promise.all([
      ctx.db.query("users").withIndex("by_createdAt", (q) => q.gt("createdAt", 0)).collect(),
      ctx.db
        .query("transactions")
        .withIndex("by_type_createdAt", (q) => q.eq("type", "purchase").gt("createdAt", 0))
        .collect(),
    ]);

    const userTierMap = new Map(users.map((user) => [user.telegramId, user.tier]));
    const revenueByTierMap = new Map<string, number>();
    for (const purchase of purchases) {
      const tier = userTierMap.get(purchase.telegramId) ?? "unknown";
      revenueByTierMap.set(tier, (revenueByTierMap.get(tier) ?? 0) + purchase.amount * 0.01);
    }

    const revenueByTier = Array.from(revenueByTierMap.entries())
      .map(([tier, revenue]) => ({ tier, revenue: Math.round(revenue * 100) / 100 }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      revenueByTier,
      totalRevenue: Math.round(revenueByTier.reduce((sum, row) => sum + row.revenue, 0) * 100) / 100,
    };
  },
});
