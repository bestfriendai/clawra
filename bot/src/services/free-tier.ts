import { FREE_TIER } from "../config/pricing.js";
import { LRUMap } from "../utils/lru-map.js";
import { convex } from "./convex.js";

interface FreeTierUsage {
  messages: number;
  selfies: number;
  voiceNotes: number;
  date: string;
}

const usageTracker = new LRUMap<number, FreeTierUsage>(5000);

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function createEmptyUsage(date: string): FreeTierUsage {
  return { messages: 0, selfies: 0, voiceNotes: 0, date };
}

function getCachedUsage(telegramId: number, date: string): FreeTierUsage | null {
  let usage = usageTracker.get(telegramId);
  if (!usage || usage.date !== date) {
    return null;
  }

  return usage;
}

function setCachedUsage(telegramId: number, usage: FreeTierUsage): FreeTierUsage {
  usageTracker.set(telegramId, usage);
  return usage;
}

function incrementUsage(
  usage: FreeTierUsage,
  type: "message" | "selfie" | "voiceNote"
): void {
  if (type === "message") {
    usage.messages += 1;
  } else if (type === "selfie") {
    usage.selfies += 1;
  } else {
    usage.voiceNotes += 1;
  }
}

export async function getFreeTierUsage(telegramId: number): Promise<FreeTierUsage> {
  const today = getTodayDate();
  const cached = getCachedUsage(telegramId, today);
  if (cached) {
    return cached;
  }

  try {
    const persisted = await convex.getFreeTierUsage(telegramId, today);
    if (persisted) {
      return setCachedUsage(telegramId, {
        messages: persisted.messages,
        selfies: persisted.selfies,
        voiceNotes: persisted.voiceNotes,
        date: persisted.date,
      });
    }
  } catch {
  }

  return setCachedUsage(telegramId, createEmptyUsage(today));
}

export function recordFreeTierUsage(
  telegramId: number,
  type: "message" | "selfie" | "voiceNote"
): void {
  const today = getTodayDate();
  const usage =
    getCachedUsage(telegramId, today) ??
    setCachedUsage(telegramId, createEmptyUsage(today));

  incrementUsage(usage, type);

  void convex.upsertFreeTierUsage(telegramId, today, type).catch(() => undefined);
}

export async function hasFreeTierRemaining(
  telegramId: number,
  type: "message" | "selfie" | "voiceNote"
): Promise<boolean> {
  const usage = await getFreeTierUsage(telegramId);
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
