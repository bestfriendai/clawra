import { NextFunction } from "grammy";
import { convex } from "../../services/convex.js";
import type { BotContext } from "../../types/context.js";

export async function authMiddleware(
  ctx: BotContext,
  next: NextFunction
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await convex.getUser(telegramId);
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
    // Update last active in background
    convex.updateLastActive(telegramId).catch(() => {});
  }

  const profile = await convex.getActiveProfile(telegramId);
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
