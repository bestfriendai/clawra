import { NextFunction } from "grammy";
import { convex } from "../../services/convex.js";
import type { BotContext } from "../../types/context.js";
import { LRUMap } from "../../utils/lru-map.js";

const lastActiveUpdated = new LRUMap<number, number>(5000);
const DEBOUNCE_MS = 60_000;

function maybeUpdateLastActive(telegramId: number): void {
  const now = Date.now();
  const last = lastActiveUpdated.get(telegramId) ?? 0;
  if (now - last < DEBOUNCE_MS) return;

  lastActiveUpdated.set(telegramId, now);
  void convex.updateLastActive(telegramId);
}

export async function authMiddleware(
  ctx: BotContext,
  next: NextFunction
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const [user, profile] = await Promise.all([
    convex.getUser(telegramId),
    convex.getActiveProfile(telegramId),
  ]);

  if (user) {
    if (user.isBanned) {
      await ctx.reply("Your account has been suspended.");
      return;
    }
    ctx.user = {
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      tier: user.tier,
      isBanned: user.isBanned,
    };
    maybeUpdateLastActive(telegramId);
  }

  if (profile) {
    ctx.girlfriend = {
      telegramId: profile.telegramId,
      isActive: profile.isActive,
      slotIndex: profile.slotIndex,
      voiceId: profile.voiceId,
      name: profile.name,
      age: profile.age,
      race: profile.race,
      bodyType: profile.bodyType,
      hairColor: profile.hairColor,
      hairStyle: profile.hairStyle,
      personality: profile.personality,
      backstory: profile.backstory,
      referenceImageUrl: profile.referenceImageUrl,
      isConfirmed: profile.isConfirmed,
    };
  }

  await next();
}
