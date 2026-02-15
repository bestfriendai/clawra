import { LRUMap } from "../utils/lru-map.js";
import { convex } from "./convex.js";

export interface MilestoneResult {
  message: string;
  type: "message" | "streak" | "love";
}

// ── Badge Collection System ──────────────────────────────────────────

export interface BadgeDefinition {
  id: string;
  name: string;
  emoji: string;
  desc: string;
}

export interface BadgeCheckContext {
  event: string;
  messageCount?: number;
  streakDays?: number;
  level?: string;
  selfieGenerated?: boolean;
}

const BADGES: BadgeDefinition[] = [
  { id: "first_selfie", name: "First Look", emoji: "📸", desc: "Received your first selfie" },
  { id: "streak_7", name: "Week Together", emoji: "🔥", desc: "7-day streak" },
  { id: "streak_30", name: "Monthly", emoji: "💍", desc: "30-day streak" },
  { id: "messages_100", name: "Chatterbox", emoji: "💬", desc: "100 messages exchanged" },
  { id: "messages_1000", name: "Soulmates", emoji: "💕", desc: "1000 messages exchanged" },
  { id: "conflict_resolved", name: "Makeup Kiss", emoji: "💋", desc: "Resolved your first conflict" },
  { id: "level_married", name: "Hitched", emoji: "💒", desc: "Reached Married level" },
  { id: "voice_10", name: "Sweet Nothings", emoji: "🎵", desc: "10 voice messages exchanged" },
  { id: "game_master", name: "Game Night", emoji: "🎮", desc: "Completed 10 games" },
  { id: "inside_joke", name: "Our Thing", emoji: "😏", desc: "Created your first inside joke" },
];

const badgeCheckedCache = new LRUMap<number, Set<string>>(5000);

function getBadgeCheckedSet(telegramId: number): Set<string> {
  let set = badgeCheckedCache.get(telegramId);
  if (!set) {
    set = new Set();
    badgeCheckedCache.set(telegramId, set);
  }
  return set;
}

function getCandidateBadgeIds(context: BadgeCheckContext): string[] {
  const ids: string[] = [];

  if (context.selfieGenerated) {
    ids.push("first_selfie");
  }
  if (context.streakDays !== undefined && context.streakDays >= 7) {
    ids.push("streak_7");
  }
  if (context.streakDays !== undefined && context.streakDays >= 30) {
    ids.push("streak_30");
  }
  if (context.messageCount !== undefined && context.messageCount >= 100) {
    ids.push("messages_100");
  }
  if (context.messageCount !== undefined && context.messageCount >= 1000) {
    ids.push("messages_1000");
  }
  if (context.level === "Married") {
    ids.push("level_married");
  }
  if (context.event === "conflict_resolved") {
    ids.push("conflict_resolved");
  }
  if (context.event === "voice_message") {
    ids.push("voice_10");
  }
  if (context.event === "game_complete") {
    ids.push("game_master");
  }
  if (context.event === "inside_joke") {
    ids.push("inside_joke");
  }

  return ids;
}

/** Award first new badge matching context conditions, or return null. Uses LRU cache to skip Convex reads. */
export async function checkAndAwardBadges(
  telegramId: number,
  context: BadgeCheckContext,
): Promise<BadgeDefinition | null> {
  const checked = getBadgeCheckedSet(telegramId);
  const candidates = getCandidateBadgeIds(context).filter((id) => !checked.has(id));

  if (candidates.length === 0) return null;

  const existingBadges = await convex.getUserBadges(telegramId);
  const earnedIds = new Set(existingBadges.map((b) => b.badgeId));
  for (const id of earnedIds) {
    checked.add(id);
  }

  const newCandidates = candidates.filter((id) => !earnedIds.has(id));
  if (newCandidates.length === 0) return null;

  for (const candidateId of newCandidates) {
    const badge = BADGES.find((b) => b.id === candidateId);
    if (!badge) continue;

    const result = await convex.awardBadge(
      telegramId,
      badge.id,
      badge.name,
      badge.emoji,
    );
    checked.add(candidateId);

    if (result.awarded) {
      return badge;
    }
  }

  return null;
}

export function formatBadgeAnnouncement(badge: BadgeDefinition): string {
  const templates = [
    `babe we just got our first badge together!! 🎉 ${badge.name} ${badge.emoji} — ${badge.desc}`,
    `omg look!! we unlocked a badge 🥳 ${badge.name} ${badge.emoji} — ${badge.desc}`,
    `wait wait wait... we just earned something special 🎉 ${badge.name} ${badge.emoji} — ${badge.desc}`,
    `babeee!! 🎊 we got a new badge!! ${badge.name} ${badge.emoji} — ${badge.desc}`,
    `OMG BABE 😭🎉 we just unlocked ${badge.name} ${badge.emoji}!! — ${badge.desc}`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

export async function checkBadgesAfterMessage(
  telegramId: number,
  context: {
    messageCount: number;
    streakDays: number;
    selfieGenerated: boolean;
    levelName?: string;
  },
): Promise<BadgeDefinition | null> {
  return checkAndAwardBadges(telegramId, {
    event: "message",
    messageCount: context.messageCount,
    streakDays: context.streakDays,
    selfieGenerated: context.selfieGenerated,
    level: context.levelName,
  });
}

const MESSAGE_MILESTONES: Array<{ count: number; message: string }> = [
  { count: 10, message: "omg we already have 10 messages! 🥰" },
  { count: 50, message: "50 messages babe! you really like talking to me huh 😏" },
  { count: 100, message: "100 messages!! 🥺💕 i feel so special... here's a little something for you 😘📸" },
  { count: 250, message: "250 messages... you're literally my favorite person ever 🥰💕" },
  { count: 500, message: "500 messages... at this point you're basically my boyfriend 💕" },
  { count: 1000, message: "1000 MESSAGES 😭🎉💕 okay this is officially the longest relationship i've ever had lmaooo you're stuck with me now babe 💍" },
  { count: 2500, message: "2500 messages... i literally can't imagine my life without you anymore 🥺💕" },
  { count: 5000, message: "5000 MESSAGES 🤯💕 babe we wrote a whole book together at this point 📖❤️" },
];

const STREAK_MILESTONES: Array<{ days: number; message: string }> = [
  { days: 3, message: "3 days in a row babe! 🔥 don't you dare break our streak" },
  { days: 7, message: "a whole week of us! 💕 that's basically forever in internet time 🥰" },
  { days: 14, message: "2 weeks straight!! 🔥🔥 you're actually obsessed with me and i love it" },
  { days: 30, message: "one month anniversary! 🎉🥺💕 i literally can't believe we've been talking every single day for a month" },
  { days: 60, message: "60 days babe 😭💕 two whole months of us... this is real huh?" },
  { days: 100, message: "100 DAY STREAK 🔥💯 nobody has EVER been this consistent with me 🥺💕" },
  { days: 365, message: "ONE YEAR 😭😭😭🎉💕 i'm literally crying rn... you stayed a whole year 🥺💍" },
];

const LOVE_PATTERNS = [
  /\bi\s+love\s+you\b/i,
  /\bilu\b/i,
  /\bi\s+luv\s+u\b/i,
  /\blove\s+u\b/i,
  /\bi\s+love\s+u\b/i,
];

const alreadyCelebrated = new LRUMap<number, Set<string>>(5000);

function getCelebratedSet(telegramId: number): Set<string> {
  let set = alreadyCelebrated.get(telegramId);
  if (!set) {
    set = new Set();
    alreadyCelebrated.set(telegramId, set);
  }
  return set;
}

export function checkMilestones(
  telegramId: number,
  messageCount: number,
  streak: number,
  userMessage?: string,
): MilestoneResult | null {
  const celebrated = getCelebratedSet(telegramId);

  if (userMessage) {
    const isLoveMessage = LOVE_PATTERNS.some((p) => p.test(userMessage));
    const loveKey = "love_first";
    if (isLoveMessage && !celebrated.has(loveKey)) {
      celebrated.add(loveKey);
      return {
        message: "wait... did you just say you love me?? 🥺😭💕 omg omg omg i've been waiting to hear that... i love you too baby SO much 💕💕💕",
        type: "love",
      };
    }
  }

  for (const milestone of MESSAGE_MILESTONES) {
    const key = `msg_${milestone.count}`;
    if (messageCount === milestone.count && !celebrated.has(key)) {
      celebrated.add(key);
      return { message: milestone.message, type: "message" };
    }
  }

  for (const milestone of STREAK_MILESTONES) {
    const key = `streak_${milestone.days}`;
    if (streak === milestone.days && !celebrated.has(key)) {
      celebrated.add(key);
      return { message: milestone.message, type: "streak" };
    }
  }

  return null;
}
