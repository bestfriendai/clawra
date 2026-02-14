import type { BotContext } from "../../types/context.js";
import { convex } from "../../services/convex.js";
import { deriveWallet } from "../../services/payments/wallet-derivation.js";
import { getSolPrice } from "../../services/payments/price.js";
import { env } from "../../config/env.js";

export async function handleDeposit(ctx: BotContext) {
  const telegramId = ctx.from!.id;

  if (!env.MASTER_MNEMONIC) {
    await ctx.reply("Crypto payments are not configured yet. Use /buy for Stripe payments.");
    return;
  }

  // Check if user already has a deposit wallet
  let wallet = await convex.getDepositWallet(telegramId, "solana");

  if (!wallet) {
    // Create a new deposit wallet
    const nextIndex = await convex.getNextWalletIndex();
    const derived = deriveWallet(nextIndex);

    await convex.createDepositWallet({
      telegramId,
      chain: "solana",
      address: derived.address,
      derivationIndex: nextIndex,
    });

    wallet = {
      address: derived.address,
      telegramId,
      chain: "solana",
      derivationIndex: nextIndex,
      createdAt: Date.now(),
    };
  }

  let priceInfo = "";
  try {
    const solPrice = await getSolPrice();
    const creditsPerSol = Math.floor(solPrice / 0.01);
    priceInfo = `\n\nCurrent SOL price: $${solPrice.toFixed(2)}\n1 SOL = ~${creditsPerSol.toLocaleString()} credits`;
  } catch {
    // Price unavailable, skip
  }

  await ctx.reply(
    `💎 Your Solana Deposit Address\n\n` +
    `\`${wallet.address}\`\n\n` +
    `Send any amount of SOL to this address.\n` +
    `Credits will be added automatically within ~30 seconds.${priceInfo}\n\n` +
    `⚠️ This is YOUR permanent deposit address. Only send SOL to this address.`,
    { parse_mode: "Markdown" }
  );
}
