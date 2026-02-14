import type { BotContext } from "../../types/context.js";
import { convex } from "../../services/convex.js";

export async function handleHistory(ctx: BotContext) {
  const telegramId = ctx.from!.id;
  const transactions = await convex.getRecentTransactions(telegramId, 10);

  if (transactions.length === 0) {
    await ctx.reply("No transactions yet. Use /buy to get started!");
    return;
  }

  const lines = transactions.map((t: { amount: number; type: string; service?: string; createdAt: number }) => {
    const sign = t.amount >= 0 ? "+" : "";
    const type = t.type.charAt(0).toUpperCase() + t.type.slice(1);
    const service = t.service ? ` (${t.service})` : "";
    const date = new Date(t.createdAt).toLocaleDateString();
    return `${sign}${t.amount} — ${type}${service} — ${date}`;
  });

  const balance = await convex.getBalance(telegramId);

  await ctx.reply(
    `📜 Recent Transactions\n\n` +
    lines.join("\n") +
    `\n\n💰 Current balance: ${balance} credits`
  );
}
