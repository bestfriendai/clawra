import { InlineKeyboard } from "grammy";
import type { BotContext } from "../../types/context.js";
import { convex } from "../../services/convex.js";
import {
  CREDIT_PACKAGES,
  VIP_BENEFITS,
  VIP_MONTHLY,
} from "../../config/pricing.js";
import { env } from "../../config/env.js";
import { getPostPurchaseMessage } from "../../services/upsell.js";
import {
  createCustomerPortalLink,
  createVipCheckoutSession,
  isStripeConfigured,
} from "../../services/stripe.js";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);

function hasActiveSubscription(subscription: {
  status: string;
  currentPeriodEnd: number;
}): boolean {
  return (
    ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status) &&
    subscription.currentPeriodEnd > Date.now()
  );
}

export async function handleBuy(ctx: BotContext) {
  const balance = await convex.getBalance(ctx.from!.id);

  const kb = new InlineKeyboard();
  for (const pkg of CREDIT_PACKAGES) {
    kb.text(pkg.label, `buy:${pkg.id}`).row();
  }
  kb.text(VIP_MONTHLY.label, `buy:${VIP_MONTHLY.id}`).row();
  kb.text("💎 Pay with Crypto", "buy:crypto");

  await ctx.reply(
    `💰 Buy Credits\n\n` +
    `Current balance: ${balance} credits\n\n` +
    `Choose a package:`,
    { reply_markup: kb }
  );
}

export async function handleBuyCallback(ctx: BotContext) {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith("buy:")) return;

  const packageId = data.replace("buy:", "");
  await ctx.answerCallbackQuery();

  if (packageId === "crypto") {
    await ctx.reply(
      "To pay with crypto, use /deposit to get your Solana deposit address."
    );
    return;
  }

  if (packageId === VIP_MONTHLY.id) {
    await handleBuyVIP(ctx);
    return;
  }

  const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) {
    await ctx.reply("Invalid package.");
    return;
  }

  if (!env.STRIPE_PROVIDER_TOKEN) {
    await ctx.reply("Stripe payments are not configured yet. Use /deposit for crypto payments.");
    return;
  }

  // Send Telegram invoice
  await ctx.replyWithInvoice(
    `${pkg.credits} Credits`,
    `Get ${pkg.credits} credits for your AI girlfriend experience.`,
    `credits_${pkg.id}_${ctx.from!.id}_${Date.now()}`,
    "USD",
    [{ label: `${pkg.credits} Credits`, amount: pkg.priceCents }],
    { provider_token: env.STRIPE_PROVIDER_TOKEN }
  );
}

export async function handlePreCheckout(ctx: BotContext) {
  // Always approve pre-checkout queries
  await ctx.answerPreCheckoutQuery(true);
}

export async function handleSuccessfulPayment(ctx: BotContext) {
  const payment = ctx.message?.successful_payment;
  if (!payment) return;

  const telegramId = ctx.from!.id;
  const invoicePayload = payment.invoice_payload;

  // Parse package from payload: credits_{packageId}_{telegramId}_{timestamp}
  const parts = invoicePayload.split("_");
  const packageId = parts[1];
  const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);

  if (!pkg) {
    await ctx.reply("Payment received but package not found. Please contact support.");
    return;
  }

  // Add credits (idempotent)
  const newBalance = await convex.addCredits({
    telegramId,
    amount: pkg.credits,
    paymentMethod: "stripe",
    paymentRef: `stripe_${payment.telegram_payment_charge_id}`,
  });

  await ctx.reply(
    `🧾 Payment Receipt\n\n` +
    `Status: Paid ✅\n` +
    `Package: ${pkg.label}\n` +
    `Credits added: +${pkg.credits}\n` +
    `New balance: ${newBalance} credits\n\n` +
    `${getPostPurchaseMessage(pkg.credits, ctx.girlfriend?.name || "babe")}`
  );
}

export async function handleBuyVIP(ctx: BotContext) {
  if (!isStripeConfigured()) {
    await ctx.reply(
      "VIP subscriptions are not configured yet. Please use /buy for credit packs or /deposit for crypto."
    );
    return;
  }

  const telegramId = ctx.from!.id;
  const existingSubscription = await convex.getSubscriptionByTelegramId(telegramId);

  if (existingSubscription && hasActiveSubscription(existingSubscription)) {
    if (!existingSubscription.stripeCustomerId) {
      await ctx.reply("You already have an active VIP subscription.");
      return;
    }

    const portalUrl = await createCustomerPortalLink({
      stripeCustomerId: existingSubscription.stripeCustomerId,
    });
    const manageKb = new InlineKeyboard().url("Manage VIP Subscription", portalUrl);

    await ctx.reply(
      "👑 You already have VIP active. Manage your billing with the button below:",
      { reply_markup: manageKb }
    );
    return;
  }

  const checkoutUrl = await createVipCheckoutSession({
    telegramId,
    stripeCustomerId: existingSubscription?.stripeCustomerId,
  });

  const checkoutKb = new InlineKeyboard().url("Start VIP Checkout", checkoutUrl);

  await ctx.reply(
    `👑 VIP Monthly - $${VIP_MONTHLY.priceUsd}\n\n` +
      `Includes:\n` +
      `• ${VIP_BENEFITS.monthlyCredits} credits/month\n` +
      `• Priority generation\n` +
      `• Exclusive poses\n` +
      `• No ads\n` +
      `• Double streak rewards\n\n` +
      `Tap below to subscribe securely with Stripe:`,
    { reply_markup: checkoutKb }
  );
}

export async function handleManage(ctx: BotContext) {
  if (!isStripeConfigured()) {
    await ctx.reply("Stripe subscriptions are not configured yet.");
    return;
  }

  const subscription = await convex.getSubscriptionByTelegramId(ctx.from!.id);
  if (!subscription || !subscription.stripeCustomerId) {
    await ctx.reply("No Stripe subscription found yet. Use /buy to start VIP.");
    return;
  }

  const portalUrl = await createCustomerPortalLink({
    stripeCustomerId: subscription.stripeCustomerId,
  });

  const kb = new InlineKeyboard().url("Open Billing Portal", portalUrl);
  await ctx.reply("Manage your subscription here:", { reply_markup: kb });
}
