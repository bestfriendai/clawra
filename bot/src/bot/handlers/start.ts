import type { BotContext } from "../../types/context.js";
import { convex } from "../../services/convex.js";
import { TRIAL_CREDITS, REFERRAL_BONUS } from "../../config/pricing.js";
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
        `Welcome back. Active profile: ${profile.name}\n\n` +
        `Send any message to chat.\n` +
        `Use /remake to rebuild onboarding.\n` +
        `Use /help for commands.`
      );
      return;
    }
    // User exists but no confirmed profile — start setup
    await ctx.reply("Welcome back. Let's finish setup in chat.");
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
    `Welcome ${firstName || "there"}.\n\n` +
      `Let's build your AI girlfriend profile through a quick chat (your type, vibe, and first preview).\n` +
      `You start with ${TRIAL_CREDITS}${gotReferralBonus ? ` + ${REFERRAL_BONUS} bonus` : ""} credits.`
  );

  await ctx.conversation.enter("girlfriendSetup");
}
