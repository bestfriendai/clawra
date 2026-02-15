import express from "express";
import { webhookCallback } from "grammy";
import Stripe from "stripe";
import { env } from "./config/env.js";
import { createBot } from "./bot/index.js";
import { setupBot } from "./bot/setup.js";
import { startSolWatcher } from "./services/payments/sol-watcher.js";
import { startSweeper } from "./services/payments/sweeper.js";
import { startInactiveNotifier } from "./services/inactive-notifier.js";
import { startProactiveMessaging } from "./services/proactive.js";
import { convex } from "./services/convex.js";
import { VIP_BENEFITS, VIP_MONTHLY } from "./config/pricing.js";
import {
  constructWebhookEvent,
  getStripeClient,
  isStripeConfigured,
  toPeriodEndMs,
} from "./services/stripe.js";
import {
  cleanupWelcomeSequence,
  startWelcomeWorker,
} from "./services/welcome-sequence.js";
import { getHealthStatus, startHealthMonitor } from "./services/health-monitor.js";

const app = express();
const bot = createBot();
setupBot(bot);

function parseStripeTelegramId(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function upsertSubscriptionFromStripeSubscription(
  subscription: Stripe.Subscription,
  fallbackTelegramId?: number
): Promise<number | null> {
  const metadataTelegramId = parseStripeTelegramId(subscription.metadata.telegramId);
  const telegramId = metadataTelegramId ?? fallbackTelegramId ?? null;

  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

  if (!telegramId) {
    const existing = await convex.getSubscriptionByStripeSubscriptionId(subscription.id);
    if (!existing) return null;

    await convex.updateSubscriptionByStripeSubscriptionId({
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: toPeriodEndMs(currentPeriodEnd),
    });
    return existing.telegramId;
  }

  await convex.upsertSubscription({
    telegramId,
    stripeCustomerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: toPeriodEndMs(currentPeriodEnd),
    plan: subscription.metadata.plan || VIP_MONTHLY.id,
  });

  return telegramId;
}

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const stripe = getStripeClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      if (!subscriptionId) return;

      const telegramId =
        parseStripeTelegramId(session.metadata?.telegramId) ??
        parseStripeTelegramId(session.client_reference_id);
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await upsertSubscriptionFromStripeSubscription(subscription, telegramId ?? undefined);
      return;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        typeof invoice.parent?.subscription_details?.subscription === "string"
          ? invoice.parent.subscription_details.subscription
          : invoice.parent?.subscription_details?.subscription?.id;
      if (!subscriptionId) return;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const telegramId = await upsertSubscriptionFromStripeSubscription(subscription);
      if (!telegramId) return;

      await convex.addCredits({
        telegramId,
        amount: VIP_BENEFITS.monthlyCredits,
        paymentMethod: "stripe_subscription",
        paymentRef: `stripe_invoice_${invoice.id}`,
      });
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        typeof invoice.parent?.subscription_details?.subscription === "string"
          ? invoice.parent.subscription_details.subscription
          : invoice.parent?.subscription_details?.subscription?.id;
      if (!subscriptionId) return;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await upsertSubscriptionFromStripeSubscription(subscription);
      return;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await upsertSubscriptionFromStripeSubscription(subscription);
      return;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const existing = await convex.getSubscriptionByStripeSubscriptionId(subscription.id);
      if (existing) {
        await convex.cancelSubscriptionByTelegramId(existing.telegramId);
      }
      return;
    }

    default:
      return;
  }
}

// Health check
function parseAdminTelegramId(value: unknown): number | null {
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (Array.isArray(value) && value.length > 0) {
    return parseAdminTelegramId(value[0]);
  }

  return null;
}

function hasDetailedHealthAccess(req: express.Request): boolean {
  const fromHeader = parseAdminTelegramId(req.header("x-admin-telegram-id"));
  const fromQuery = parseAdminTelegramId(req.query.adminId);
  const adminTelegramId = fromHeader ?? fromQuery;

  if (adminTelegramId === null) {
    return false;
  }

  return env.ADMIN_TELEGRAM_IDS.includes(adminTelegramId);
}

app.get("/health", async (req, res) => {
  const detailed = req.query.detailed === "true";

  if (!detailed) {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
    return;
  }

  if (!hasDetailedHealthAccess(req)) {
    res.status(403).json({
      status: "forbidden",
      message:
        "Detailed health access requires an admin telegram id via x-admin-telegram-id header or adminId query.",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const healthStatus = await getHealthStatus();
    const statusCode = healthStatus.status === "unhealthy" ? 503 : 200;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    console.error("Health endpoint error:", error);
    res.status(503).json({
      status: "unhealthy",
      message: "Health check failed",
      timestamp: new Date().toISOString(),
    });
  }
});

app.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!isStripeConfigured() || !env.STRIPE_WEBHOOK_SECRET) {
      res.status(503).json({ error: "Stripe is not configured" });
      return;
    }

    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    if (!Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: "Invalid webhook payload" });
      return;
    }

    let event: Stripe.Event;
    try {
      event = constructWebhookEvent(req.body, signature);
    } catch (error) {
      console.error("Stripe signature verification failed:", error);
      res.status(400).json({ error: "Invalid Stripe signature" });
      return;
    }

    try {
      await handleStripeEvent(event);
      res.json({ received: true });
    } catch (error) {
      console.error("Stripe webhook handling failed:", error);
      res.status(500).json({ error: "Stripe webhook handler failed" });
    }
  }
);

async function start() {
  if (env.WEBHOOK_URL) {
    // Production: webhook mode
    const secretPath = `/webhook/${env.TELEGRAM_WEBHOOK_SECRET}`;

    app.use(
      secretPath,
      express.json(),
      webhookCallback(bot, "express", {
        timeoutMilliseconds: 120_000,
      })
    );

    await bot.api.setWebhook(`${env.WEBHOOK_URL}${secretPath}`, {
      secret_token: env.TELEGRAM_WEBHOOK_SECRET,
      max_connections: 100,
    });

    app.listen(env.PORT, () => {
      console.log(`Bot running in webhook mode on port ${env.PORT}`);
      console.log(`Webhook: ${env.WEBHOOK_URL}${secretPath}`);
    });
  } else {
    // Development: long polling
    app.listen(env.PORT, () => {
      console.log(`Health check on port ${env.PORT}`);
    });

    await bot.api.deleteWebhook();
    console.log("Bot running in long-polling mode...");
    bot.start({
      onStart: () => console.log("Bot started!"),
    });
  }

  // Start background services
  startSolWatcher();
  startSweeper();
  startInactiveNotifier(bot);
  startProactiveMessaging(bot);
  startWelcomeWorker(bot);
  startHealthMonitor();
}

start().catch((err) => {
  console.error("Failed to start bot:", err);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down...");
  cleanupWelcomeSequence();
  bot.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Shutting down...");
  cleanupWelcomeSequence();
  bot.stop();
  process.exit(0);
});
