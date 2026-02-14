import type { BotContext } from "../../types/context.js";
import { convex } from "../../services/convex.js";

export async function handleBalance(ctx: BotContext) {
  const telegramId = ctx.from!.id;
  const balance = await convex.getBalance(telegramId);

  await ctx.reply(
    `💰 Your Balance: ${balance} credits\n\n` +
    `Use /buy to purchase more credits.\n` +
    `Use /history to see recent transactions.`
  );
}
