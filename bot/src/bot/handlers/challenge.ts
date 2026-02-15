import type { BotContext } from "../../types/context.js";
import {
  getTodaysChallenge,
  hasCompletedChallenge,
  markChallengeCompleted,
} from "../../services/daily-challenges.js";
import { convex } from "../../services/convex.js";
import { sendAsMultipleTexts } from "../../utils/message-sender.js";
import { env } from "../../config/env.js";

export async function handleChallenge(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from!.id;
  const challenge = getTodaysChallenge();

  if (await hasCompletedChallenge(telegramId, challenge.id)) {
    await sendAsMultipleTexts({
      ctx,
      messages: [
        "you already did today's challenge babe! 🥰",
        "come back tomorrow for a new one 💕",
      ],
    });
    return;
  }

  await sendAsMultipleTexts({
    ctx,
    messages: [
      `✨ *Today's Challenge: ${challenge.title}* ✨`,
      challenge.girlfriendMessage,
      `_Complete this for +${challenge.rewardCredits} bonus credits!_`,
    ],
  });

  const completionResult = await markChallengeCompleted(
    telegramId,
    challenge.id,
    challenge.rewardCredits
  );

  if (!completionResult.completed) {
    await sendAsMultipleTexts({
      ctx,
      messages: [
        "you already did today's challenge babe! 🥰",
        "come back tomorrow for a new one 💕",
      ],
    });
    return;
  }

  if (!env.FREE_MODE) {
    await convex.addCredits({
      telegramId,
      amount: challenge.rewardCredits,
      paymentMethod: "bonus",
      paymentRef: `challenge:${challenge.id}`,
    });
  }

  const totalChallenges = await convex.getUserChallengeCount(telegramId);
  const newBadges: string[] = [];

  if (totalChallenges >= 5) {
    const rookie = await convex.awardBadge(
      telegramId,
      "challenge_rookie",
      "Challenge Rookie",
      "🌟"
    );
    if (rookie.awarded) newBadges.push("🌟 Challenge Rookie");
  }

  if (totalChallenges >= 25) {
    const pro = await convex.awardBadge(
      telegramId,
      "challenge_pro",
      "Challenge Pro",
      "⭐"
    );
    if (pro.awarded) newBadges.push("⭐ Challenge Pro");
  }

  if (totalChallenges >= 100) {
    const master = await convex.awardBadge(
      telegramId,
      "challenge_master",
      "Challenge Master",
      "🏆"
    );
    if (master.awarded) newBadges.push("🏆 Challenge Master");
  }

  try {
    const badgeLine =
      newBadges.length > 0
        ? `\nnew badge${newBadges.length > 1 ? "s" : ""}: ${newBadges.join(", ")}`
        : "";
    await sendAsMultipleTexts({
      ctx,
      messages: [
        `omg you did it! 🎉 +${challenge.rewardCredits} credits for you babe 💕${badgeLine}`,
      ],
    });
  } catch {}
}
