import type { BotContext } from "../../types/context.js";
import { convex } from "../../services/convex.js";

export async function handleBadges(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from!.id;
  const badges = await convex.getUserBadges(telegramId);

  if (badges.length === 0) {
    await ctx.reply("you don't have badges yet. keep chatting and completing goals to earn them ✨");
    return;
  }

  const lines = badges.map(
    (badge, index) => `${index + 1}. ${badge.badgeEmoji} ${badge.badgeName}`
  );

  await ctx.reply(`🏅 Your Badges\n\n${lines.join("\n")}`);
}
