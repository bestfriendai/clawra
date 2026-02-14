import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function ensureProfileDefaults(
  ctx: any,
  profile: any,
  fallbackSlotIndex: number = 0
) {
  if (!profile) return profile;

  const isActive = profile.isActive ?? true;
  const slotIndex = profile.slotIndex ?? fallbackSlotIndex;

  if (profile.isActive === undefined || profile.slotIndex === undefined) {
    await ctx.db.patch(profile._id, {
      isActive,
      slotIndex,
      updatedAt: Date.now(),
    });
  }

  return {
    ...profile,
    isActive,
    slotIndex,
  };
}

async function getActiveByTelegramId(ctx: any, telegramId: number) {
  const active = await ctx.db
    .query("girlfriendProfiles")
    .withIndex("by_user_active", (q: any) =>
      q.eq("telegramId", telegramId).eq("isActive", true)
    )
    .first();

  if (active) {
    return await ensureProfileDefaults(ctx, active, 0);
  }

  const fallback = await ctx.db
    .query("girlfriendProfiles")
    .withIndex("by_telegramId", (q: any) => q.eq("telegramId", telegramId))
    .first();

  if (!fallback) return null;

  return await ensureProfileDefaults(ctx, fallback, 0);
}

export const get = query({
  args: { telegramId: v.number() },
  handler: async (ctx, { telegramId }) => {
    return await getActiveByTelegramId(ctx, telegramId);
  },
});

export const getByTelegramId = internalQuery({
  args: { telegramId: v.number() },
  handler: async (ctx, { telegramId }) => {
    return await getActiveByTelegramId(ctx, telegramId);
  },
});

export const getActiveProfile = internalQuery({
  args: { telegramId: v.number() },
  handler: async (ctx, { telegramId }) => {
    return await getActiveByTelegramId(ctx, telegramId);
  },
});

export const getAllProfiles = internalQuery({
  args: { telegramId: v.number() },
  handler: async (ctx, { telegramId }) => {
    const profiles = await ctx.db
      .query("girlfriendProfiles")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .collect();

    const normalized = await Promise.all(
      profiles.map((profile, i) => ensureProfileDefaults(ctx, profile, i))
    );

    return normalized.sort((a, b) => a.slotIndex - b.slotIndex);
  },
});

export const getAll = query({
  args: { telegramId: v.number() },
  handler: async (ctx, { telegramId }) => {
    const profiles = await ctx.db
      .query("girlfriendProfiles")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .collect();

    const normalized = await Promise.all(
      profiles.map((profile, i) => ensureProfileDefaults(ctx, profile, i))
    );

    return normalized.sort((a, b) => a.slotIndex - b.slotIndex);
  },
});

export const getCount = query({
  args: { telegramId: v.number() },
  handler: async (ctx, { telegramId }) => {
    const profiles = await ctx.db
      .query("girlfriendProfiles")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .collect();
    return profiles.length;
  },
});

export const getProfileCount = internalQuery({
  args: { telegramId: v.number() },
  handler: async (ctx, { telegramId }) => {
    const profiles = await ctx.db
      .query("girlfriendProfiles")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .collect();
    return profiles.length;
  },
});

export const deactivateAll = internalMutation({
  args: { telegramId: v.number() },
  handler: async (ctx, { telegramId }) => {
    const profiles = await ctx.db
      .query("girlfriendProfiles")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .collect();

    const now = Date.now();
    await Promise.all(
      profiles.map(async (profile, i) => {
        const normalized = await ensureProfileDefaults(ctx, profile, i);
        await ctx.db.patch(profile._id, {
          isActive: false,
          slotIndex: normalized.slotIndex,
          updatedAt: now,
        });
      })
    );

    return { updated: profiles.length };
  },
});

export const switchProfile = internalMutation({
  args: {
    telegramId: v.number(),
    profileId: v.id("girlfriendProfiles"),
  },
  handler: async (ctx, { telegramId, profileId }) => {
    const target = await ctx.db.get(profileId);
    if (!target || target.telegramId !== telegramId) {
      throw new Error("Profile not found");
    }

    const profiles = await ctx.db
      .query("girlfriendProfiles")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .collect();

    const now = Date.now();
    await Promise.all(
      profiles.map(async (profile, i) => {
        const normalized = await ensureProfileDefaults(ctx, profile, i);
        await ctx.db.patch(profile._id, {
          isActive: profile._id === profileId,
          slotIndex: normalized.slotIndex,
          updatedAt: now,
        });
      })
    );

    return { success: true };
  },
});

export const switchActive = mutation({
  args: {
    telegramId: v.number(),
    profileId: v.id("girlfriendProfiles"),
  },
  handler: async (ctx, { telegramId, profileId }) => {
    const target = await ctx.db.get(profileId);
    if (!target || target.telegramId !== telegramId) {
      throw new Error("Profile not found");
    }

    const profiles = await ctx.db
      .query("girlfriendProfiles")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .collect();

    const now = Date.now();
    await Promise.all(
      profiles.map(async (profile, i) => {
        const normalized = await ensureProfileDefaults(ctx, profile, i);
        await ctx.db.patch(profile._id, {
          isActive: profile._id === profileId,
          slotIndex: normalized.slotIndex,
          updatedAt: now,
        });
      })
    );

    return { success: true };
  },
});

export const create = mutation({
  args: {
    telegramId: v.number(),
    name: v.string(),
    age: v.number(),
    race: v.string(),
    bodyType: v.string(),
    hairColor: v.string(),
    hairStyle: v.string(),
    personality: v.string(),
    backstory: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.age < 18) {
      throw new Error("Age must be 18 or older");
    }

    const existing = await ctx.db
      .query("girlfriendProfiles")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", args.telegramId))
      .collect();

    const normalized = await Promise.all(
      existing.map((profile, i) => ensureProfileDefaults(ctx, profile, i))
    );

    const nextSlotIndex = normalized.length
      ? Math.max(...normalized.map((profile) => profile.slotIndex)) + 1
      : 0;

    const now = Date.now();
    await Promise.all(
      existing.map((profile, i) =>
        ctx.db.patch(profile._id, {
          isActive: false,
          slotIndex: normalized[i].slotIndex,
          updatedAt: now,
        })
      )
    );

    return await ctx.db.insert("girlfriendProfiles", {
      ...args,
      isActive: true,
      slotIndex: nextSlotIndex,
      referenceImageUrl: undefined,
      isConfirmed: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    telegramId: v.number(),
    name: v.optional(v.string()),
    age: v.optional(v.number()),
    race: v.optional(v.string()),
    bodyType: v.optional(v.string()),
    hairColor: v.optional(v.string()),
    hairStyle: v.optional(v.string()),
    personality: v.optional(v.string()),
    backstory: v.optional(v.string()),
    referenceImageUrl: v.optional(v.string()),
    lastImageUrl: v.optional(v.string()),
    voiceId: v.optional(v.string()),
    isConfirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, { telegramId, ...updates }) => {
    const profile = await getActiveByTelegramId(ctx, telegramId);
    if (!profile) throw new Error("No profile found");

    const cleanUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) cleanUpdates[key] = value;
    }

    await ctx.db.patch(profile._id, { ...cleanUpdates, updatedAt: Date.now() });
  },
});

export const setConfirmed = mutation({
  args: {
    telegramId: v.number(),
    referenceImageUrl: v.string(),
  },
  handler: async (ctx, { telegramId, referenceImageUrl }) => {
    const profile = await getActiveByTelegramId(ctx, telegramId);
    if (!profile) throw new Error("No profile found");

    await ctx.db.patch(profile._id, {
      referenceImageUrl,
      isConfirmed: true,
      updatedAt: Date.now(),
    });
  },
});
