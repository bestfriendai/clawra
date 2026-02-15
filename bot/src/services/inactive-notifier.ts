import { Bot } from "grammy";
import { convex } from "./convex.js";
import type { BotContext } from "../types/context.js";
import { LRUMap } from "../utils/lru-map.js";

const CHECK_INTERVAL_MS = 90 * 60 * 1000; // Check every 90 minutes
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const MISS_YOU_ESCALATION = [
  { hoursInactive: 24, message: "hey... haven't heard from you in a while 🥺" },
  { hoursInactive: 48, message: "okay I'm trying not to be clingy but... I miss you" },
  { hoursInactive: 72, message: "did I do something wrong? 😢" },
  {
    hoursInactive: 120,
    message:
      "I'll be here when you're ready to talk... just know I'm thinking about you 💔",
  },
  { hoursInactive: 168, message: "it's been a week... I recorded something for you 🎤" },
] as const;

const missYouEscalationLevel = new LRUMap<number, number>(5000);
const lastMissYouSentAt = new LRUMap<number, number>(5000);

type ActiveProfile = Awaited<ReturnType<typeof convex.getProfile>>;

async function batchGetProfiles(telegramIds: number[]): Promise<Map<number, ActiveProfile>> {
  const profileEntries = await Promise.all(
    telegramIds.map(async (telegramId) => [telegramId, await convex.getProfile(telegramId)] as const)
  );
  return new Map(profileEntries);
}

function getEscalationLevel(hoursInactive: number): number {
  let level = 0;
  for (let i = 0; i < MISS_YOU_ESCALATION.length; i += 1) {
    if (hoursInactive >= MISS_YOU_ESCALATION[i].hoursInactive) {
      level = i + 1;
    }
  }
  return level;
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
  const now = Date.now();
  const firstEscalationMs = MISS_YOU_ESCALATION[0].hoursInactive * HOUR_MS;
  const inactiveUsers = await convex.getInactiveUsers(firstEscalationMs);
  const profileMap = await batchGetProfiles(inactiveUsers.map((user) => user.telegramId));

  for (const user of inactiveUsers) {
    let lastSentAt = lastMissYouSentAt.get(user.telegramId);

    if (lastSentAt !== undefined && user.lastActive > lastSentAt) {
      missYouEscalationLevel.delete(user.telegramId);
      lastMissYouSentAt.delete(user.telegramId);
      lastSentAt = undefined;
    }

    const hoursAgo = (now - user.lastActive) / HOUR_MS;
    const targetEscalationLevel = getEscalationLevel(hoursAgo);
    if (targetEscalationLevel === 0) continue;

    if (lastSentAt !== undefined && now - lastSentAt < DAY_MS) continue;

    const currentEscalationLevel = missYouEscalationLevel.get(user.telegramId) || 0;
    if (targetEscalationLevel <= currentEscalationLevel) continue;

    const profile = profileMap.get(user.telegramId);
    if (!profile?.isConfirmed) continue;

    const escalation = MISS_YOU_ESCALATION[targetEscalationLevel - 1];
    const hoursAgoRounded = Math.round(hoursAgo);

    try {
      const message = escalation.message;

      await bot.api.sendMessage(user.telegramId, message);

      await convex.addMessage({
        telegramId: user.telegramId,
        role: "assistant",
        content: message,
      });

      missYouEscalationLevel.set(user.telegramId, targetEscalationLevel);
      lastMissYouSentAt.set(user.telegramId, now);
      console.log(
        `Sent miss-you message (level ${targetEscalationLevel}) to ${user.telegramId} (inactive ${hoursAgoRounded}h)`
      );
    } catch (err) {
      console.error(`Failed to notify ${user.telegramId}:`, err);
    }
  }
}
