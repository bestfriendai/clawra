import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DAY_MS = 24 * 60 * 60 * 1000;

const LEVELS = [
  { level: 0, name: "Strangers", xp: 0 },
  { level: 1, name: "Crush", xp: 100 },
  { level: 2, name: "Dating", xp: 500 },
  { level: 3, name: "Exclusive", xp: 2000 },
  { level: 4, name: "Partner", xp: 5000 },
  { level: 5, name: "Soulmate", xp: 15000 },
  { level: 6, name: "Married", xp: 50000 },
] as const;

function getUtcDayStart(timestamp: number): number {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

function getLevelForXP(totalXP: number): { level: number; name: string } {
  let current: (typeof LEVELS)[number] = LEVELS[0];
  for (const candidate of LEVELS) {
    if (totalXP >= candidate.xp) {
      current = candidate;
    }
  }
  return { level: current.level, name: current.name };
}

export const getRelationshipXP = query({
  args: { telegramId: v.number() },
  handler: async (ctx, { telegramId }) => {
    return await ctx.db
      .query("relationshipXP")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .first();
  },
});

export const awardXP = mutation({
  args: {
    telegramId: v.number(),
    amount: v.number(),
    action: v.string(),
  },
  handler: async (ctx, { telegramId, amount }) => {
    const now = Date.now();
    const clampedAmount = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;

    const existing = await ctx.db
      .query("relationshipXP")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .first();

    if (!existing) {
      const totalXP = clampedAmount;
      const levelInfo = getLevelForXP(totalXP);
      await ctx.db.insert("relationshipXP", {
        telegramId,
        totalXP,
        level: levelInfo.level,
        levelName: levelInfo.name,
        lastXPGain: now,
        streakDays: 1,
      });
      return {
        leveledUp: levelInfo.level > 0,
        newLevel: levelInfo.level > 0 ? levelInfo.level : undefined,
        levelName: levelInfo.level > 0 ? levelInfo.name : undefined,
      };
    }

    const updatedTotalXP = existing.totalXP + clampedAmount;
    const previousLevel = existing.level;
    const levelInfo = getLevelForXP(updatedTotalXP);

    await ctx.db.patch(existing._id, {
      totalXP: updatedTotalXP,
      level: levelInfo.level,
      levelName: levelInfo.name,
      lastXPGain: now,
    });

    const leveledUp = levelInfo.level > previousLevel;
    return {
      leveledUp,
      newLevel: leveledUp ? levelInfo.level : undefined,
      levelName: leveledUp ? levelInfo.name : undefined,
    };
  },
});

export const updateStreak = mutation({
  args: {
    telegramId: v.number(),
  },
  handler: async (ctx, { telegramId }) => {
    const now = Date.now();
    const todayStart = getUtcDayStart(now);

    const existing = await ctx.db
      .query("relationshipXP")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .first();

    if (!existing) {
      await ctx.db.insert("relationshipXP", {
        telegramId,
        totalXP: 0,
        level: 0,
        levelName: "Strangers",
        lastXPGain: now,
        streakDays: 1,
      });
      return { streakDays: 1 };
    }

    const lastDayStart = getUtcDayStart(existing.lastXPGain);
    let streakDays = existing.streakDays;

    if (todayStart === lastDayStart) {
      return { streakDays };
    }

    if (todayStart - lastDayStart === DAY_MS) {
      streakDays += 1;
    } else {
      streakDays = 1;
    }

    await ctx.db.patch(existing._id, {
      streakDays,
      lastXPGain: now,
    });

    return { streakDays };
  },
});
