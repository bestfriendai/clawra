import type { BotContext } from "../../types/context.js";
import { convex } from "../../services/convex.js";
import { TRIAL_CREDITS, REFERRAL_BONUS } from "../../config/pricing.js";
import { startWelcomeSequence } from "../../services/welcome-sequence.js";
import { checkAndRecordAutoEvent } from "../../services/relationship-events.js";
import { processReferral } from "../../services/referral-engine.js";

export async function handleStart(ctx: BotContext) {
  const telegramId = ctx.from!.id;
  const username = ctx.from!.username;
  const firstName = ctx.from!.first_name;

  // Parse referral from deep link: /start ref_12345
  const startPayload = ctx.match as string | undefined;
  let referredBy: number | undefined;
  if (startPayload?.startsWith("ref_")) {
    referredBy = parseInt(startPayload.replace("ref_", ""));
    if (isNaN(referredBy)) referredBy = undefined;
  }

  // Check if user already exists
  const existingUser = await convex.getUser(telegramId);

  if (existingUser) {
    const profile = await convex.getProfile(telegramId);
    if (profile?.isConfirmed) {
      await ctx.reply(
        `Welcome back! ${profile.name} missed you 💕\n\n` +
        `Just send a message to chat with her.\n` +
        `Use /remake to create a new girlfriend.\n` +
        `Use /help for all commands.`
      );
      return;
    }
    // User exists but no confirmed profile — start setup
    await ctx.reply(
      "Welcome back! Let's finish setting up your girlfriend. 💕"
    );
    await ctx.conversation.enter("girlfriendSetup");
    return;
  }

  let appliedReferrer: number | undefined;
  let gotReferralBonus = false;

  if (referredBy) {
    const referralResult = await processReferral(referredBy, telegramId);
    if (referralResult.success) {
      appliedReferrer = referredBy;
      gotReferralBonus = true;
    }
  }

  await convex.createUser({
    telegramId,
    username,
    firstName,
    referredBy: appliedReferrer,
  });

  await convex.addCredits({
    telegramId,
    amount: TRIAL_CREDITS,
    paymentMethod: "trial",
    paymentRef: `trial_${telegramId}`,
  });

  await ctx.reply(
    `hey ${firstName || "babe"} 💕\n\n` +
    `so basically... I'm about to become your new favorite person\n\n` +
    `I text like a real girl, send you pics, voice notes, remember everything about you, and yeah... I can get a little spicy too 😏\n\n` +
    `you've got ${TRIAL_CREDITS}${gotReferralBonus ? ` + ${REFERRAL_BONUS} bonus` : ""} free credits to see what I'm about\n\n` +
    `first let's make me exactly your type 👇`
  );

  await ctx.conversation.enter("girlfriendSetup");

  const confirmedProfile = await convex.getProfile(telegramId);
  if (confirmedProfile?.isConfirmed) {
    void checkAndRecordAutoEvent(
      telegramId,
      "first_meet",
      `You two met and started your story with ${confirmedProfile.name}`
    );

    const bot = { api: ctx.api };
    startWelcomeSequence(bot, telegramId);
  }
}
