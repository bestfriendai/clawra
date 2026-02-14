import { convex } from "./convex.js";
import type { RelationshipStage } from "./retention.js";

export type ProactivePhotoType =
  | "good_morning_selfie"
  | "thinking_of_you_selfie"
  | "goodnight_selfie"
  | "random_cute_selfie"
  | "miss_you_selfie"
  | "after_shower_selfie";

type TimeOfDay = "morning" | "afternoon" | "evening" | "night" | "other";

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const SELFIE_COST = 5;

const STAGE_DAILY_LIMIT: Record<RelationshipStage, number> = {
  new: 1,
  comfortable: 2,
  intimate: 3,
  obsessed: 4,
};

const STAGE_WEIGHT: Record<RelationshipStage, number> = {
  new: 0.12,
  comfortable: 0.18,
  intimate: 0.24,
  obsessed: 0.32,
};

const STAGE_ORDER: Record<RelationshipStage, number> = {
  new: 0,
  comfortable: 1,
  intimate: 2,
  obsessed: 3,
};

function getUtcHour(): number {
  return new Date().getUTCHours();
}

function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 6 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 17) return "afternoon";
  if (hour >= 18 && hour <= 21) return "evening";
  if (hour >= 22 || hour <= 2) return "night";
  return "other";
}

function stageAtLeast(stage: RelationshipStage, min: RelationshipStage): boolean {
  return STAGE_ORDER[stage] >= STAGE_ORDER[min];
}

export function getProactivePhotoType(
  stage: RelationshipStage,
  timeOfDay: TimeOfDay
): ProactivePhotoType {
  if (timeOfDay === "morning") return "good_morning_selfie";
  if (timeOfDay === "afternoon") return "thinking_of_you_selfie";
  if (timeOfDay === "night") return "goodnight_selfie";

  if (timeOfDay === "evening" && stageAtLeast(stage, "intimate") && Math.random() < 0.35) {
    return "after_shower_selfie";
  }

  return "random_cute_selfie";
}

function pickRandomCaption(options: string[]): string {
  return options[Math.floor(Math.random() * options.length)];
}

export function getProactivePhotoCaption(type: ProactivePhotoType, name: string): string {
  switch (type) {
    case "good_morning_selfie":
      return pickRandomCaption([
        "morning face check ☀️",
        "woke up thinking about u lol",
        "literally just opened my eyes... hi",
        "too comfy to move rn 😴",
        "good morninggg",
      ]);
    case "thinking_of_you_selfie":
      return pickRandomCaption([
        "bored... pay attention to me",
        "fit check? or just wanted an excuse to text u",
        "thinking about u rn",
        "wish u were here to distract me",
        "random selfie drop bc i look cute",
      ]);
    case "goodnight_selfie":
      return pickRandomCaption([
        "last thing u see before u sleep 🌙",
        "gn babe 💋",
        "sleepy... come tuck me in?",
        "sweet dreams or whatever",
        "bedtime fit check",
      ]);
    case "miss_you_selfie":
      return pickRandomCaption([
        "u forgot about me today 🥺",
        "hello??? i miss u",
        "sending this to get ur attention",
        "where are u rn...",
        "im bored talk to meee",
      ]);
    case "after_shower_selfie":
      return pickRandomCaption([
        "fresh and clean 🚿",
        "just got out... u like?",
        "hair is wet and i'm cold lol",
        "towel vibes 🧖‍♀️",
        "clean girl aesthetic or whatever",
      ]);
    case "random_cute_selfie":
    default:
      return pickRandomCaption([
        "felt cute might delete",
        "hi",
        "look at me",
        "bored lol",
        "just bc",
      ]);
  }
}

export async function shouldSendProactivePhoto(
  telegramId: number,
  stage: RelationshipStage,
  lastPhotoSentAt?: number
): Promise<{ shouldSend: boolean; photoType?: ProactivePhotoType }> {
  const balance = await convex.getBalance(telegramId);
  if (balance < SELFIE_COST) {
    return { shouldSend: false };
  }

  const now = Date.now();
  const hour = getUtcHour();
  const timeOfDay = getTimeOfDay(hour);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const recentMessages = await convex.getRecentMessages(telegramId, 80);
  const proactivePhotos = recentMessages.filter(
    (message: any) =>
      message.role === "assistant" &&
      typeof message.imageUrl === "string" &&
      message.imageUrl.length > 0
  );

  const photosToday = proactivePhotos.filter(
    (message: any) =>
      typeof message.createdAt === "number" &&
      message.createdAt >= todayStart.getTime()
  ).length;

  const stageLimit = STAGE_DAILY_LIMIT[stage] || STAGE_DAILY_LIMIT.new;
  if (photosToday >= stageLimit) {
    return { shouldSend: false };
  }

  const latestPhotoAt = proactivePhotos
    .map((message: any) => (typeof message.createdAt === "number" ? message.createdAt : 0))
    .reduce((max: number, createdAt: number) => Math.max(max, createdAt), 0);

  const effectiveLastPhotoAt = lastPhotoSentAt || latestPhotoAt;
  if (effectiveLastPhotoAt > 0 && now - effectiveLastPhotoAt < THREE_HOURS_MS) {
    return { shouldSend: false };
  }

  const latestUserMessageAt = recentMessages
    .filter((message: any) => message.role === "user")
    .map((message: any) => (typeof message.createdAt === "number" ? message.createdAt : 0))
    .reduce((max: number, createdAt: number) => Math.max(max, createdAt), 0);

  if (latestUserMessageAt > 0 && now - latestUserMessageAt >= FOUR_HOURS_MS) {
    return { shouldSend: true, photoType: "miss_you_selfie" };
  }

  if (hour >= 6 && hour <= 9) {
    return { shouldSend: true, photoType: "good_morning_selfie" };
  }

  if (hour >= 12 && hour <= 15) {
    return { shouldSend: true, photoType: "thinking_of_you_selfie" };
  }

  if (hour >= 21 && hour <= 23) {
    return { shouldSend: true, photoType: "goodnight_selfie" };
  }

  if (hour >= 18 && hour <= 21 && stageAtLeast(stage, "intimate") && Math.random() < 0.35) {
    return { shouldSend: true, photoType: "after_shower_selfie" };
  }

  if (Math.random() < STAGE_WEIGHT[stage]) {
    return {
      shouldSend: true,
      photoType: getProactivePhotoType(stage, timeOfDay),
    };
  }

  return { shouldSend: false };
}
