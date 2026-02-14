import { Bot } from "grammy";
import { convex } from "./convex.js";
import { generateMissYouMessage } from "./venice.js";
import type { RelationshipStage } from "./retention.js";
import type { BotContext } from "../types/context.js";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour
const MAX_NOTIFICATIONS_PER_DAY = 2;
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

// Track notifications sent per user per day to avoid spam
const notificationCounts = new Map<string, number>();

function getDayKey(telegramId: number): string {
  const date = new Date().toISOString().split("T")[0];
  return `${telegramId}:${date}`;
}

function normalizeRelationshipStage(stage: unknown): RelationshipStage {
  if (
    stage === "new" ||
    stage === "comfortable" ||
    stage === "intimate" ||
    stage === "obsessed"
  ) {
    return stage;
  }
  return "new";
}

function getInactiveThresholdByStage(stage: RelationshipStage): number {
  if (stage === "obsessed") return THREE_HOURS_MS;
  if (stage === "intimate") return FOUR_HOURS_MS;
  return SIX_HOURS_MS;
}

export function startInactiveNotifier(bot: Bot<BotContext>): ReturnType<typeof setInterval> {
  console.log("Starting inactive user notifier (checks every hour)");

  return setInterval(async () => {
    try {
      await checkAndNotifyInactiveUsers(bot);
    } catch (err) {
      console.error("Inactive notifier error:", err);
    }
  }, CHECK_INTERVAL_MS);
}

async function checkAndNotifyInactiveUsers(bot: Bot<BotContext>): Promise<void> {
  // Get all users — in production you'd paginate this
  const now = Date.now();

  // We query users through Convex — get all users with confirmed profiles
  // For now, we rely on the lastActive field
  // This is a simplified approach; at scale you'd use a Convex query

  // Note: ConvexHttpClient doesn't support listing all users easily without a custom query.
  // We'll add a query for inactive users.
  const inactiveUsers = await convex.getInactiveUsers(THREE_HOURS_MS);

  for (const user of inactiveUsers) {
    const retentionState = await convex.getRetentionState(user.telegramId);
    const stage = normalizeRelationshipStage(retentionState?.stage);
    const userThresholdMs = getInactiveThresholdByStage(stage);
    if (now - user.lastActive < userThresholdMs) continue;

    const dayKey = getDayKey(user.telegramId);
    const count = notificationCounts.get(dayKey) || 0;
    if (count >= MAX_NOTIFICATIONS_PER_DAY) continue;

    // Get their girlfriend profile
    const profile = await convex.getProfile(user.telegramId);
    if (!profile?.isConfirmed) continue;

    const hoursAgo = Math.round((now - user.lastActive) / (60 * 60 * 1000));

    try {
      const message = await generateMissYouMessage(profile, hoursAgo);

      await bot.api.sendMessage(user.telegramId, message);

      // Save as assistant message for conversation continuity
      await convex.addMessage({
        telegramId: user.telegramId,
        role: "assistant",
        content: message,
      });

      notificationCounts.set(dayKey, count + 1);
      console.log(`Sent miss-you message to ${user.telegramId} (inactive ${hoursAgo}h)`);
    } catch (err) {
      // User may have blocked the bot
      console.error(`Failed to notify ${user.telegramId}:`, err);
    }
  }
}
