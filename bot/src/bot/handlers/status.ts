import type { BotContext } from "../../types/context.js";
import { convex } from "../../services/convex.js";
import { getLevel, getXPForNextLevel } from "../../services/relationship-xp.js";

function formatTogetherSince(timestamp?: number): string {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return "Just now";
  }

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function handleStatus(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from!.id;
  const [xpState, events, retentionState, user] = await Promise.all([
    convex.getRelationshipXP(telegramId),
    convex.getUserRelationshipEvents(telegramId),
    convex.getRetentionState(telegramId),
    convex.getUser(telegramId),
  ]);

  const girlfriendName = ctx.girlfriend?.name || "Her";
  const totalXP = xpState?.totalXP ?? 0;
  const levelInfo = getLevel(totalXP);
  const xpRemaining = getXPForNextLevel(totalXP);
  const xpTarget = xpRemaining > 0 ? totalXP + xpRemaining : levelInfo.xp;
  const streakDays = xpState?.streakDays ?? 0;
  const messageCount =
    retentionState && typeof retentionState.messageCount === "number"
      ? retentionState.messageCount
      : 0;

  const firstEventTimestamp = events.length > 0 ? events[0]?.eventDate : undefined;
  const togetherSinceTimestamp = firstEventTimestamp ?? user?.createdAt;

  await ctx.reply(
    `💕 ${girlfriendName} & You\n` +
      `Level: ${levelInfo.name} (Lv. ${levelInfo.level})\n` +
      `XP: ${totalXP.toLocaleString()} / ${xpTarget.toLocaleString()}\n` +
      `Streak: ${streakDays.toLocaleString()} days 🔥\n` +
      `Together since: ${formatTogetherSince(togetherSinceTimestamp)}\n` +
      `Messages: ${messageCount.toLocaleString()}`
  );
}
