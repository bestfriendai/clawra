import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function autoDetectCategory(prompt?: string, isNsfw?: boolean): string {
  if (isNsfw) return "nsfw";
  if (!prompt) return "general";

  const normalized = prompt.toLowerCase();
  if (normalized.includes("selfie")) return "selfie";
  if (
    normalized.includes("video") ||
    normalized.includes("clip") ||
    normalized.includes("frame")
  ) {
    return "video";
  }
  if (normalized.includes("outfit") || normalized.includes("fashion")) {
    return "outfit";
  }
  if (normalized.includes("portrait")) return "portrait";

  return "general";
}

function sortByCreatedAtDesc<T extends { createdAt: number }>(items: T[]): T[] {
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

function applyFilter<T extends { category: string; isNsfw: boolean }>(
  items: T[],
  category?: string
): T[] {
  if (!category || category === "all") return items;
  if (category === "nsfw") return items.filter((item) => item.isNsfw);
  if (category === "sfw") return items.filter((item) => !item.isNsfw);
  return items.filter((item) => item.category === category);
}

export const saveImage = mutation({
  args: {
    telegramId: v.float64(),
    imageUrl: v.string(),
    prompt: v.optional(v.string()),
    category: v.optional(v.string()),
    isNsfw: v.optional(v.boolean()),
  },
  handler: async (ctx, { telegramId, imageUrl, prompt, category, isNsfw }) => {
    const normalizedNsfw = Boolean(isNsfw);
    const normalizedCategory = category || autoDetectCategory(prompt, normalizedNsfw);

    return await ctx.db.insert("savedImages", {
      telegramId,
      imageUrl,
      prompt,
      category: normalizedCategory,
      isFavorite: false,
      isNsfw: normalizedNsfw,
      createdAt: Date.now(),
    });
  },
});

export const getUserImages = query({
  args: {
    telegramId: v.float64(),
    limit: v.optional(v.float64()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { telegramId, limit, category }) => {
    const safeLimit = Math.max(1, Math.min(Math.floor(limit ?? 20), 100));

    const allByUser = await ctx.db
      .query("savedImages")
      .withIndex("by_user", (q) => q.eq("telegramId", telegramId))
      .order("desc")
      .take(200);

    const filtered = applyFilter(allByUser, category);
    return filtered.slice(0, safeLimit);
  },
});

export const getUserFavorites = query({
  args: { telegramId: v.float64() },
  handler: async (ctx, { telegramId }) => {
    const favorites = await ctx.db
      .query("savedImages")
      .withIndex("by_user_favorites", (q) =>
        q.eq("telegramId", telegramId).eq("isFavorite", true)
      )
      .collect();

    return sortByCreatedAtDesc(favorites);
  },
});

export const toggleFavorite = mutation({
  args: { imageId: v.id("savedImages") },
  handler: async (ctx, { imageId }) => {
    const image = await ctx.db.get(imageId);
    if (!image) {
      return { ok: false as const };
    }

    const nextIsFavorite = !image.isFavorite;
    await ctx.db.patch(imageId, { isFavorite: nextIsFavorite });

    return { ok: true as const, isFavorite: nextIsFavorite };
  },
});

export const getImageCount = query({
  args: {
    telegramId: v.float64(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { telegramId, category }) => {
    if (category === "favorites") {
      const favorites = await ctx.db
        .query("savedImages")
        .withIndex("by_user_favorites", (q) =>
          q.eq("telegramId", telegramId).eq("isFavorite", true)
        )
        .collect();
      return favorites.length;
    }

    const allByUser = await ctx.db
      .query("savedImages")
      .withIndex("by_user", (q) => q.eq("telegramId", telegramId))
      .collect();

    return applyFilter(allByUser, category).length;
  },
});

export const getCategories = query({
  args: { telegramId: v.float64() },
  handler: async (ctx, { telegramId }) => {
    const allByUser = await ctx.db
      .query("savedImages")
      .withIndex("by_user", (q) => q.eq("telegramId", telegramId))
      .collect();

    const counts = new Map<string, number>();
    for (const image of allByUser) {
      counts.set(image.category, (counts.get(image.category) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  },
});
