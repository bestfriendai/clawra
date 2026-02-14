import { query } from "./_generated/server";

export const getStats = query({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const credits = await ctx.db.query("credits").collect();
    const transactions = await ctx.db.query("transactions").collect();

    const totalUsers = users.length;
    const activeUsers = users.filter(
      (u) => u.lastActive > Date.now() - 7 * 24 * 60 * 60 * 1000
    ).length;
    const bannedUsers = users.filter((u) => u.isBanned).length;

    const totalRevenue = transactions
      .filter((t) => t.type === "purchase")
      .reduce((sum, t) => sum + t.amount * 0.01, 0);

    const totalCosts = transactions
      .filter((t) => t.falCostUsd)
      .reduce((sum, t) => sum + (t.falCostUsd ?? 0), 0);

    const totalCreditsInCirculation = credits.reduce(
      (sum, c) => sum + c.balance,
      0
    );

    return {
      totalUsers,
      activeUsers,
      bannedUsers,
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
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const users = await ctx.db.query("users").collect();
    const transactions = await ctx.db.query("transactions").collect();
    const usageLogs = await ctx.db.query("usageLogs").collect();
    const messages = await ctx.db.query("messages").collect();
    const credits = await ctx.db.query("credits").collect();

    // --- User stats ---
    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.lastActive > sevenDaysAgo).length;
    const bannedUsers = users.filter((u) => u.isBanned).length;

    // --- Per-day revenue for last 7 days ---
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const revenueByDay: { day: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now - i * 24 * 60 * 60 * 1000);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const dayRevenue = transactions
        .filter(
          (t) =>
            t.type === "purchase" &&
            t.createdAt >= dayStart.getTime() &&
            t.createdAt < dayEnd.getTime()
        )
        .reduce((sum, t) => sum + t.amount * 0.01, 0);
      revenueByDay.push({
        day: dayNames[dayStart.getUTCDay()] ?? "?",
        revenue: Math.round(dayRevenue * 100) / 100,
      });
    }
    const totalRevenue7d = revenueByDay.reduce((s, d) => s + d.revenue, 0);

    // --- Model usage breakdown ---
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

    // --- Top 5 users by credits spent ---
    const topUsers = credits
      .filter((c) => c.lifetimeSpent > 0)
      .sort((a, b) => b.lifetimeSpent - a.lifetimeSpent)
      .slice(0, 5)
      .map((c) => {
        const user = users.find((u) => u.telegramId === c.telegramId);
        return {
          telegramId: c.telegramId,
          username: user?.username || user?.firstName || String(c.telegramId),
          creditsSpent: c.lifetimeSpent,
        };
      });

    // --- Totals ---
    const totalMessages = messages.length;
    const totalImages = usageLogs.filter(
      (l) => l.service === "selfie" || l.service === "image" || l.service === "image_edit"
    ).length;
    const totalVoice = usageLogs.filter(
      (l) => l.service === "voice" || l.service === "tts"
    ).length;

    const totalCreditsInCirculation = credits.reduce(
      (sum, c) => sum + c.balance,
      0
    );

    // --- All-time costs & revenue ---
    const totalCosts = transactions
      .filter((t) => t.falCostUsd)
      .reduce((sum, t) => sum + (t.falCostUsd ?? 0), 0);
    const totalRevenueAllTime = transactions
      .filter((t) => t.type === "purchase")
      .reduce((sum, t) => sum + t.amount * 0.01, 0);

    // --- Active users with confirmed profiles (for proactive messaging) ---
    const profiles = await ctx.db.query("girlfriendProfiles").collect();
    const confirmedProfiles = profiles.filter((p) => p.isConfirmed).length;

    return {
      totalUsers,
      activeUsers,
      bannedUsers,
      confirmedProfiles,
      revenueByDay,
      totalRevenue7d: Math.round(totalRevenue7d * 100) / 100,
      modelUsage,
      topUsers,
      totalMessages,
      totalImages,
      totalVoice,
      totalCreditsInCirculation,
      totalCosts: Math.round(totalCosts * 100) / 100,
      totalRevenueAllTime: Math.round(totalRevenueAllTime * 100) / 100,
      totalProfit:
        Math.round((totalRevenueAllTime - totalCosts) * 100) / 100,
    };
  },
});

export const getActiveUsersWithProfiles = query({
  handler: async (ctx) => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const users = await ctx.db.query("users").collect();
    const activeUsers = users.filter(
      (u) => !u.isBanned && u.lastActive > oneDayAgo
    );

    const results: Array<{
      telegramId: number;
      lastActive: number;
      profileName: string;
    }> = [];

    for (const user of activeUsers) {
      const profile = await ctx.db
        .query("girlfriendProfiles")
        .withIndex("by_telegramId", (q) =>
          q.eq("telegramId", user.telegramId)
        )
        .first();
      if (profile?.isConfirmed) {
        results.push({
          telegramId: user.telegramId,
          lastActive: user.lastActive,
          profileName: profile.name,
        });
      }
    }
    return results;
  },
});
