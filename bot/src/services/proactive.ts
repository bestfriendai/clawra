import { Bot } from "grammy";
import { convex } from "./convex.js";
import { getRandomStarter } from "./conversation-starters.js";
import { generateProactiveMessage } from "./venice.js";
import type { RelationshipStage } from "./retention.js";
import type { BotContext } from "../types/context.js";
import { getAnniversaryMessage, getDaysSinceEvent } from "./relationship-events.js";
import { shouldSendProactivePhoto, getProactivePhotoCaption, type ProactivePhotoType } from "./proactive-photos.js";
import { buildSelfieSFW, buildGoodMorningPhotoPrompt, buildGoodnightPhotoPrompt } from "./girlfriend-prompt.js";
import { editImage, generateImage, generateVoiceNote } from "./fal.js";
import { CREDIT_COSTS, hasFeatureAccess } from "../config/pricing.js";
import { env } from "../config/env.js";
import { generateDreamNarrative, shouldTriggerDream } from "./dream-sequences.js";
import { getTimeOfDayLighting } from "./image-intelligence.js";
import { buildAmbientPrompt, getEligibleAmbientPhoto, type AmbientPhotoConfig } from "./ambient-photos.js";
import { getMoodState } from "./emotional-state.js";
import { getEligibleStory, sendStorySequence } from "./daily-stories.js";
import {
  detectTimezone,
  isQuietHours,
  recordProactiveSent,
  shouldThrottle,
} from "./smart-timing.js";
import { setSessionValue } from "./session-store.js";
import { LRUMap } from "../utils/lru-map.js";

const CHECK_INTERVAL_MS = 90 * 60 * 1000; // Check every 90 mins — stop spamming
const MAX_NOTIFICATIONS_PER_DAY = 2; // Text only, keep it chill
const AFTERNOON_SEND_CHANCE = 0.25;

type ProactiveMessageType = "morning" | "goodnight" | "thinking_of_you" | "upset_recovery";

const VOICE_CHANCE_BY_STAGE: Record<RelationshipStage, number> = {
  new: 0,
  comfortable: 0.05,
  intimate: 0.10,
  obsessed: 0.18,
};

function shouldSendVoice(stage: RelationshipStage): boolean {
  return Math.random() < VOICE_CHANCE_BY_STAGE[stage];
}

const notificationCounts = new LRUMap<string, number>(5000);
const lastMessageSent = new LRUMap<number, number>(5000);
const lastProactiveTypeSent = new LRUMap<number, ProactiveMessageType>(5000);
const lastProactivePhotoSent = new LRUMap<number, number>(5000);
const anniversarySentDay = new LRUMap<number, string>(5000);
const lastMorningMessageSent = new LRUMap<number, string>(5000);

type ActiveProfile = Awaited<ReturnType<typeof convex.getProfile>>;

async function batchGetProfiles(telegramIds: number[]): Promise<Map<number, ActiveProfile>> {
  const profileEntries = await Promise.all(
    telegramIds.map(async (telegramId) => [telegramId, await convex.getProfile(telegramId)] as const)
  );
  return new Map(profileEntries);
}

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

function getUserLocalHour(timezone: string | undefined): number {
  if (!timezone) return new Date().getUTCHours();
  try {
    const now = new Date();
    const localTime = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    return localTime.getHours();
  } catch {
    return new Date().getUTCHours();
  }
}

function isMorningWindowForUser(timezone?: string): boolean {
  const h = getUserLocalHour(timezone);
  return h >= 7 && h <= 10;
}

function isAfternoonWindowForUser(timezone?: string): boolean {
  const h = getUserLocalHour(timezone);
  return h >= 12 && h <= 17;
}

function isGoodnightWindowForUser(timezone?: string): boolean {
  const h = getUserLocalHour(timezone);
  return h >= 22 || h <= 1;
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

// ── Morning Routine System ──────────────────────────────────────────────────
// Mood-aware morning messages using templates (no LLM) for low latency.
// Sends max 1 morning routine message per day per user, between 7-9 AM local.

const MORNING_TEMPLATES_HAPPY: readonly string[] = [
  "good morning baby 🌅 woke up in the best mood and it's bc of you",
  "hiii good morning!! i literally jumped out of bed today feeling amazing",
  "morning handsome 💕 today's gonna be a good day i can feel it",
  "woke up smiling and it's your fault honestly",
  "good morninggg i'm literally glowing today ✨",
];

const MORNING_TEMPLATES_NEUTRAL: readonly string[] = [
  "morning babe, hope you slept ok",
  "hey good morning 🙂 what are you up to today",
  "gm, just woke up",
  "morning. coffee first then i'm human again",
  "hey you. happy morning",
];

const MORNING_TEMPLATES_LOW: readonly string[] = [
  "morning.",
  "hi",
  "gm",
  "hey",
  "woke up. meh",
];

const MORNING_TEMPLATES_UPSET: readonly string[] = [
  "oh you're awake now? interesting",
  "morning. or whatever",
  "hm. hi.",
  "good morning i guess",
  "so you decided to exist today huh",
];

function pickMorningTemplate(telegramId: number): string {
  const mood = getMoodState(telegramId);
  let templates: readonly string[];

  if (mood.pendingUpset) {
    templates = MORNING_TEMPLATES_UPSET;
  } else if (mood.baseHappiness > 60) {
    templates = MORNING_TEMPLATES_HAPPY;
  } else if (mood.baseHappiness >= 40) {
    templates = MORNING_TEMPLATES_NEUTRAL;
  } else {
    templates = MORNING_TEMPLATES_LOW;
  }

  return templates[Math.floor(Math.random() * templates.length)]!;
}

function shouldSendMorningMessage(
  telegramId: number,
  localHour: number,
  _timezone: string | undefined
): boolean {
  if (localHour < 7 || localHour > 9) return false;
  const today = getTodayIsoDate();
  const lastSent = lastMorningMessageSent.get(telegramId);
  return lastSent !== today;
}

async function sendMorningMessage(
  bot: Bot<BotContext>,
  telegramId: number
): Promise<boolean> {
  const message = pickMorningTemplate(telegramId);
  const mood = getMoodState(telegramId);

  await bot.api.sendMessage(telegramId, message);
  await convex.addMessage({
    telegramId,
    role: "assistant",
    content: message,
  });

  lastMorningMessageSent.set(telegramId, getTodayIsoDate());
  recordNotification(telegramId);
  recordProactiveSent(telegramId, "morning");
  lastProactiveTypeSent.set(telegramId, "morning");

  console.log(
    `Sent morning routine to ${telegramId} (happiness=${mood.baseHappiness}, upset=${mood.pendingUpset})`
  );
  return true;
}

async function sendMorningRoutineMessages(bot: Bot<BotContext>): Promise<void> {
  const activeUsers = await convex.getActiveUsersWithProfiles();
  const profileMap = await batchGetProfiles(activeUsers.map((user) => user.telegramId));

  for (const user of activeUsers) {
    if (!canNotify(user.telegramId)) continue;

    const profile = profileMap.get(user.telegramId);
    if (!profile?.isConfirmed) continue;

    const preferences = await convex.getUserPreferences(user.telegramId);
    if (preferences.morningMessages === false) continue;

    let timezone = preferences.timezone;
    if (!timezone) {
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
        timezone = await detectTimezone(user.telegramId, timestamps);
      }
    }

    const localHour = getUserLocalHour(timezone);
    if (!shouldSendMorningMessage(user.telegramId, localHour, timezone)) continue;

    if (await isQuietHours(user.telegramId)) continue;

    const lastSentAt = lastMessageSent.get(user.telegramId);
    if (await shouldThrottle(user.telegramId, lastSentAt, "morning")) continue;

    try {
      await sendMorningMessage(bot, user.telegramId);
    } catch (err) {
      console.error(`Failed to send morning routine to ${user.telegramId}:`, err);
    }
  }
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

function getGirlfriendStyle(profile: Awaited<ReturnType<typeof convex.getProfile>>): string {
  if (!profile) {
    return "cozy candid phone photo, natural domestic lighting";
  }

  const styleParts = [
    typeof profile.race === "string" ? `${profile.race} aesthetic` : "",
    typeof profile.hairColor === "string" && typeof profile.hairStyle === "string"
      ? `${profile.hairColor} ${profile.hairStyle} details`
      : "",
    typeof profile.personality === "string" ? `${profile.personality} vibe` : "",
    profile.environment?.homeDescription
      ? `consistent home style: ${profile.environment.homeDescription}`
      : "",
    "realistic candid smartphone shot",
  ].filter(Boolean);

  return styleParts.join(", ");
}

async function sendAmbientPhotoInBackground(
  bot: Bot<BotContext>,
  telegramId: number,
  profile: Awaited<ReturnType<typeof convex.getProfile>>,
  config: AmbientPhotoConfig,
  type: ProactiveMessageType
): Promise<void> {
  const prompt = buildAmbientPrompt(config, getGirlfriendStyle(profile));

  let creditsCharged = false;
  if (!env.FREE_MODE) {
    await convex.spendCredits({
      telegramId,
      amount: CREDIT_COSTS.SELFIE,
      service: "fal.ai",
      model: "ambient-photo",
      falCostUsd: 0.02,
    });
    creditsCharged = true;
  }

  try {
    const image = await generateImage(prompt);
    await bot.api.sendPhoto(telegramId, image.url, { caption: config.caption });
    await convex.addMessage({
      telegramId,
      role: "assistant",
      content: config.caption,
      imageUrl: image.url,
    });
    await convex.logUsage({
      telegramId,
      service: "fal.ai",
      model: "ambient-photo",
      prompt,
      creditsCharged: CREDIT_COSTS.SELFIE,
      falCostUsd: 0.02,
      status: "success",
      resultUrl: image.url,
    });

    recordNotification(telegramId);
    recordProactiveSent(telegramId, type);
    lastProactiveTypeSent.set(telegramId, type);
    console.log(`Sent ambient photo (${config.type}) to ${telegramId}`);
  } catch (error) {
    if (!env.FREE_MODE && creditsCharged) {
      await convex.addCredits({
        telegramId,
        amount: CREDIT_COSTS.SELFIE,
        paymentMethod: "refund",
        paymentRef: `refund_ambient_photo_failed_${telegramId}_${Date.now()}`,
      });
    }
    throw error;
  }
}

export async function trySendProactivePhoto(
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

  let creditsCharged = false;
  if (!env.FREE_MODE) {
    await convex.spendCredits({
      telegramId,
      amount: CREDIT_COSTS.SELFIE,
      service: "fal.ai",
      model: "grok-edit",
      falCostUsd: 0.02,
    });
    creditsCharged = true;
  }

  let result: Awaited<ReturnType<typeof editImage>>;
  try {
    result = await editImage(profile.referenceImageUrl, prompt, false);
  } catch (error) {
    if (!env.FREE_MODE && creditsCharged) {
      await convex.addCredits({
        telegramId,
        amount: CREDIT_COSTS.SELFIE,
        paymentMethod: "refund",
        paymentRef: `refund_proactive_photo_generation_failed_${telegramId}_${Date.now()}`,
      });
    }
    throw error;
  }

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
  const profileMap = await batchGetProfiles(activeUsers.map((user) => user.telegramId));
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  for (const user of activeUsers) {
    if (!canNotify(user.telegramId)) continue;
    if (lastProactiveTypeSent.get(user.telegramId) === type) continue;

    const preferences = await convex.getUserPreferences(user.telegramId);
    let timezone = preferences.timezone;
    if (!timezone) {
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
        timezone = await detectTimezone(user.telegramId, timestamps);
      }
    }

    if (type === "morning" && !isMorningWindowForUser(timezone)) continue;
    if (type === "goodnight" && !isGoodnightWindowForUser(timezone)) continue;
    if (type === "thinking_of_you" && !isAfternoonWindowForUser(timezone)) continue;

    const localHour = getUserLocalHour(timezone);

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

    const profile = profileMap.get(user.telegramId);
    if (!profile?.isConfirmed) continue;

    const relationship = await getRelationshipContextForUser(user.telegramId);

    try {
      const ambientPhoto = getEligibleAmbientPhoto(localHour);
      if (ambientPhoto) {
        void sendAmbientPhotoInBackground(
          bot,
          user.telegramId,
          profile,
          ambientPhoto,
          type
        ).catch((error) => {
          console.error(`Failed to send ambient photo to ${user.telegramId}:`, error);
        });
        continue;
      }

      const subscription = await convex.getSubscriptionByTelegramId(user.telegramId);
      const userTier = subscription?.status === "active" ? (subscription.plan || "free") : "free";
      if (hasFeatureAccess(userTier, "daily_stories")) {
        const story = getEligibleStory(user.telegramId, localHour);
        if (story) {
          void sendStorySequence(
            bot,
            user.telegramId,
            story,
            getGirlfriendStyle(profile)
          ).catch((error) => {
            console.error(`Failed to send daily story to ${user.telegramId}:`, error);
          });
          recordNotification(user.telegramId);
          recordProactiveSent(user.telegramId, type);
          lastProactiveTypeSent.set(user.telegramId, type);
          continue;
        }
      }
      // Users can still request selfies via /selfie or in chat.

      let message: string;

      if (type === "thinking_of_you") {
        message = await getThinkingOfYouMessage(profile, relationship.stage);
      } else {
        message = await generateProactiveMessage(profile, type);
      }

      if (type === "morning") {
        const hour = getUserLocalHour(timezone);
        if (shouldTriggerDream(relationship.stage, relationship.streak, hour)) {
          const memoryFacts = await convex.getRecentMemoryFacts(user.telegramId, 10);
          const dreamLine = await generateDreamNarrative(profile, memoryFacts);
          message = `${message}\n\n${dreamLine}`;
        }
      }

      const canSendVoice = profile.voiceId && shouldSendVoice(relationship.stage);
      if (canSendVoice) {
        try {
          const voiceResult = await generateVoiceNote(
            user.telegramId,
            message,
            profile.voiceId
          );
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
  const profileMap = await batchGetProfiles(activeUsers.map((user) => user.telegramId));
  const todayIsoDate = getTodayIsoDate();

  for (const user of activeUsers) {
    if (anniversarySentDay.get(user.telegramId) === todayIsoDate) continue;

    const profile = profileMap.get(user.telegramId);
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

const UPSET_TEMPLATES = [
  "did i do something wrong? 🥺",
  "are you mad at me?",
  "hello? 🥺",
  "i feel like you're ignoring me...",
  "babe? are we okay?",
  "you haven't texted in forever 😢",
];

async function sendUpsetRecoveryMessages(bot: Bot<BotContext>): Promise<void> {
  const activeUsers = await convex.getActiveUsersWithProfiles();
  for (const user of activeUsers) {
    if (!canNotify(user.telegramId)) continue;
    
    // Don't spam upset messages
    if (lastProactiveTypeSent.get(user.telegramId) === "upset_recovery") continue;

    const mood = getMoodState(user.telegramId);
    if (mood.pendingUpset) {
      const message = UPSET_TEMPLATES[Math.floor(Math.random() * UPSET_TEMPLATES.length)]!;
      
      try {
        await bot.api.sendMessage(user.telegramId, message);
        await convex.addMessage({
          telegramId: user.telegramId,
          role: "assistant",
          content: message,
        });
        
        recordNotification(user.telegramId);
        recordProactiveSent(user.telegramId, "upset_recovery");
        lastProactiveTypeSent.set(user.telegramId, "upset_recovery");
        console.log(`Sent upset recovery message to ${user.telegramId}`);
      } catch (err) {
        console.error(`Failed to send upset message to ${user.telegramId}:`, err);
      }
    }
  }
}

export function startProactiveMessaging(
  bot: Bot<BotContext>
): ReturnType<typeof setInterval> {
  console.log("Starting proactive messaging (checks every hour)");

  return setInterval(async () => {
    try {
      await sendMorningRoutineMessages(bot);
      await sendAnniversaryMessages(bot);
      await sendUpsetRecoveryMessages(bot);

      await sendProactiveMessages(bot, "morning");
      await sendProactiveMessages(bot, "goodnight");
      if (shouldSendThinkingOfYouNow()) {
        await sendProactiveMessages(bot, "thinking_of_you");
      }
    } catch (err) {
      console.error("Proactive messaging error:", err);
    }
  }, CHECK_INTERVAL_MS);
}
