import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DAY_MS = 24 * 60 * 60 * 1000;

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export const trackEvent = mutation({
  args: {
    telegramId: v.float64(),
    event: v.string(),
    metadata: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("analyticsEvents", args);
  },
});

export const getEventCounts = query({
  args: {
    startTimestamp: v.float64(),
    endTimestamp: v.float64(),
  },
  handler: async (ctx, { startTimestamp, endTimestamp }) => {
    const events = await ctx.db.query("analyticsEvents").collect();
    const counts = new Map<string, number>();

    for (const analyticsEvent of events) {
      if (
        analyticsEvent.timestamp >= startTimestamp &&
        analyticsEvent.timestamp <= endTimestamp
      ) {
        counts.set(
          analyticsEvent.event,
          (counts.get(analyticsEvent.event) ?? 0) + 1
        );
      }
    }

    return Array.from(counts.entries())
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count);
  },
});

export const getUserEngagement = query({
  args: {
    telegramId: v.float64(),
  },
  handler: async (ctx, { telegramId }) => {
    const events = await ctx.db
      .query("analyticsEvents")
      .withIndex("by_user", (q) => q.eq("telegramId", telegramId))
      .collect();

    const counts = new Map<string, number>();

    for (const analyticsEvent of events) {
      counts.set(analyticsEvent.event, (counts.get(analyticsEvent.event) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count);
  },
});

export const getDailyActiveUsers = query({
  args: {
    days: v.float64(),
  },
  handler: async (ctx, { days }) => {
    const cutoff = Date.now() - days * DAY_MS;
    const events = await ctx.db.query("analyticsEvents").collect();
    const activeUsers = new Set<number>();

    for (const analyticsEvent of events) {
      if (analyticsEvent.timestamp >= cutoff) {
        activeUsers.add(analyticsEvent.telegramId);
      }
    }

    return activeUsers.size;
  },
});

export const getRevenueMetrics = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * DAY_MS;
    const transactions = await ctx.db.query("transactions").collect();
    const purchases = transactions.filter(
      (transaction) =>
        transaction.type === "purchase" && transaction.createdAt >= sevenDaysAgo
    );

    const totalRevenue = purchases.reduce(
      (sum, transaction) => sum + transaction.amount * 0.01,
      0
    );
    const payingUsers = new Set(purchases.map((transaction) => transaction.telegramId));
    const arpu = payingUsers.size > 0 ? totalRevenue / payingUsers.size : 0;

    const revenueByDay: Array<{ day: string; revenue: number }> = [];
    for (let i = 6; i >= 0; i -= 1) {
      const dayStart = new Date(now - i * DAY_MS);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);

      const dayRevenue = purchases
        .filter(
          (transaction) =>
            transaction.createdAt >= dayStart.getTime() &&
            transaction.createdAt < dayEnd.getTime()
        )
        .reduce((sum, transaction) => sum + transaction.amount * 0.01, 0);

      revenueByDay.push({
        day: dayStart.toISOString().slice(0, 10),
        revenue: roundToCents(dayRevenue),
      });
    }

    return {
      totalRevenue: roundToCents(totalRevenue),
      arpu: roundToCents(arpu),
      revenueByDay,
    };
  },
});
