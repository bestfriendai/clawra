import type { BotContext } from "../../types/context.js";
import { convex } from "../../services/convex.js";
import { env } from "../../config/env.js";
import { getHealthStatus } from "../../services/health-monitor.js";

function toServiceEmoji(status: "up" | "down"): string {
  return status === "up" ? "✅" : "❌";
}

function toSystemEmoji(status: "healthy" | "degraded" | "unhealthy"): string {
  if (status === "healthy") return "✅";
  if (status === "degraded") return "⚠️";
  return "❌";
}

export async function handleAdmin(ctx: BotContext) {
  const telegramId = ctx.from!.id;

  if (!env.ADMIN_TELEGRAM_IDS.includes(telegramId)) {
    await ctx.reply("Unauthorized.");
    return;
  }

  try {
    const now = Date.now();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const [stats, analyticsSummary, todayEventCounts, healthStatus] = await Promise.all([
      convex.getDetailedStats(),
      convex.getAnalyticsSummary(),
      convex.getAnalyticsEventCounts(todayStart.getTime(), now),
      getHealthStatus(),
    ]);

    const revenueLine = stats.revenueByDay
      .map((d: { day: string; revenue: number }) => `${d.day}: $${d.revenue.toFixed(2)}`)
      .join(" | ");

    const modelLines = stats.modelUsage
      .slice(0, 8)
      .map(
        (m: { model: string; calls: number; cost: number }) =>
          `  ${m.model}: ${m.calls} calls ($${m.cost.toFixed(4)})`
      )
      .join("\n");

    const topUserLines = stats.topUsers
      .map(
        (u: { username: string; creditsSpent: number }, i: number) =>
          `  ${i + 1}. @${u.username} — ${u.creditsSpent} credits`
      )
      .join("\n");

    const totalEventsToday = todayEventCounts.reduce((sum, item) => sum + item.count, 0);
    const topEventLines = todayEventCounts
      .slice(0, 5)
      .map((item, index) => `  ${index + 1}. ${item.event} — ${item.count}`)
      .join("\n");

    const dashboard =
      `📊 Admin Dashboard\n\n` +
      `👥 Users: ${stats.totalUsers} total | ${stats.activeUsers} active (7d) | ${stats.bannedUsers} banned\n` +
      `💑 Confirmed profiles: ${stats.confirmedProfiles}\n\n` +
      `🩺 Health ${toSystemEmoji(healthStatus.status)} ${healthStatus.status.toUpperCase()}\n` +
      `  Venice: ${toServiceEmoji(healthStatus.services.venice.status)} ${healthStatus.services.venice.status} (${healthStatus.services.venice.latencyMs ?? "n/a"}ms)\n` +
      `  fal.ai: ${toServiceEmoji(healthStatus.services.fal.status)} ${healthStatus.services.fal.status} (${healthStatus.services.fal.latencyMs ?? "n/a"}ms)\n` +
      `  Convex: ${toServiceEmoji(healthStatus.services.convex.status)} ${healthStatus.services.convex.status} (${healthStatus.services.convex.latencyMs ?? "n/a"}ms)\n` +
      `  Memory RSS: ${healthStatus.memory.rss} | Heap: ${healthStatus.memory.heapUsed}\n` +
      `  Uptime: ${healthStatus.uptime}\n` +
      `  24h Active Users: ${healthStatus.metrics.activeUsers24h} | Msg/h: ${healthStatus.metrics.messagesLastHour} | Errors/h: ${healthStatus.metrics.errorsLastHour}\n\n` +
      `💰 Revenue (7d)\n${revenueLine}\nTotal: $${stats.totalRevenue7d.toFixed(2)}\n\n` +
      `🎨 Model Usage\n${modelLines}\n\n` +
      `🏆 Top Users\n${topUserLines || "  No spending yet"}\n\n` +
      `📈 Totals\n` +
      `  Messages: ${stats.totalMessages} | Images: ${stats.totalImages} | Voice: ${stats.totalVoice}\n` +
      `  Credits in circulation: ${stats.totalCreditsInCirculation}\n\n` +
      `💵 All-Time\n` +
      `  Revenue: $${stats.totalRevenueAllTime.toFixed(2)} | Costs: $${stats.totalCosts.toFixed(2)} | Profit: $${stats.totalProfit.toFixed(2)}\n\n` +
      `📡 Analytics\n` +
      `  DAU (7d): ${analyticsSummary.dailyActiveUsers}\n` +
      `  Total events today: ${totalEventsToday}\n` +
      `  Top events today:\n${topEventLines || "  No events yet"}\n` +
      `  Revenue (7d): $${analyticsSummary.revenueMetrics.totalRevenue.toFixed(2)} | ARPU: $${analyticsSummary.revenueMetrics.arpu.toFixed(2)}`;

    await ctx.reply(dashboard);
  } catch (err) {
    console.error("Admin stats error:", err);
    await ctx.reply("Error fetching stats. Check server logs.");
  }
}
