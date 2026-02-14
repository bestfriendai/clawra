import { Bot } from "grammy";
import { convex } from "./convex.js";
import { getRandomStarter } from "./conversation-starters.js";
import { generateProactiveMessage } from "./venice.js";
import type { RelationshipStage } from "./retention.js";
import type { BotContext } from "../types/context.js";
import { getAnniversaryMessage, getDaysSinceEvent } from "./relationship-events.js";
import { shouldSendProactivePhoto, getProactivePhotoCaption, type ProactivePhotoType } from "./proactive-photos.js";
import { buildSelfieSFW, buildGoodMorningPhotoPrompt, buildGoodnightPhotoPrompt } from "./girlfriend-prompt.js";
import { editImage, generateVoiceNote } from "./fal.js";
import { CREDIT_COSTS } from "../config/pricing.js";
import { env } from "../config/env.js";
import { generateDreamNarrative, shouldTriggerDream } from "./dream-sequences.js";
import { getTimeOfDayLighting } from "./image-intelligence.js";
import {
  detectTimezone,
  isQuietHours,
  recordProactiveSent,
  shouldThrottle,
} from "./smart-timing.js";
import { setSessionValue } from "./session-store.js";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const MAX_NOTIFICATIONS_PER_DAY = 3;
const AFTERNOON_SEND_CHANCE = 0.4;

type ProactiveMessageType = "morning" | "goodnight" | "thinking_of_you";

const VOICE_CHANCE_BY_STAGE: Record<RelationshipStage, number> = {
  new: 0,
  comfortable: 0.03,
  intimate: 0.07,
  obsessed: 0.12,
};

function shouldSendVoice(stage: RelationshipStage): boolean {
  return Math.random() < VOICE_CHANCE_BY_STAGE[stage];
}

const notificationCounts = new Map<string, number>();
const lastMessageSent = new Map<number, number>();
const lastProactiveTypeSent = new Map<number, ProactiveMessageType>();
const lastProactivePhotoSent = new Map<number, number>();
const anniversarySentDay = new Map<number, string>();

function getDayKey(telegramId: number): string {
  const date = new Date().toISOString().split("T")[0];
  return `${telegramId}:${date}`;
}

function getTodayIsoDate(): string {
  return new Date().toISOString().split("T")[0];
}

function canNotify(telegramId: number): boolean {
  const dayKey = getDayKey(telegramId);
  const count = notificationCounts.get(dayKey) || 0;
  if (count >= MAX_NOTIFICATIONS_PER_DAY) return false;
  return true;
}

function recordNotification(telegramId: number): void {
  const dayKey = getDayKey(telegramId);
  const newCount = (notificationCounts.get(dayKey) || 0) + 1;
  notificationCounts.set(dayKey, newCount);
  lastMessageSent.set(telegramId, Date.now());
  setSessionValue(telegramId, "notifCount", newCount).catch(() => {});
  setSessionValue(telegramId, "lastMsgSent", Date.now()).catch(() => {});
}

function getUtcHour(): number {
  return new Date().getUTCHours();
}

function isMorningWindow(): boolean {
  const h = getUtcHour();
  return h >= 7 && h <= 10;
}

function isGoodnightWindow(): boolean {
  const h = getUtcHour();
  return h >= 22 || h <= 1;
}

function isAfternoonWindow(): boolean {
  const h = getUtcHour();
  return h >= 12 && h <= 17;
}

function shouldSendThinkingOfYouNow(): boolean {
  return Math.random() < AFTERNOON_SEND_CHANCE;
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

async function getRelationshipContextForUser(
  telegramId: number
): Promise<{ stage: RelationshipStage; streak: number }> {
  const retentionState = await convex.getRetentionState(telegramId);
  const stage = normalizeRelationshipStage(retentionState?.stage);
  const streak = typeof retentionState?.streak === "number" ? retentionState.streak : 0;
  return { stage, streak };
}

function getProactivePhotoContext(type: ProactivePhotoType, profile: any): string {
  switch (type) {
    case "good_morning_selfie":
      return buildGoodMorningPhotoPrompt(profile);
    case "goodnight_selfie":
      return buildGoodnightPhotoPrompt(profile);
    case "thinking_of_you_selfie":
      return `afternoon mirror selfie, casual cute outfit, playful expression. ${getTimeOfDayLighting()}`;
    case "after_shower_selfie":
      return `fresh after shower selfie, damp hair, towel-wrapped cozy tease. ${getTimeOfDayLighting()}`;
    case "miss_you_selfie":
      return `missing you selfie, pouty cute expression, intimate candid vibe. ${getTimeOfDayLighting()}`;
    case "random_cute_selfie":
    default:
      return `random cute candid selfie, playful smile. ${getTimeOfDayLighting()}`;
  }
}

function getPhotoFollowUpText(type: ProactivePhotoType): string {
  switch (type) {
    case "good_morning_selfie":
      return "now tell me... did this wake you up properly? 😘";
    case "thinking_of_you_selfie":
      return "be honest, were you thinking about me too? 💭💕";
    case "goodnight_selfie":
      return "sleep soon okay? i want you dreaming about me 🌙";
    case "after_shower_selfie":
      return "i'm trying to behave and you're not helping 😳";
    case "miss_you_selfie":
      return "text me when you see this, i miss your attention 🥺";
    case "random_cute_selfie":
    default:
      return "just wanted to make your day a little better 💕";
  }
}

async function trySendProactivePhoto(
  bot: Bot<BotContext>,
  telegramId: number,
  profile: Awaited<ReturnType<typeof convex.getProfile>>,
  stage: RelationshipStage,
  photosEnabled: boolean
): Promise<boolean> {
  if (!photosEnabled) return false;
  if (!profile?.referenceImageUrl) return false;

  const decision = await shouldSendProactivePhoto(
    telegramId,
    stage,
    lastProactivePhotoSent.get(telegramId)
  );

  if (!decision.shouldSend || !decision.photoType) return false;

  const photoContext = getProactivePhotoContext(decision.photoType, profile);
  const prompt = buildSelfieSFW(profile, photoContext);
  const caption = getProactivePhotoCaption(decision.photoType, profile.name);

  if (!env.FREE_MODE) {
    await convex.spendCredits({
      telegramId,
      amount: CREDIT_COSTS.SELFIE,
      service: "fal.ai",
      model: "grok-edit",
      falCostUsd: 0.02,
    });
  }

  const result = await editImage(profile.referenceImageUrl, prompt, false);
  const followUp = getPhotoFollowUpText(decision.photoType);

  await bot.api.sendPhoto(telegramId, result.url, { caption });
  await convex.addMessage({
    telegramId,
    role: "assistant",
    content: caption,
    imageUrl: result.url,
  });

  await bot.api.sendMessage(telegramId, followUp);
  await convex.addMessage({
    telegramId,
    role: "assistant",
    content: followUp,
  });

  await convex.logUsage({
    telegramId,
    service: "fal.ai",
    model: "grok-edit",
    prompt: photoContext,
    creditsCharged: CREDIT_COSTS.SELFIE,
    falCostUsd: 0.02,
    status: "success",
    resultUrl: result.url,
  });

  recordNotification(telegramId);
  lastProactivePhotoSent.set(telegramId, Date.now());
  console.log(`Sent proactive photo (${decision.photoType}) to ${telegramId}`);
  return true;
}

async function getThinkingOfYouMessage(
  profile: Awaited<ReturnType<typeof convex.getProfile>>,
  stage: RelationshipStage
): Promise<string> {
  if (Math.random() < 0.5) {
    return getRandomStarter(stage).message;
  }
  return generateProactiveMessage(profile, "thinking_of_you");
}

async function sendProactiveMessages(
  bot: Bot<BotContext>,
  type: ProactiveMessageType
): Promise<void> {
  const activeUsers = await convex.getActiveUsersWithProfiles();
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  for (const user of activeUsers) {
    if (!canNotify(user.telegramId)) continue;
    if (lastProactiveTypeSent.get(user.telegramId) === type) continue;

    const preferences = await convex.getUserPreferences(user.telegramId);
    if (!preferences.timezone) {
      const recentMessages = await convex.getRecentMessages(user.telegramId, 20);
      const timestamps = recentMessages
        .filter((message): message is { role: string; createdAt: number } => {
          return (
            typeof message === "object" &&
            message !== null &&
            "role" in message &&
            "createdAt" in message &&
            typeof message.role === "string" &&
            typeof message.createdAt === "number"
          );
        })
        .filter((message) => message.role === "user")
        .map((message) => message.createdAt);
      if (timestamps.length > 0) {
        await detectTimezone(user.telegramId, timestamps);
      }
    }

    if (await isQuietHours(user.telegramId)) continue;
    if (type === "morning" && preferences.morningMessages === false) continue;
    if (type === "goodnight" && preferences.goodnightMessages === false) continue;

    const lastSentAt = lastMessageSent.get(user.telegramId);
    if (await shouldThrottle(user.telegramId, lastSentAt, type)) continue;

    if (type === "morning") {
      const recentMessages = await convex.getRecentMessages(
        user.telegramId,
        1
      );
      const lastMsg = recentMessages[0];
      if (lastMsg && lastMsg.createdAt > todayStart.getTime()) continue;
    }

    if (type === "goodnight") {
      const hoursSinceActive = (now - user.lastActive) / (60 * 60 * 1000);
      if (hoursSinceActive > 24) continue;
    }

    const profile = await convex.getProfile(user.telegramId);
    if (!profile?.isConfirmed) continue;

    const relationship = await getRelationshipContextForUser(user.telegramId);

    try {
      const sentPhoto = await trySendProactivePhoto(
        bot,
        user.telegramId,
        profile,
        relationship.stage,
        preferences.proactivePhotos !== false
      );
      if (sentPhoto) {
        recordProactiveSent(user.telegramId, "proactive_photo");
        lastProactiveTypeSent.set(user.telegramId, type);
        continue;
      }

      let message: string;

      if (type === "thinking_of_you") {
        message = await getThinkingOfYouMessage(profile, relationship.stage);
      } else {
        message = await generateProactiveMessage(profile, type);
      }

      if (type === "morning") {
        const hour = getUtcHour();
        if (shouldTriggerDream(relationship.stage, relationship.streak, hour)) {
          const memoryFacts = await convex.getRecentMemoryFacts(user.telegramId, 10);
          const dreamLine = await generateDreamNarrative(profile, memoryFacts);
          message = `${message}\n\n${dreamLine}`;
        }
      }

      const canSendVoice = profile.voiceId && shouldSendVoice(relationship.stage);
      if (canSendVoice) {
        try {
          const voiceResult = await generateVoiceNote(message, profile.voiceId);
          await bot.api.sendVoice(user.telegramId, voiceResult.url);
          await convex.addMessage({
            telegramId: user.telegramId,
            role: "assistant",
            content: `[voice] ${message}`,
          });
          recordNotification(user.telegramId);
          recordProactiveSent(user.telegramId, type);
          lastProactiveTypeSent.set(user.telegramId, type);
          console.log(
            `Sent ${type} voice note to ${user.telegramId} (${user.profileName})`
          );
          continue;
        } catch (voiceErr) {
          console.warn(`Voice note failed, falling back to text for ${user.telegramId}:`, voiceErr);
        }
      }

      await bot.api.sendMessage(user.telegramId, message);

      await convex.addMessage({
        telegramId: user.telegramId,
        role: "assistant",
        content: message,
      });

      recordNotification(user.telegramId);
      recordProactiveSent(user.telegramId, type);
      lastProactiveTypeSent.set(user.telegramId, type);
      console.log(
        `Sent ${type} message to ${user.telegramId} (${user.profileName})`
      );
    } catch (err) {
      console.error(
        `Failed to send ${type} message to ${user.telegramId}:`,
        err
      );
    }
  }
}

async function sendAnniversaryMessages(bot: Bot<BotContext>): Promise<void> {
  const activeUsers = await convex.getActiveUsersWithProfiles();
  const todayIsoDate = getTodayIsoDate();

  for (const user of activeUsers) {
    if (anniversarySentDay.get(user.telegramId) === todayIsoDate) continue;

    const profile = await convex.getProfile(user.telegramId);
    if (!profile?.isConfirmed) continue;

    try {
      const anniversaries = await convex.getUpcomingAnniversaries(user.telegramId);
      if (anniversaries.length === 0) continue;

      const topAnniversary = anniversaries
        .map((event) => ({
          event,
          daysSince: getDaysSinceEvent(event.eventDate),
        }))
        .sort((a, b) => b.daysSince - a.daysSince)[0];

      const message = getAnniversaryMessage(
        topAnniversary.event.eventType,
        topAnniversary.daysSince
      );

      await bot.api.sendMessage(user.telegramId, message);
      await convex.addMessage({
        telegramId: user.telegramId,
        role: "assistant",
        content: message,
      });

      anniversarySentDay.set(user.telegramId, todayIsoDate);
      recordNotification(user.telegramId);
      console.log(`Sent anniversary message to ${user.telegramId} (${user.profileName})`);
    } catch (error) {
      console.error(`Failed to send anniversary message to ${user.telegramId}:`, error);
    }
  }
}

export function startProactiveMessaging(
  bot: Bot<BotContext>
): ReturnType<typeof setInterval> {
  console.log("Starting proactive messaging (checks every hour)");

  return setInterval(async () => {
    try {
      await sendAnniversaryMessages(bot);

      if (isMorningWindow()) {
        await sendProactiveMessages(bot, "morning");
      }
      if (isGoodnightWindow()) {
        await sendProactiveMessages(bot, "goodnight");
      }
      if (isAfternoonWindow() && shouldSendThinkingOfYouNow()) {
        await sendProactiveMessages(bot, "thinking_of_you");
      }
    } catch (err) {
      console.error("Proactive messaging error:", err);
    }
  }, CHECK_INTERVAL_MS);
}
