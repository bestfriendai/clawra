import type { BotContext } from "../../types/context.js";
import { CREDIT_COSTS } from "../../config/pricing.js";
import { convex } from "../../services/convex.js";
import { env } from "../../config/env.js";

export async function handleRemake(ctx: BotContext) {
  const telegramId = ctx.from!.id;

  if (!env.FREE_MODE) {
    const balance = await convex.getBalance(telegramId);
    if (balance < CREDIT_COSTS.IMAGE_PRO) {
      await ctx.reply(
        `You need at least ${CREDIT_COSTS.IMAGE_PRO} credits to create a new girlfriend.\n` +
        `Current balance: ${balance} credits\n\nUse /buy to get more.`
      );
      return;
    }
  }

  await ctx.reply("Let's create a new girlfriend! Your current one will be replaced.");
  await ctx.conversation.enter("girlfriendSetup");
}
