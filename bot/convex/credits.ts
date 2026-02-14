import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getBalance = query({
  args: { telegramId: v.number() },
  handler: async (ctx, { telegramId }) => {
    const record = await ctx.db
      .query("credits")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .first();
    return record?.balance ?? 0;
  },
});

export const getByTelegramId = internalQuery({
  args: { telegramId: v.number() },
  handler: async (ctx, { telegramId }) => {
    return await ctx.db
      .query("credits")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .first();
  },
});

export const initCredits = mutation({
  args: { telegramId: v.number(), initialBalance: v.number() },
  handler: async (ctx, { telegramId, initialBalance }) => {
    const existing = await ctx.db
      .query("credits")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .first();
    if (existing) return existing.balance;

    await ctx.db.insert("credits", {
      telegramId,
      balance: initialBalance,
      lifetimeSpent: 0,
      lifetimePurchased: 0,
    });
    return initialBalance;
  },
});

export const spendCredits = mutation({
  args: {
    telegramId: v.number(),
    amount: v.number(),
    service: v.string(),
    model: v.optional(v.string()),
    falCostUsd: v.optional(v.number()),
  },
  handler: async (ctx, { telegramId, amount, service, model, falCostUsd }) => {
    const record = await ctx.db
      .query("credits")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .first();
    if (!record) throw new Error("No credit record found");
    if (record.balance < amount) throw new Error("Insufficient credits");

    const newBalance = record.balance - amount;
    await ctx.db.patch(record._id, {
      balance: newBalance,
      lifetimeSpent: record.lifetimeSpent + amount,
    });

    // Log transaction
    await ctx.db.insert("transactions", {
      telegramId,
      type: "spend",
      amount: -amount,
      balanceAfter: newBalance,
      service,
      model,
      falCostUsd,
      profitUsd: falCostUsd ? (amount * 0.01) - falCostUsd : undefined,
      createdAt: Date.now(),
    });

    return newBalance;
  },
});

export const addCredits = mutation({
  args: {
    telegramId: v.number(),
    amount: v.number(),
    paymentMethod: v.string(),
    paymentRef: v.string(),
  },
  handler: async (ctx, { telegramId, amount, paymentMethod, paymentRef }) => {
    // Idempotency: check if this paymentRef was already processed
    const existingTx = await ctx.db
      .query("transactions")
      .withIndex("by_paymentRef", (q) => q.eq("paymentRef", paymentRef))
      .first();
    if (existingTx) return existingTx.balanceAfter;

    const record = await ctx.db
      .query("credits")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .first();

    let newBalance: number;
    if (record) {
      newBalance = record.balance + amount;
      await ctx.db.patch(record._id, {
        balance: newBalance,
        lifetimePurchased: record.lifetimePurchased + amount,
      });
    } else {
      newBalance = amount;
      await ctx.db.insert("credits", {
        telegramId,
        balance: newBalance,
        lifetimeSpent: 0,
        lifetimePurchased: amount,
      });
    }

    await ctx.db.insert("transactions", {
      telegramId,
      type: "purchase",
      amount,
      balanceAfter: newBalance,
      paymentMethod,
      paymentRef,
      createdAt: Date.now(),
    });

    return newBalance;
  },
});

export const refundCredits = mutation({
  args: {
    telegramId: v.number(),
    amount: v.number(),
    service: v.string(),
  },
  handler: async (ctx, { telegramId, amount, service }) => {
    const record = await ctx.db
      .query("credits")
      .withIndex("by_telegramId", (q) => q.eq("telegramId", telegramId))
      .first();
    if (!record) throw new Error("No credit record found");

    const newBalance = record.balance + amount;
    await ctx.db.patch(record._id, {
      balance: newBalance,
      lifetimeSpent: record.lifetimeSpent - amount,
    });

    await ctx.db.insert("transactions", {
      telegramId,
      type: "refund",
      amount,
      balanceAfter: newBalance,
      service,
      createdAt: Date.now(),
    });

    return newBalance;
  },
});
