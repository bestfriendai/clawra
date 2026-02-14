import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);

export const upsert = mutation({
  args: {
    telegramId: v.float64(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    status: v.string(),
    currentPeriodEnd: v.float64(),
    plan: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", args.telegramId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
        plan: args.plan,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("subscriptions", {
      telegramId: args.telegramId,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      status: args.status,
      currentPeriodEnd: args.currentPeriodEnd,
      plan: args.plan,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getByTelegramId = query({
  args: { telegramId: v.float64() },
  handler: async (ctx, { telegramId }) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .first();
  },
});

export const getByStripeSubscriptionId = query({
  args: { stripeSubscriptionId: v.string() },
  handler: async (ctx, { stripeSubscriptionId }) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_stripeSubscriptionId", (q) =>
        q.eq("stripeSubscriptionId", stripeSubscriptionId)
      )
      .first();
  },
});

export const cancelByTelegramId = mutation({
  args: { telegramId: v.float64() },
  handler: async (ctx, { telegramId }) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .first();
    if (!existing) return null;

    await ctx.db.patch(existing._id, {
      status: "canceled",
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});

export const updateByStripeSubscriptionId = mutation({
  args: {
    stripeSubscriptionId: v.string(),
    status: v.string(),
    currentPeriodEnd: v.float64(),
  },
  handler: async (ctx, { stripeSubscriptionId, status, currentPeriodEnd }) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripeSubscriptionId", (q) =>
        q.eq("stripeSubscriptionId", stripeSubscriptionId)
      )
      .first();

    if (!existing) return null;

    await ctx.db.patch(existing._id, {
      status,
      currentPeriodEnd,
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});

export const isActive = query({
  args: { telegramId: v.float64() },
  handler: async (ctx, { telegramId }) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .first();

    if (!subscription) return false;

    return (
      ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status) &&
      subscription.currentPeriodEnd > Date.now()
    );
  },
});
