import { convex } from "./convex.js";
import { LRUMap } from "../utils/lru-map.js";

const DEFAULT_QUIET_START = 23;
const DEFAULT_QUIET_END = 7;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const TWO_HOURS_RESPONSE_MS = 2 * 60 * 60 * 1000;

export type SmartMessageType =
  | "morning"
  | "goodnight"
  | "thinking_of_you"
  | "proactive_photo";

export const TIMEZONE_ABBREVIATIONS: Record<string, number> = {
  EST: -5,
  CST: -6,
  MST: -7,
  PST: -8,
  GMT: 0,
  CET: 1,
  IST: 5.5,
  JST: 9,
  AEST: 10,
  NZST: 12,
};

interface ChatMessage {
  role: string;
  content: string;
  createdAt: number;
}

interface ProactiveEvent {
  sentAt: number;
  messageType: SmartMessageType;
  respondedAt?: number;
}

const proactiveHistory = new LRUMap<number, ProactiveEvent[]>(5000);

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record.role === "string" &&
    typeof record.content === "string" &&
    typeof record.createdAt === "number"
  );
}

async function getRecentChatMessages(
  telegramId: number,
  limit: number
): Promise<ChatMessage[]> {
  const messages = await convex.getRecentMessages(telegramId, limit);
  if (!Array.isArray(messages)) return [];
  return messages.filter(isChatMessage);
}

function normalizeOffset(offset: number): number {
  return Math.min(14, Math.max(-12, offset));
}

function clampHour(hour: number): number {
  const normalized = hour % 24;
  return normalized < 0 ? normalized + 24 : normalized;
}

export function formatUtcOffset(offsetHours: number): string {
  const normalized = normalizeOffset(offsetHours);
  if (Number.isInteger(normalized)) {
    const sign = normalized >= 0 ? "+" : "";
    return `UTC${sign}${normalized}`;
  }

  const sign = normalized >= 0 ? "+" : "";
  return `UTC${sign}${normalized.toFixed(1)}`;
}

export function parseTimezoneOffset(timezone?: string): number {
  if (!timezone) return 0;

  const upper = timezone.trim().toUpperCase();
  if (upper in TIMEZONE_ABBREVIATIONS) {
    return TIMEZONE_ABBREVIATIONS[upper] ?? 0;
  }

  const utcMatch = upper.match(/^UTC([+-]\d{1,2}(?:\.5)?)$/);
  if (utcMatch?.[1]) {
    return normalizeOffset(Number(utcMatch[1]));
  }

  const numericMatch = upper.match(/^([+-]?\d{1,2}(?:\.5)?)$/);
  if (numericMatch?.[1]) {
    return normalizeOffset(Number(numericMatch[1]));
  }

  return 0;
}

function getLocalHourFromOffset(offsetHours: number, timestamp = Date.now()): number {
  const adjustedTime = timestamp + offsetHours * 60 * 60 * 1000;
  return new Date(adjustedTime).getUTCHours();
}

export async function getUserLocalHour(telegramId: number): Promise<number> {
  const preferences = await convex.getUserPreferences(telegramId);
  const offset = parseTimezoneOffset(preferences.timezone);
  return getLocalHourFromOffset(offset);
}

function isHourInQuietWindow(
  hour: number,
  quietHoursStart = DEFAULT_QUIET_START,
  quietHoursEnd = DEFAULT_QUIET_END
): boolean {
  if (quietHoursStart === quietHoursEnd) return false;
  if (quietHoursStart < quietHoursEnd) {
    return hour >= quietHoursStart && hour < quietHoursEnd;
  }
  return hour >= quietHoursStart || hour < quietHoursEnd;
}

export async function isQuietHours(telegramId: number): Promise<boolean> {
  const preferences = await convex.getUserPreferences(telegramId);
  const localHour = await getUserLocalHour(telegramId);
  const start =
    typeof preferences.quietHoursStart === "number"
      ? clampHour(preferences.quietHoursStart)
      : DEFAULT_QUIET_START;
  const end =
    typeof preferences.quietHoursEnd === "number"
      ? clampHour(preferences.quietHoursEnd)
      : DEFAULT_QUIET_END;

  return isHourInQuietWindow(localHour, start, end);
}

function getDefaultLocalHour(messageType: SmartMessageType): number {
  switch (messageType) {
    case "morning":
      return 9;
    case "goodnight":
      return 22;
    case "thinking_of_you":
      return 15;
    case "proactive_photo":
      return 16;
    default:
      return 14;
  }
}

function candidateOffsets(): number[] {
  const offsets: number[] = [];
  for (let offset = -12; offset <= 14; offset += 0.5) {
    offsets.push(offset);
  }
  return offsets;
}

export async function detectTimezone(
  telegramId: number,
  messageTimestamps: number[]
): Promise<string> {
  const recent = messageTimestamps.slice(-20);
  if (recent.length === 0) {
    const fallback = "UTC+0";
    await convex.updateUserPreferences(telegramId, { timezone: fallback });
    return fallback;
  }

  let bestOffset = 0;
  let bestScore = -1;

  for (const offset of candidateOffsets()) {
    const score = recent.reduce((acc, ts) => {
      const localHour = getLocalHourFromOffset(offset, ts);
      if (localHour >= 10 && localHour <= 22) {
        return acc + 1;
      }
      return acc;
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }

  const timezone = formatUtcOffset(bestOffset);
  await convex.updateUserPreferences(telegramId, { timezone });
  return timezone;
}

export async function getBestSendTime(
  telegramId: number,
  messageType: SmartMessageType
): Promise<number> {
  const preferences = await convex.getUserPreferences(telegramId);
  const offset = parseTimezoneOffset(preferences.timezone);
  const messages = await getRecentChatMessages(telegramId, 120);

  const userLocalHourCounts = new LRUMap<number, number>(5000);
  for (const message of messages) {
    if (message.role !== "user") continue;
    const localHour = getLocalHourFromOffset(offset, message.createdAt);
    if (localHour < 8 || localHour > 23) continue;
    userLocalHourCounts.set(localHour, (userLocalHourCounts.get(localHour) ?? 0) + 1);
  }

  const preferredLocalHour = getDefaultLocalHour(messageType);
  let bestLocalHour = preferredLocalHour;
  let bestCount = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [hour, count] of userLocalHourCounts.entries()) {
    const distance = Math.abs(hour - preferredLocalHour);
    if (count > bestCount || (count === bestCount && distance < bestDistance)) {
      bestCount = count;
      bestLocalHour = hour;
      bestDistance = distance;
    }
  }

  const quietStart =
    typeof preferences.quietHoursStart === "number"
      ? clampHour(preferences.quietHoursStart)
      : DEFAULT_QUIET_START;
  const quietEnd =
    typeof preferences.quietHoursEnd === "number"
      ? clampHour(preferences.quietHoursEnd)
      : DEFAULT_QUIET_END;

  let adjustedLocalHour = bestLocalHour;
  while (isHourInQuietWindow(adjustedLocalHour, quietStart, quietEnd)) {
    adjustedLocalHour = clampHour(adjustedLocalHour + 1);
  }

  return clampHour(adjustedLocalHour - offset);
}

function getHistoryForUser(telegramId: number): ProactiveEvent[] {
  return proactiveHistory.get(telegramId) ?? [];
}

function setHistoryForUser(telegramId: number, history: ProactiveEvent[]): void {
  proactiveHistory.set(telegramId, history.slice(-20));
}

export function recordProactiveSent(
  telegramId: number,
  messageType: SmartMessageType,
  sentAt = Date.now()
): void {
  const history = getHistoryForUser(telegramId);
  history.push({ sentAt, messageType });
  setHistoryForUser(telegramId, history);
}

async function syncResponseData(telegramId: number): Promise<ProactiveEvent[]> {
  const history = [...getHistoryForUser(telegramId)];
  if (history.length === 0) return history;

  const messages = await getRecentChatMessages(telegramId, 150);
  const userMessages = messages.filter((message) => message.role === "user");

  for (const event of history) {
    if (event.respondedAt) continue;
    const response = userMessages.find((message) => message.createdAt > event.sentAt);
    if (response) {
      event.respondedAt = response.createdAt;
    }
  }

  setHistoryForUser(telegramId, history);
  return history;
}

export async function shouldThrottle(
  telegramId: number,
  lastSentAt: number | undefined,
  messageType: SmartMessageType
): Promise<boolean> {
  const now = Date.now();

  if (typeof lastSentAt === "number" && now - lastSentAt < TWO_HOURS_MS) {
    return true;
  }

  const history = await syncResponseData(telegramId);
  const relevant = history.filter((item) => item.messageType === messageType || item.messageType === "proactive_photo");
  const latest = relevant[relevant.length - 1];
  const lastTwo = relevant.slice(-2);

  if (lastTwo.length === 2 && lastTwo.every((item) => item.respondedAt === undefined)) {
    return true;
  }

  if (latest?.respondedAt) {
    const responseDelay = latest.respondedAt - latest.sentAt;
    if (responseDelay <= FIVE_MINUTES_MS) {
      return false;
    }
    if (
      responseDelay >= TWO_HOURS_RESPONSE_MS &&
      typeof lastSentAt === "number" &&
      now - lastSentAt < SIX_HOURS_MS
    ) {
      return true;
    }
  }

  if (typeof lastSentAt === "number" && now - lastSentAt < FOUR_HOURS_MS) {
    return true;
  }

  return false;
}

export async function getEngagementScore(telegramId: number): Promise<number> {
  const history = await syncResponseData(telegramId);
  const messages = await getRecentChatMessages(telegramId, 150);
  const userMessages = messages.filter((message) => message.role === "user");

  const proactiveCount = history.length;
  const responded = history.filter((item) => typeof item.respondedAt === "number");
  const responseRate = proactiveCount > 0 ? responded.length / proactiveCount : 0;

  const avgResponseDelayMs =
    responded.length > 0
      ? responded.reduce((sum, item) => sum + (item.respondedAt! - item.sentAt), 0) /
        responded.length
      : 12 * 60 * 60 * 1000;
  const responseSpeedScore = Math.max(0, 1 - avgResponseDelayMs / (12 * 60 * 60 * 1000));

  const avgMessageLength =
    userMessages.length > 0
      ? userMessages.reduce((sum, msg) => sum + msg.content.trim().length, 0) /
        userMessages.length
      : 0;
  const messageLengthScore = Math.min(1, avgMessageLength / 200);

  const retentionState = await convex.getRetentionState(telegramId);
  const streak =
    retentionState && typeof retentionState.streak === "number"
      ? retentionState.streak
      : 0;
  const streakScore = Math.min(1, streak / 14);

  const score =
    responseRate * 40 +
    responseSpeedScore * 30 +
    messageLengthScore * 15 +
    streakScore * 15;

  return Math.max(0, Math.min(100, Math.round(score)));
}
