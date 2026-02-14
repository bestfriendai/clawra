import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_CATEGORY = "personal_info";
const DEFAULT_CONFIDENCE = 0.7;

export const getByTelegramId = query({
  args: { telegramId: v.number() },
  handler: async (ctx, { telegramId }) => {
    return await ctx.db
      .query("memoryFacts")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .collect();
  },
});

export const addFacts = mutation({
  args: {
    telegramId: v.number(),
    facts: v.array(v.string()),
  },
  handler: async (ctx, { telegramId, facts }) => {
    // Get existing facts to avoid duplicates
    const existing = await ctx.db
      .query("memoryFacts")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .collect();
    const existingSet = new Set(existing.map((f) => f.fact.toLowerCase()));

    const now = Date.now();
    for (const fact of facts) {
      if (!existingSet.has(fact.toLowerCase())) {
        await ctx.db.insert("memoryFacts", {
          telegramId,
          fact,
          category: DEFAULT_CATEGORY,
          confidence: DEFAULT_CONFIDENCE,
          extractedAt: now,
          createdAt: now,
        });
      }
    }
  },
});

export const addCategorizedFact = mutation({
  args: {
    telegramId: v.number(),
    category: v.string(),
    fact: v.string(),
    confidence: v.number(),
  },
  handler: async (ctx, { telegramId, category, fact, confidence }) => {
    const existing = await ctx.db
      .query("memoryFacts")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .collect();

    const normalizedCategory = category.trim().toLowerCase();
    const normalizedFact = fact.trim().toLowerCase();
    const duplicate = existing.find(
      (item) =>
        (item.category || DEFAULT_CATEGORY).trim().toLowerCase() === normalizedCategory
        && item.fact.trim().toLowerCase() === normalizedFact
    );

    if (duplicate) return;

    const now = Date.now();
    await ctx.db.insert("memoryFacts", {
      telegramId,
      category: normalizedCategory,
      fact: fact.trim(),
      confidence: Math.max(0, Math.min(1, confidence)),
      extractedAt: now,
      createdAt: now,
    });
  },
});

export const getFactsByCategory = query({
  args: {
    telegramId: v.number(),
    category: v.string(),
  },
  handler: async (ctx, { telegramId, category }) => {
    const facts = await ctx.db
      .query("memoryFacts")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .collect();

    const normalizedCategory = category.trim().toLowerCase();
    return facts
      .filter((item) => (item.category || DEFAULT_CATEGORY).trim().toLowerCase() === normalizedCategory)
      .sort((a, b) => (b.extractedAt || b.createdAt) - (a.extractedAt || a.createdAt));
  },
});

export const getRecentFacts = query({
  args: {
    telegramId: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { telegramId, limit }) => {
    const facts = await ctx.db
      .query("memoryFacts")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .collect();

    const cappedLimit = Math.max(1, Math.min(limit ?? 50, 50));
    return facts
      .sort((a, b) => (b.extractedAt || b.createdAt) - (a.extractedAt || a.createdAt))
      .slice(0, cappedLimit);
  },
});

export const clearForUser = mutation({
  args: { telegramId: v.number() },
  handler: async (ctx, { telegramId }) => {
    const facts = await ctx.db
      .query("memoryFacts")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .collect();
    for (const fact of facts) {
      await ctx.db.delete(fact._id);
    }
  },
});
