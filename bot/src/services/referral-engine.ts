import { REFERRAL_BONUS } from "../config/pricing.js";
import { env } from "../config/env.js";
import { convex } from "./convex.js";

const REFERRAL_MILESTONES = {
  5: 100,
  10: 300,
  25: 1000,
  50: 3000,
  100: 10000,
} as const;

const REFERRAL_BADGES: Record<number, { badgeId: string; badgeName: string; badgeEmoji: string }> = {
  5: { badgeId: "referrer_5", badgeName: "Referral Starter", badgeEmoji: "🚀" },
  10: { badgeId: "referrer_10", badgeName: "Referral Star", badgeEmoji: "🌟" },
  25: { badgeId: "referrer_25", badgeName: "Referral Pro", badgeEmoji: "🏆" },
  50: { badgeId: "referrer_50", badgeName: "Referral Legend", badgeEmoji: "👑" },
  100: { badgeId: "referrer_100", badgeName: "Referral Titan", badgeEmoji: "💎" },
};

async function sendTelegramMessage(telegramId: number, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text,
      }),
    });
  } catch {
    return;
  }
}

export function getReferralLink(botUsername: string, telegramId: number): string {
  return `https://t.me/${botUsername}?start=ref_${telegramId}`;
}

export function getReferralMilestones(count: number) {
  return Object.entries(REFERRAL_MILESTONES)
    .map(([threshold, bonus]) => {
      const thresholdNumber = Number(threshold);
      return {
        threshold: thresholdNumber,
        bonus,
        reached: count >= thresholdNumber,
      };
    })
    .sort((a, b) => a.threshold - b.threshold);
}

export async function getReferralMessage(
  telegramId: number,
  botUsername: string
): Promise<string> {
  const link = getReferralLink(botUsername, telegramId);
  const stats = await convex.getReferralStats(telegramId);

  return (
    `hey! come chat with my AI girlfriend on Telegram, she's so addicting 😈💕 ` +
    `you get free credits to start! ${link}` +
    `\n\nmy invites: ${stats.totalReferrals} | earned: ${stats.totalCreditsEarned} credits`
  );
}

export async function checkAndAwardMilestone(
  telegramId: number,
  referralCount: number
): Promise<Array<{ threshold: number; bonus: number; badgeId: string }>> {
  const reachedMilestones = getReferralMilestones(referralCount).filter(
    (milestone) => milestone.reached
  );

  const awarded: Array<{ threshold: number; bonus: number; badgeId: string }> = [];

  for (const milestone of reachedMilestones) {
    const badge = REFERRAL_BADGES[milestone.threshold];
    if (!badge) continue;

    const badgeResult = await convex.awardBadge(
      telegramId,
      badge.badgeId,
      badge.badgeName,
      badge.badgeEmoji
    );

    if (!badgeResult.awarded) continue;

    await convex.addCredits({
      telegramId,
      amount: milestone.bonus,
      paymentMethod: "milestone",
      paymentRef: `ref_milestone_${telegramId}_${milestone.threshold}`,
    });

    await sendTelegramMessage(
      telegramId,
      `🎉 milestone unlocked: ${milestone.threshold} referrals! ` +
        `you got +${milestone.bonus} bonus credits and the ${badge.badgeEmoji} ${badge.badgeName} badge.`
    );

    awarded.push({
      threshold: milestone.threshold,
      bonus: milestone.bonus,
      badgeId: badge.badgeId,
    });
  }

  return awarded;
}

export async function processReferral(
  referrerTelegramId: number,
  newUserTelegramId: number
): Promise<{ success: boolean; reason?: string }> {
  if (referrerTelegramId === newUserTelegramId) {
    return { success: false, reason: "self_referral" };
  }

  const [referrer, referred] = await Promise.all([
    convex.getUser(referrerTelegramId),
    convex.getUser(newUserTelegramId),
  ]);

  if (!referrer) {
    return { success: false, reason: "referrer_not_found" };
  }

  if (referred) {
    return { success: false, reason: "referred_user_exists" };
  }

  const recordResult = await convex.recordReferral(referrerTelegramId, newUserTelegramId);
  if (!recordResult.success) {
    return { success: false, reason: recordResult.reason };
  }

  await Promise.all([
    convex.addCredits({
      telegramId: referrerTelegramId,
      amount: REFERRAL_BONUS,
      paymentMethod: "referral",
      paymentRef: `referrer_bonus_${referrerTelegramId}_${newUserTelegramId}`,
    }),
    convex.addCredits({
      telegramId: newUserTelegramId,
      amount: REFERRAL_BONUS,
      paymentMethod: "referral",
      paymentRef: `referred_bonus_${referrerTelegramId}_${newUserTelegramId}`,
    }),
  ]);

  const updatedCount = await convex.getReferralCount(referrerTelegramId);
  await checkAndAwardMilestone(referrerTelegramId, updatedCount);

  await sendTelegramMessage(
    referrerTelegramId,
    `🎉 new referral joined! you earned +${REFERRAL_BONUS} credits.`
  );

  return { success: true };
}
