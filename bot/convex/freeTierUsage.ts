import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertFreeTierUsage = mutation({
  args: {
    telegramId: v.number(),
    date: v.string(),
    type: v.union(v.literal("message"), v.literal("selfie"), v.literal("voiceNote")),
  },
  handler: async (ctx, { telegramId, date, type }) => {
    const existing = await ctx.db
      .query("freeTierUsage")
      .withIndex("by_telegramId_date", (q) =>
        q.eq("telegramId", telegramId).eq("date", date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        messages: existing.messages + (type === "message" ? 1 : 0),
        selfies: existing.selfies + (type === "selfie" ? 1 : 0),
        voiceNotes: existing.voiceNotes + (type === "voiceNote" ? 1 : 0),
      });

      return {
        telegramId,
        date,
        messages: existing.messages + (type === "message" ? 1 : 0),
        selfies: existing.selfies + (type === "selfie" ? 1 : 0),
        voiceNotes: existing.voiceNotes + (type === "voiceNote" ? 1 : 0),
      };
    }

    const usage = {
      telegramId,
      date,
      messages: type === "message" ? 1 : 0,
      selfies: type === "selfie" ? 1 : 0,
      voiceNotes: type === "voiceNote" ? 1 : 0,
    };

    await ctx.db.insert("freeTierUsage", usage);
    return usage;
  },
});

export const getFreeTierUsage = query({
  args: {
    telegramId: v.number(),
    date: v.string(),
  },
  handler: async (ctx, { telegramId, date }) => {
    const usage = await ctx.db
      .query("freeTierUsage")
      .withIndex("by_telegramId_date", (q) =>
        q.eq("telegramId", telegramId).eq("date", date)
      )
      .first();

    if (!usage) {
      return null;
    }

    return {
      telegramId: usage.telegramId,
      date: usage.date,
      messages: usage.messages,
      selfies: usage.selfies,
      voiceNotes: usage.voiceNotes,
    };
  },
});
