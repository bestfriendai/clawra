import Stripe from "stripe";
import { env } from "../config/env.js";
import { VIP_MONTHLY } from "../config/pricing.js";

const DEFAULT_RETURN_URL = "https://t.me";
const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2026-01-28.clover";

let stripeClient: Stripe | null = null;

function getReturnUrl(): string {
  return env.MINI_APP_URL || DEFAULT_RETURN_URL;
}

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

export function getStripeClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
    });
  }

  return stripeClient;
}

export function toPeriodEndMs(periodEndSeconds: number | null | undefined): number {
  return periodEndSeconds ? periodEndSeconds * 1000 : Date.now();
}

export async function createVipCheckoutSession(args: {
  telegramId: number;
  stripeCustomerId?: string;
}): Promise<string> {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: args.stripeCustomerId,
    client_reference_id: String(args.telegramId),
    metadata: {
      telegramId: String(args.telegramId),
      plan: VIP_MONTHLY.id,
    },
    subscription_data: {
      metadata: {
        telegramId: String(args.telegramId),
        plan: VIP_MONTHLY.id,
      },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: VIP_MONTHLY.priceCents,
          recurring: { interval: "month" },
          product_data: {
            name: "Clawra VIP Monthly",
            description: "VIP access with monthly credits and premium benefits",
          },
        },
      },
    ],
    allow_promotion_codes: true,
    success_url: getReturnUrl(),
    cancel_url: getReturnUrl(),
  });

  if (!session.url) {
    throw new Error("Stripe checkout session did not return a URL");
  }

  return session.url;
}

export async function createSubscription(args: {
  stripeCustomerId: string;
  paymentMethodId: string;
  priceId: string;
}): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();
  return await stripe.subscriptions.create({
    customer: args.stripeCustomerId,
    default_payment_method: args.paymentMethodId,
    items: [
      {
        price: args.priceId,
      },
    ],
    metadata: {
      plan: VIP_MONTHLY.id,
    },
  });
}

export async function cancelSubscription(
  stripeSubscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();
  return await stripe.subscriptions.cancel(stripeSubscriptionId);
}

export async function createCustomerPortalLink(args: {
  stripeCustomerId: string;
  returnUrl?: string;
}): Promise<string> {
  const stripe = getStripeClient();
  const portal = await stripe.billingPortal.sessions.create({
    customer: args.stripeCustomerId,
    return_url: args.returnUrl || getReturnUrl(),
  });

  return portal.url;
}

export function constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Stripe webhook secret is not configured");
  }

  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
}
