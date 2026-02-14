import type { BotContext } from "../../types/context.js";
import { convex } from "../../services/convex.js";

function getBadgeEmojiSummary(
  badges: Array<{ badgeEmoji: string }>
): string {
  if (badges.length === 0) return "";
  const emojis = [...new Set(badges.map((badge) => badge.badgeEmoji))].join("");
  return emojis ? ` ${emojis}` : "";
}

export async function handleLeaderboard(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from!.id;
  const leaderboard = await convex.getLeaderboard();

  if (leaderboard.length === 0) {
    const myCount = await convex.getUserChallengeCount(telegramId);
    const myBadges = await convex.getUserBadges(telegramId);
    await ctx.reply(
      `🏆 Challenge Leaderboard\n\nNo challenge completions yet.\n\nYour rank: unranked — ${myCount} challenges${getBadgeEmojiSummary(myBadges)}`
    );
    return;
  }

  const leaderboardLines = await Promise.all(
    leaderboard.map(async (entry, index) => {
      const badges = await convex.getUserBadges(entry.telegramId);
      return `${index + 1}. ${entry.profileName} — ${entry.count} challenges${getBadgeEmojiSummary(badges)}`;
    })
  );

  const myIndex = leaderboard.findIndex((entry) => entry.telegramId === telegramId);
  const myCount = await convex.getUserChallengeCount(telegramId);
  const myBadges = await convex.getUserBadges(telegramId);
  const rankLabel = myIndex >= 0 ? `#${myIndex + 1}` : "outside top 10";

  await ctx.reply(
    `🏆 Challenge Leaderboard\n\n${leaderboardLines.join("\n")}\n\nYour rank: ${rankLabel} — ${myCount} challenges${getBadgeEmojiSummary(myBadges)}`
  );
}
