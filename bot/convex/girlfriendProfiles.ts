import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

type ProfileEnvironment = {
  homeDescription: string;
  bedroomDetails: string;
  favoriteLocations: string[];
  currentOutfit?: string;
  currentOutfitDay?: string;
};

function buildDefaultEnvironment(personality: string): ProfileEnvironment {
  const normalized = personality.toLowerCase();

  if (normalized.includes("shy") || normalized.includes("sweet")) {
    return {
      homeDescription: "quiet one-bedroom apartment with a plant corner and soft neutral decor",
      bedroomDetails: "fairy lights over a simple headboard, slightly messy cotton sheets, stack of books on the nightstand",
      favoriteLocations: ["cozy cafe by the window", "nearby park path", "local bookstore corner"],
    };
  }

  if (normalized.includes("bold") || normalized.includes("dominant")) {
    return {
      homeDescription: "modern loft with clean lines, big mirrors, and warm accent lighting",
      bedroomDetails: "dark velvet throw, sleek lamp glow, unmade bed with textured pillows",
      favoriteLocations: ["rooftop lounge", "upscale cocktail bar", "late-night city street"],
    };
  }

  if (normalized.includes("caring") || normalized.includes("nurturing")) {
    return {
      homeDescription: "warm apartment with layered blankets, framed photos, and a lived-in kitchen",
      bedroomDetails: "soft bedside lamp, cream duvet, folded hoodie at the foot of the bed",
      favoriteLocations: ["farmers market", "sunny neighborhood cafe", "quiet riverside walk"],
    };
  }

  if (normalized.includes("sarcastic") || normalized.includes("witty")) {
    return {
      homeDescription: "eclectic city apartment with records, posters, and mismatched cozy furniture",
      bedroomDetails: "string lights, dark bedding, laptop open on a cluttered side table",
      favoriteLocations: ["indie coffee shop", "art gallery district", "neon-lit late-night diner"],
    };
  }

  if (normalized.includes("bubbly") || normalized.includes("energetic")) {
    return {
      homeDescription: "bright apartment with colorful pillows, fresh flowers, and sunlight through big windows",
      bedroomDetails: "pastel throw blanket, mirror with sticky notes, playful clutter on shelves",
      favoriteLocations: ["trendy brunch spot", "boardwalk promenade", "busy downtown shopping street"],
    };
  }

  return {
    homeDescription: "small apartment with a plant corner and cozy lived-in details",
    bedroomDetails: "fairy lights, slightly messy sheets, soft bedside lamp and personal clutter",
    favoriteLocations: ["coffee shop", "city park", "balcony with skyline view"],
  };
}

async function ensureProfileDefaults(
  ctx: any,
  profile: any,
  fallbackSlotIndex: number = 0
) {
  if (!profile) return profile;

  const isActive = profile.isActive ?? true;
  const slotIndex = profile.slotIndex ?? fallbackSlotIndex;
  const environment = profile.environment ?? buildDefaultEnvironment(profile.personality || "");

  if (
    profile.isActive === undefined ||
    profile.slotIndex === undefined ||
    profile.environment === undefined
  ) {
    await ctx.db.patch(profile._id, {
      isActive,
      slotIndex,
      environment,
      updatedAt: Date.now(),
    });
  }

  return {
    ...profile,
    isActive,
    slotIndex,
    environment,
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
    eyeColor: v.optional(v.string()),
    personality: v.string(),
    backstory: v.optional(v.string()),
    environment: v.optional(v.object({
      homeDescription: v.string(),
      bedroomDetails: v.string(),
      favoriteLocations: v.array(v.string()),
      currentOutfit: v.optional(v.string()),
      currentOutfitDay: v.optional(v.string()),
    })),
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
      environment: args.environment ?? buildDefaultEnvironment(args.personality),
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
    eyeColor: v.optional(v.string()),
    personality: v.optional(v.string()),
    backstory: v.optional(v.string()),
    referenceImageUrl: v.optional(v.string()),
    lastImageUrl: v.optional(v.string()),
    voiceId: v.optional(v.string()),
    isConfirmed: v.optional(v.boolean()),
    environment: v.optional(v.object({
      homeDescription: v.string(),
      bedroomDetails: v.string(),
      favoriteLocations: v.array(v.string()),
      currentOutfit: v.optional(v.string()),
      currentOutfitDay: v.optional(v.string()),
    })),
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
