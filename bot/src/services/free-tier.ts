import { FREE_TIER } from "../config/pricing.js";

interface FreeTierUsage {
  messages: number;
  selfies: number;
  voiceNotes: number;
  date: string;
}

const usageTracker = new Map<number, FreeTierUsage>();

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function getOrCreateUsage(telegramId: number): FreeTierUsage {
  const today = getTodayDate();
  let usage = usageTracker.get(telegramId);
  if (!usage || usage.date !== today) {
    usage = { messages: 0, selfies: 0, voiceNotes: 0, date: today };
    usageTracker.set(telegramId, usage);
  }
  return usage;
}

export function getFreeTierUsage(telegramId: number): FreeTierUsage {
  return getOrCreateUsage(telegramId);
}

export function recordFreeTierUsage(
  telegramId: number,
  type: "message" | "selfie" | "voiceNote"
): void {
  const usage = getOrCreateUsage(telegramId);
  if (type === "message") {
    usage.messages += 1;
  } else if (type === "selfie") {
    usage.selfies += 1;
  } else if (type === "voiceNote") {
    usage.voiceNotes += 1;
  }
}

export function hasFreeTierRemaining(
  telegramId: number,
  type: "message" | "selfie" | "voiceNote"
): boolean {
  const usage = getOrCreateUsage(telegramId);
  if (type === "message") {
    return usage.messages < FREE_TIER.dailyMessages;
  }
  if (type === "selfie") {
    return usage.selfies < FREE_TIER.dailySelfies;
  }
  if (type === "voiceNote") {
    return usage.voiceNotes < FREE_TIER.dailyVoiceNotes;
  }
  return false;
}
