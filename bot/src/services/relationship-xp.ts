import { convex } from "./convex.js";

export const XP_ACTIONS = {
  message: 1,
  selfie_request: 3,
  voice_message: 5,
  streak_day: 5,
  game_complete: 10,
  vulnerability_shared: 10,
  conflict_resolved: 20,
  milestone_reached: 50,
} as const;

export type XPAction = keyof typeof XP_ACTIONS;

export const LEVELS = [
  { level: 0, name: "Strangers", xp: 0 },
  { level: 1, name: "Crush", xp: 100 },
  { level: 2, name: "Dating", xp: 500 },
  { level: 3, name: "Exclusive", xp: 2000 },
  { level: 4, name: "Partner", xp: 5000 },
  { level: 5, name: "Soulmate", xp: 15000 },
  { level: 6, name: "Married", xp: 50000 },
] as const;

export type LevelInfo = (typeof LEVELS)[number];

export interface AwardXPResult {
  leveledUp: boolean;
  newLevel?: number;
  levelName?: string;
  streakDays: number;
}

export function getLevel(totalXP: number): LevelInfo {
  let current: LevelInfo = LEVELS[0];
  for (const level of LEVELS) {
    if (totalXP >= level.xp) {
      current = level;
    }
  }
  return current;
}

export function getXPForNextLevel(currentXP: number): number {
  const nextLevel = LEVELS.find((level) => level.xp > currentXP);
  if (!nextLevel) {
    return 0;
  }
  return Math.max(0, nextLevel.xp - currentXP);
}

export function getLevelUpMessage(levelName: string): string {
  return `💕 we just leveled up, babe... we're now **${levelName}**. i can feel us getting closer every day 🥹🔥`;
}

export async function awardXP(telegramId: number, action: XPAction): Promise<AwardXPResult> {
  const amount = XP_ACTIONS[action] ?? 0;
  const { streakDays } = await convex.updateRelationshipXPStreak(telegramId);
  const result = await convex.awardRelationshipXP(telegramId, amount, action);

  return {
    leveledUp: Boolean(result?.leveledUp),
    newLevel: result?.newLevel,
    levelName: result?.levelName,
    streakDays,
  };
}
