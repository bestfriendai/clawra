import type { BotContext } from "../../types/context.js";

export async function handleHelp(ctx: BotContext) {
  const name = ctx.girlfriend?.name || "your girlfriend";
  await ctx.reply(
    `Active profile: ${name}\n\n` +
      `Core:\n` +
      `- Send any message to chat\n` +
      `- /selfie to request an image\n` +
      `- /fantasy to switch roleplay mode\n\n` +
      `Profile + Settings:\n` +
      `- /remake to run full onboarding again\n` +
      `- /switch to change profile slot\n` +
      `- /voice to select voice style\n` +
      `- /settings for notifications/preferences\n\n` +
      `Credits + Billing:\n` +
      `- /buy to purchase credits\n` +
      `- /deposit for crypto top-up\n` +
      `- /balance current credits\n` +
      `- /history recent transactions\n\n` +
      `Growth:\n` +
      `- /challenge daily reward\n` +
      `- /referral invite rewards\n` +
      `- /gallery and /album for saved images`
  );
}
