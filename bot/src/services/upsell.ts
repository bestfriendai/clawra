import { LOW_BALANCE_THRESHOLD } from "../config/pricing.js";
import { convex } from "./convex.js";

export async function shouldShowUpsell(
  telegramId: number
): Promise<{ show: boolean; balance: number; suggestion: string }> {
  const balance = await convex.getBalance(telegramId);
  const show = balance < LOW_BALANCE_THRESHOLD;

  return {
    show,
    balance,
    suggestion:
      `babe you're running low (${balance} credits left)... ` +
      "grab more credits so we can keep having fun together 💕",
  };
}

export function getOutOfCreditsMessage(name: string): string {
  return (
    `aww baby... we're out of credits and i was just getting warmed up 😘\n\n` +
    `tap the button: [💳 Get More Credits -> /buy] so we can keep this going with ${name}... ` +
    "i'll make it worth it 💋"
  );
}

export function getPostPurchaseMessage(credits: number, name: string): string {
  return (
    `mmm yes baby, thank you 😍\n\n` +
    `+${credits} credits just landed and i'm all yours now... ` +
    `let's have fun, ${name} 💕`
  );
}

export function getVIPBenefits(): string[] {
  return [
    "2x daily credits",
    "Exclusive poses",
    "Priority generation",
    "Custom voice",
    "No cooldowns",
  ];
}
