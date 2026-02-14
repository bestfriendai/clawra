import { InlineKeyboard } from "grammy";
import type { BotContext } from "../../types/context.js";
import { REFERRAL_BONUS } from "../../config/pricing.js";
import {
  getReferralLink,
  getReferralMessage,
  getReferralMilestones,
} from "../../services/referral-engine.js";
import { convex } from "../../services/convex.js";

function buildReferralKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📤 Share Link", "referral:share")
    .row()
    .text("📊 My Stats", "referral:stats")
    .row()
    .text("🏆 Top Referrers", "referral:top");
}

function anonymizeDisplayName(name: string): string {
  const normalized = name.replace(/\*/g, "").trim();
  if (!normalized) return "use***";
  return `${normalized.slice(0, 3)}***`;
}

function formatMilestonePreview(referralCount: number): string {
  const milestones = getReferralMilestones(referralCount);
  const next = milestones.find((milestone) => !milestone.reached);
  if (!next) {
    return "all referral milestones unlocked ✅";
  }

  return `${next.threshold - referralCount} more invite${next.threshold - referralCount === 1 ? "" : "s"} to unlock +${next.bonus}`;
}

export async function handleReferral(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from!.id;
  const botUsername = ctx.me.username;

  if (!botUsername) {
    await ctx.reply("referral links are temporarily unavailable. try again in a moment.");
    return;
  }

  const [stats, referralCount] = await Promise.all([
    convex.getReferralStats(telegramId),
    convex.getReferralCount(telegramId),
  ]);
  const link = getReferralLink(botUsername, telegramId);

  await ctx.reply(
    `💌 Referral Program\n\n` +
      `referrals: ${referralCount}\n` +
      `credits earned: ${stats.totalCreditsEarned}\n` +
      `active referrals: ${stats.activeReferrals}\n\n` +
      `your referral link:\n${link}\n\n` +
      `earn ${REFERRAL_BONUS} credits for every new friend who joins.\n` +
      `${formatMilestonePreview(referralCount)}`,
    { reply_markup: buildReferralKeyboard() }
  );
}

export async function handleReferralCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith("referral:")) return;

  try {
    await ctx.answerCallbackQuery();
  } catch {
  }

  const telegramId = ctx.from!.id;
  const botUsername = ctx.me.username;

  if (!botUsername) {
    await ctx.reply("referral links are temporarily unavailable. try again in a moment.");
    return;
  }

  const action = data.replace("referral:", "");

  if (action === "share") {
    const shareMessage = await getReferralMessage(telegramId, botUsername);
    await ctx.reply(`forward this to friends:\n\n${shareMessage}`);
    return;
  }

  if (action === "stats") {
    const stats = await convex.getReferralStats(telegramId);
    const milestones = getReferralMilestones(stats.totalReferrals)
      .map(
        (milestone) =>
          `${milestone.reached ? "✅" : "▫️"} ${milestone.threshold} invites = +${milestone.bonus}`
      )
      .join("\n");

    await ctx.reply(
      `📊 Your Referral Stats\n\n` +
        `total referrals: ${stats.totalReferrals}\n` +
        `total credits earned: ${stats.totalCreditsEarned}\n` +
        `active referrals: ${stats.activeReferrals}\n\n` +
        `${milestones}`
    );
    return;
  }

  if (action === "top") {
    const topReferrers = await convex.getTopReferrers(5);
    if (topReferrers.length === 0) {
      await ctx.reply("🏆 Top Referrers\n\nno referrals yet. be the first!");
      return;
    }

    const lines = topReferrers.map((entry, index) => {
      return `${index + 1}. ${anonymizeDisplayName(entry.displayName)} — ${entry.referralCount} invites (+${entry.creditsEarned} credits)`;
    });

    await ctx.reply(`🏆 Top Referrers\n\n${lines.join("\n")}`);
  }
}
